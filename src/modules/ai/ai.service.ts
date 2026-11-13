import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AiAutoReplyRule, AiTriggerType } from './entities/ai-rule.entity';
import { CreateAiRuleDto, UpdateAiRuleDto, TestAiDto } from './dto/ai-rule.dto';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { HookManager } from '../../core/hooks';
import { IncomingMessage } from '../../engine/interfaces/whatsapp-engine.interface';

const DEFAULT_AI_ENDPOINT = 'https://ai.innovaradynamics.in/v1/chat';
const DEFAULT_AI_KEY = 'inv_EKnXYFij82V2noa9udqJ3zA6pjqXIxvI8md_AoER838';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  /** Tracks last auto-reply timestamp per rule & chat to enforce cooldowns: `${ruleId}:${chatId}` -> epoch ms */
  private readonly cooldownTracker = new Map<string, number>();

  constructor(
    @InjectRepository(AiAutoReplyRule, 'data')
    private readonly ruleRepository: Repository<AiAutoReplyRule>,
    @InjectDataSource('data')
    private readonly dataSource: DataSource,
    private readonly sessionService: SessionService,
    private readonly messageService: MessageService,
    private readonly hookManager: HookManager,
  ) {}

  async onModuleInit(): Promise<void> {
    // 1. Ensure table exists in data database
    await this.ensureSchema();

    // 2. Register with the global HookManager for message:received events
    this.hookManager.register(
      'ai-auto-reply',
      'message:received',
      async ctx => {
        if (ctx.sessionId && ctx.data) {
          // Asynchronously process the incoming message without blocking the hook pipeline
          void this.handleIncomingMessage(ctx.sessionId, ctx.data as IncomingMessage).catch(err => {
            this.logger.error(`Error in AI auto-reply handler: ${String(err)}`);
          });
        }
        return { continue: true, data: ctx.data };
      },
      100, // lower priority to run after system message ingestion
    );

    this.logger.log('AI Auto-Reply service initialized and listening for incoming messages');
  }

  /** Ensure the database table exists regardless of migration state */
  private async ensureSchema(): Promise<void> {
    try {
      const isSqlite = this.dataSource.options.type === 'sqlite';
      if (isSqlite) {
        await this.dataSource.query(`
          CREATE TABLE IF NOT EXISTS ai_auto_reply_rules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            sessionId TEXT NOT NULL DEFAULT '*',
            sessionName TEXT NOT NULL DEFAULT 'All Sessions',
            triggerType TEXT NOT NULL DEFAULT 'all',
            specificNumbers TEXT DEFAULT '[]',
            customKeywords TEXT DEFAULT '[]',
            aiEndpoint TEXT NOT NULL DEFAULT '${DEFAULT_AI_ENDPOINT}',
            aiApiKey TEXT NOT NULL DEFAULT '${DEFAULT_AI_KEY}',
            systemPrompt TEXT,
            cooldownSeconds INTEGER NOT NULL DEFAULT 10,
            maxTokens INTEGER NOT NULL DEFAULT 80,
            totalRepliesSent INTEGER NOT NULL DEFAULT 0,
            ownerSupabaseId TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);
      } else {
        await this.dataSource.query(`
          CREATE TABLE IF NOT EXISTS ai_auto_reply_rules (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            "sessionId" VARCHAR(255) NOT NULL DEFAULT '*',
            "sessionName" VARCHAR(255) NOT NULL DEFAULT 'All Sessions',
            "triggerType" VARCHAR(50) NOT NULL DEFAULT 'all',
            "specificNumbers" JSONB DEFAULT '[]'::jsonb,
            "customKeywords" JSONB DEFAULT '[]'::jsonb,
            "aiEndpoint" VARCHAR(2048) NOT NULL DEFAULT '${DEFAULT_AI_ENDPOINT}',
            "aiApiKey" VARCHAR(255) NOT NULL DEFAULT '${DEFAULT_AI_KEY}',
            "systemPrompt" TEXT,
            "cooldownSeconds" INTEGER NOT NULL DEFAULT 10,
            "maxTokens" INTEGER NOT NULL DEFAULT 80,
            "totalRepliesSent" INTEGER NOT NULL DEFAULT 0,
            "ownerSupabaseId" VARCHAR(255),
            "createdAt" TIMESTAMP DEFAULT NOW(),
            "updatedAt" TIMESTAMP DEFAULT NOW()
          );
        `);
      }
    } catch (err) {
      this.logger.warn(`Schema check notice (may already exist): ${String(err)}`);
    }
  }

  /**
   * Main entrypoint for processing an incoming WhatsApp message and executing AI auto-replies
   */
  async handleIncomingMessage(sessionId: string, incoming: IncomingMessage): Promise<void> {
    // 1. Guard against outgoing or internal protocol updates
    if (incoming.fromMe || incoming.isStatusBroadcast) {
      return;
    }

    // 2. Skip non-text or broadcast / newsletter channels
    const body = incoming.body?.trim();
    if (!body) {
      return;
    }
    const chatId = incoming.chatId;
    if (!chatId || chatId.endsWith('@g.us') || chatId.endsWith('@newsletter') || chatId.endsWith('@broadcast')) {
      return; // Skip group chats, newsletters, broadcasts
    }

    // 3. Find active rules for this session or global '*'
    const rules = await this.ruleRepository.find({
      where: [{ enabled: true, sessionId }, { enabled: true, sessionId: '*' }],
    });

    if (!rules || rules.length === 0) {
      return;
    }

    // Clean sender phone number digits (e.g. 919561485909)
    const senderNumber = (incoming.senderPhone || incoming.author || incoming.from || '').replace(/\D/g, '');

    for (const rule of rules) {
      const isMatch = await this.evaluateRuleMatch(sessionId, rule, incoming, senderNumber, body);
      if (!isMatch) {
        continue;
      }

      // Check cooldown
      const cooldownKey = `${rule.id}:${chatId}`;
      const now = Date.now();
      const lastSent = this.cooldownTracker.get(cooldownKey) || 0;
      const cooldownMs = (rule.cooldownSeconds || 10) * 1000;

      if (now - lastSent < cooldownMs) {
        this.logger.debug(
          `AI auto-reply for ${chatId} on rule "${rule.name}" is on cooldown (${Math.ceil(
            (cooldownMs - (now - lastSent)) / 1000,
          )}s remaining)`,
        );
        continue;
      }

      // Trigger AI reply
      this.cooldownTracker.set(cooldownKey, now);
      await this.executeAiReply(sessionId, rule, chatId, body);
      break; // One auto-reply per message
    }
  }

  /**
   * Evaluate whether a rule matches the incoming message criteria
   */
  private async evaluateRuleMatch(
    sessionId: string,
    rule: AiAutoReplyRule,
    incoming: IncomingMessage,
    senderNumber: string,
    messageText: string,
  ): Promise<boolean> {
    switch (rule.triggerType) {
      case AiTriggerType.ALL:
        return true;

      case AiTriggerType.SPECIFIC: {
        const numbers = Array.isArray(rule.specificNumbers) ? rule.specificNumbers : [];
        if (numbers.length === 0) return false;
        return numbers.some(n => {
          const cleanTarget = n.replace(/\D/g, '');
          return cleanTarget && (cleanTarget === senderNumber || incoming.chatId.includes(cleanTarget));
        });
      }

      case AiTriggerType.UNKNOWN_ONLY: {
        try {
          const engine = this.sessionService.getEngine(sessionId);
          if (!engine) return true;
          const contacts = await engine.getContacts();
          const match = contacts?.find(
            c => c.number === senderNumber || c.id === incoming.from || c.id === incoming.chatId,
          );
          // If the contact exists in our address book with isMyContact, do NOT trigger
          return !match?.isMyContact;
        } catch {
          return true; // Fallback to matching if contact query fails
        }
      }

      case AiTriggerType.CUSTOM_KEYWORD: {
        const keywords = Array.isArray(rule.customKeywords) ? rule.customKeywords : [];
        if (keywords.length === 0) return false;
        const lowerBody = messageText.toLowerCase();
        return keywords.some(k => k.trim() && lowerBody.includes(k.trim().toLowerCase()));
      }

      default:
        return false;
    }
  }

  /**
   * Generates response from Innovara AI and dispatches it back to the WhatsApp user
   */
  private async executeAiReply(
    sessionId: string,
    rule: AiAutoReplyRule,
    chatId: string,
    userMessage: string,
  ): Promise<void> {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      this.logger.warn(`Cannot send AI auto-reply: Session '${sessionId}' is not active`);
      return;
    }

    try {
      // 1. Send typing presence state
      await engine.sendChatState(chatId, 'typing').catch(() => undefined);

      // 2. Call Innovara AI endpoint
      const aiEndpoint = rule.aiEndpoint || DEFAULT_AI_ENDPOINT;
      const aiKey = rule.aiApiKey || DEFAULT_AI_KEY;
      const conversationId = `wa_${sessionId}_${chatId.replace(/\D/g, '')}`;

      const payload: Record<string, unknown> = {
        message: userMessage,
        conversation_id: conversationId,
        use_knowledge: false,
        max_tokens: rule.maxTokens && rule.maxTokens >= 50 ? rule.maxTokens : 180,
      };

      if (rule.systemPrompt && rule.systemPrompt.trim()) {
        payload.system_prompt = rule.systemPrompt.trim();
      }

      this.logger.log(`Invoking AI for chat ${chatId} using endpoint ${aiEndpoint}`);

      const response = await fetch(aiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': aiKey,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) OpenWA/1.0',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(`AI endpoint error (${response.status}): ${errText}`);
        return;
      }

      const data = (await response.json()) as {
        response?: string;
        choices?: Array<{ message?: { content?: string } }>;
      };

      let reply = data.response || data.choices?.[0]?.message?.content || '';

      // Clean reasoning or thinking tags if present
      reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      if (!reply) {
        this.logger.warn(`AI returned empty response for chat ${chatId}`);
        return;
      }

      // 3. Send reply through MessageService (persists + simulates typing)
      await this.messageService.sendText(sessionId, {
        chatId,
        text: reply,
      });

      // 4. Update counter
      await this.ruleRepository.increment({ id: rule.id }, 'totalRepliesSent', 1);

      this.logger.log(`AI Auto-Reply sent to ${chatId} (${reply.slice(0, 50)}...)`);
    } catch (err) {
      this.logger.error(`Failed to execute AI auto-reply for ${chatId}: ${String(err)}`);
    }
  }

  // --- CRUD API Operations ---

  async findAll(ownerSupabaseId?: string): Promise<AiAutoReplyRule[]> {
    if (ownerSupabaseId) {
      return this.ruleRepository.find({
        where: [{ ownerSupabaseId }, { ownerSupabaseId: null as any }],
        order: { createdAt: 'DESC' },
      });
    }
    return this.ruleRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<AiAutoReplyRule> {
    const rule = await this.ruleRepository.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`AI Auto-Reply Rule '${id}' not found`);
    }
    return rule;
  }

  async create(dto: CreateAiRuleDto, ownerSupabaseId?: string): Promise<AiAutoReplyRule> {
    const rule = this.ruleRepository.create({
      name: dto.name,
      enabled: dto.enabled ?? true,
      sessionId: dto.sessionId || '*',
      sessionName: dto.sessionName || 'All Sessions',
      triggerType: dto.triggerType || AiTriggerType.ALL,
      specificNumbers: dto.specificNumbers || [],
      customKeywords: dto.customKeywords || [],
      aiEndpoint: dto.aiEndpoint || DEFAULT_AI_ENDPOINT,
      aiApiKey: dto.aiApiKey || DEFAULT_AI_KEY,
      systemPrompt: dto.systemPrompt || null,
      cooldownSeconds: dto.cooldownSeconds ?? 10,
      maxTokens: dto.maxTokens ?? 150,
      ownerSupabaseId: ownerSupabaseId || null,
      totalRepliesSent: 0,
    });

    return this.ruleRepository.save(rule);
  }

  async update(id: string, dto: UpdateAiRuleDto): Promise<AiAutoReplyRule> {
    const rule = await this.findOne(id);

    if (dto.name !== undefined) rule.name = dto.name;
    if (dto.enabled !== undefined) rule.enabled = dto.enabled;
    if (dto.sessionId !== undefined) rule.sessionId = dto.sessionId;
    if (dto.sessionName !== undefined) rule.sessionName = dto.sessionName;
    if (dto.triggerType !== undefined) rule.triggerType = dto.triggerType;
    if (dto.specificNumbers !== undefined) rule.specificNumbers = dto.specificNumbers;
    if (dto.customKeywords !== undefined) rule.customKeywords = dto.customKeywords;
    if (dto.aiEndpoint !== undefined) rule.aiEndpoint = dto.aiEndpoint;
    if (dto.aiApiKey !== undefined) rule.aiApiKey = dto.aiApiKey;
    if (dto.systemPrompt !== undefined) rule.systemPrompt = dto.systemPrompt;
    if (dto.cooldownSeconds !== undefined) rule.cooldownSeconds = dto.cooldownSeconds;
    if (dto.maxTokens !== undefined) rule.maxTokens = dto.maxTokens;

    return this.ruleRepository.save(rule);
  }

  async delete(id: string): Promise<void> {
    const rule = await this.findOne(id);
    await this.ruleRepository.remove(rule);
  }

  /**
   * Test the AI Assistant directly from the dashboard
   */
  async testAi(dto: TestAiDto): Promise<{ success: boolean; response?: string; error?: string; durationMs: number }> {
    const start = Date.now();
    const endpoint = dto.endpoint || DEFAULT_AI_ENDPOINT;
    const apiKey = dto.apiKey || DEFAULT_AI_KEY;

    try {
      const payload: Record<string, unknown> = {
        message: dto.message,
        use_knowledge: false,
        max_tokens: 180,
      };

      if (dto.systemPrompt && dto.systemPrompt.trim()) {
        payload.system_prompt = dto.systemPrompt.trim();
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) OpenWA/1.0',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      });

      const durationMs = Date.now() - start;

      if (!res.ok) {
        const text = await res.text();
        return {
          success: false,
          error: `HTTP ${res.status}: ${text}`,
          durationMs,
        };
      }

      const data = (await res.json()) as {
        response?: string;
        choices?: Array<{ message?: { content?: string } }>;
      };

      let reply = data.response || data.choices?.[0]?.message?.content || '';
      reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      return {
        success: true,
        response: reply,
        durationMs,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }
}
