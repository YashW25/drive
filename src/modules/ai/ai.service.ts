import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AiAutoReplyRule, AiTriggerType } from './entities/ai-rule.entity';
import { CreateAiRuleDto, UpdateAiRuleDto, TestAiDto } from './dto/ai-rule.dto';
import { Message, MessageDirection } from '../message/entities/message.entity';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { HookManager } from '../../core/hooks';
import { SessionStatus } from '../session/entities/session.entity';
import { IncomingMessage, ChatSummary } from '../../engine/interfaces/whatsapp-engine.interface';

const DEFAULT_AI_ENDPOINT = 'https://ai.innovaradynamics.in/v1/chat';
const DEFAULT_AI_KEY = 'inv_EKnXYFij82V2noa9udqJ3zA6pjqXIxvI8md_AoER838';

export interface UnrepliedChatInfo {
  sessionId: string;
  sessionName: string;
  chatId: string;
  contactName: string;
  senderPhone: string;
  unreadCount: number;
  lastMessageText: string;
  lastMessageTimestamp: number;
  lastMessageDirection: 'incoming' | 'outgoing';
  ruleId: string;
  ruleName: string;
  systemPrompt?: string;
}

export interface UnrepliedScanSummary {
  scannedSessions: number;
  scannedChats: number;
  unrepliedFound: number;
  repliesDispatched: number;
  details: Array<{
    chatId: string;
    contactName: string;
    senderPhone: string;
    incomingText: string;
    replyText?: string;
    ruleName: string;
    success: boolean;
    error?: string;
    durationMs?: number;
  }>;
}

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  /** Tracks last auto-reply timestamp per rule & chat to enforce cooldowns: `${ruleId}:${chatId}` -> epoch ms */
  private readonly cooldownTracker = new Map<string, number>();

  constructor(
    @InjectRepository(AiAutoReplyRule, 'data')
    private readonly ruleRepository: Repository<AiAutoReplyRule>,
    @InjectRepository(Message, 'data')
    private readonly messageRepository: Repository<Message>,
    @InjectDataSource('data')
    private readonly dataSource: DataSource,
    private readonly sessionService: SessionService,
    private readonly messageService: MessageService,
    private readonly hookManager: HookManager,
  ) {}

  async onModuleInit(): Promise<void> {
    // 1. Ensure table exists in data database
    await this.ensureSchema();

    // 2. Register with the global HookManager for message:received events (real-time replies)
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

    // 3. Register for session:ready events to scan previous day & unreplied chats once synced
    this.hookManager.register(
      'ai-auto-reply-ready',
      'session:ready',
      async ctx => {
        if (ctx.sessionId) {
          this.logger.log(`Session ${ctx.sessionId} connected. Scheduling unreplied chat scan in 6s...`);
          setTimeout(() => {
            void this.scanAndProcessUnrepliedChats(ctx.sessionId).catch(err => {
              this.logger.error(`Error in automated unreplied chat scan for ${ctx.sessionId}: ${String(err)}`);
            });
          }, 6000);
        }
        return { continue: true, data: ctx.data };
      },
      90,
    );

    // 4. Background sweep every 3 minutes for any missed unreplied chats
    setInterval(() => {
      void this.scanAndProcessUnrepliedChats().catch(err => {
        this.logger.error(`Error in periodic unreplied chats background scan: ${String(err)}`);
      });
    }, 3 * 60 * 1000);

    this.logger.log('AI Auto-Reply service initialized (listening for live messages, session syncs, and unreplied sweeps)');
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
    let senderNumber = (incoming.senderPhone || incoming.author || incoming.from || '').replace(/\D/g, '');
    if (incoming.chatId?.includes('@lid') && (!incoming.senderPhone || incoming.senderPhone.includes('@lid') || senderNumber.length > 13)) {
      const resolved = await this.resolveLidPhone(sessionId, incoming.chatId);
      if (resolved) {
        senderNumber = resolved;
        incoming.senderPhone = resolved;
      }
    }

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
   * Resolves an @lid contact or chat ID to a phone number using the engine or database
   */
  async resolveLidPhone(sessionId: string, lidOrChatId: string): Promise<string | null> {
    const rawLid = lidOrChatId.replace(/@.*$/, '').trim();
    if (!rawLid) return null;

    try {
      const engine = this.sessionService.getEngine(sessionId);
      if (engine) {
        const resolved = await engine.resolveContactPhone(`${rawLid}@lid`);
        if (resolved) {
          return resolved.replace(/\D/g, '');
        }
      }
    } catch {
      // ignore
    }

    try {
      const isSqlite = this.dataSource.options.type === 'sqlite';
      const query = isSqlite
        ? `SELECT phone FROM lid_mappings WHERE lid = ? OR lid = ? LIMIT 1`
        : `SELECT phone FROM lid_mappings WHERE lid = $1 OR lid = $2 LIMIT 1`;
      const rows = await this.dataSource.query(query, [rawLid, `${rawLid}@lid`]);
      if (rows && rows.length > 0 && rows[0].phone) {
        return String(rows[0].phone).replace(/\D/g, '');
      }
    } catch {
      // ignore
    }

    return null;
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

        let effectiveSender = senderNumber;
        if (incoming.chatId?.includes('@lid') || senderNumber.length > 13) {
          const resolved = await this.resolveLidPhone(sessionId, incoming.chatId || senderNumber);
          if (resolved) {
            effectiveSender = resolved;
          }
        }

        return numbers.some(n => {
          const raw = n.trim();
          if (!raw) return false;
          const cleanTarget = raw.replace(/\D/g, '');
          if (!cleanTarget) {
            // Non-numeric target (e.g. contact name or pushName)
            const pushName = incoming.contact?.pushName || incoming.contact?.name || '';
            return pushName.toLowerCase().includes(raw.toLowerCase());
          }

          const numberMatch =
            cleanTarget === effectiveSender ||
            cleanTarget === senderNumber ||
            (cleanTarget.length >= 10 && effectiveSender.endsWith(cleanTarget)) ||
            (effectiveSender.length >= 10 && cleanTarget.endsWith(effectiveSender));

          const chatIdMatch = incoming.chatId ? incoming.chatId.includes(cleanTarget) : false;

          return numberMatch || chatIdMatch;
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

  // --- Unread & Unreplied Chat Detection and Processing ---

  /**
   * Scans active WhatsApp sessions for 1-on-1 chats from the previous day / recent days
   * that have unread messages or where the contact has sent a message that has NOT been replied to.
   */
  async detectUnrepliedChats(
    targetSessionId?: string,
    maxAgeHours = 48,
  ): Promise<UnrepliedChatInfo[]> {
    const unreplied: UnrepliedChatInfo[] = [];
    const minTimestamp = Math.floor(Date.now() / 1000) - maxAgeHours * 3600;

    // 1. Fetch sessions
    const sessions = await this.sessionService.findAll();
    const activeSessions = sessions.filter(
      s => s.status === SessionStatus.READY && (!targetSessionId || targetSessionId === '*' || s.id === targetSessionId),
    );

    for (const session of activeSessions) {
      const engine = this.sessionService.getEngine(session.id);
      if (!engine) continue;

      // 2. Fetch active rules for this session or global '*'
      const rules = await this.ruleRepository.find({
        where: [{ enabled: true, sessionId: session.id }, { enabled: true, sessionId: '*' }],
      });
      if (!rules.length) continue;

      // 3. Collect chats from WhatsApp engine
      let engineChats: ChatSummary[] = [];
      try {
        engineChats = await engine.getChats();
      } catch (err) {
        this.logger.warn(`Failed to get chats from engine for session ${session.id}: ${String(err)}`);
      }

      // 4. Also collect distinct chats with activity from the messages database
      const dbRecentChatIds = await this.messageRepository
        .createQueryBuilder('m')
        .select('DISTINCT m.chatId', 'chatId')
        .where('m.sessionId = :sessionId', { sessionId: session.id })
        .andWhere('m.timestamp >= :minTimestamp', { minTimestamp })
        .getRawMany<{ chatId: string }>();

      const allChatIds = new Set<string>();
      for (const c of engineChats) {
        if (!c.isGroup && !c.id.endsWith('@g.us') && !c.id.endsWith('@broadcast') && !c.id.endsWith('@newsletter')) {
          allChatIds.add(c.id);
        }
      }
      for (const r of dbRecentChatIds) {
        if (r.chatId && !r.chatId.endsWith('@g.us') && !r.chatId.endsWith('@broadcast') && !r.chatId.endsWith('@newsletter')) {
          allChatIds.add(r.chatId);
        }
      }

      // 5. Inspect each candidate chat
      for (const chatId of allChatIds) {
        const engineChat = engineChats.find(c => c.id === chatId);
        const unreadCount = engineChat?.unreadCount ?? 0;

        // Fetch recent messages for this chat (newest first)
        const recentMessages = await this.messageRepository.find({
          where: { sessionId: session.id, chatId },
          order: { timestamp: 'DESC' },
          take: 10,
        });

        let isUnreplied = false;
        let incomingText = '';
        let incomingTimestamp = engineChat?.timestamp ?? 0;
        let direction: 'incoming' | 'outgoing' = 'incoming';

        if (recentMessages.length > 0) {
          const newest = recentMessages[0];
          direction = newest.direction;
          if (newest.direction === MessageDirection.INCOMING) {
            isUnreplied = true;
            // Aggregate consecutive incoming messages without an answer
            const pending: Message[] = [];
            for (const m of recentMessages) {
              if (m.direction === MessageDirection.INCOMING) {
                pending.unshift(m);
              } else {
                break;
              }
            }
            incomingText = pending
              .map(p => p.body?.trim())
              .filter(Boolean)
              .join('\n');
            incomingTimestamp = newest.timestamp ?? Math.floor(newest.createdAt.getTime() / 1000);
          } else {
            // Newest message is outgoing -> already replied!
            isUnreplied = false;
          }
        } else if (engineChat && (unreadCount > 0 || engineChat.lastMessageFromMe === false)) {
          // If not in DB yet, but engine shows unread or contact's last message
          isUnreplied = true;
          incomingText = engineChat.lastMessage || 'Hello';
          incomingTimestamp = engineChat.timestamp;
        }

        // Must be unreplied, within time window (or unread), and non-empty
        if (!isUnreplied || (!unreadCount && incomingTimestamp < minTimestamp) || !incomingText.trim()) {
          continue;
        }

        let senderPhone = chatId.replace(/@.*$/, '').replace(/\D/g, '');
        let contactName = engineChat?.name || senderPhone;

        if (chatId.includes('@lid')) {
          const resolved = await this.resolveLidPhone(session.id, chatId);
          if (resolved) {
            senderPhone = resolved;
            if (!engineChat?.name || engineChat.name === chatId.replace(/@.*$/, '')) {
              contactName = resolved;
            }
          }
        }

        // Match against active rules
        for (const rule of rules) {
          const dummyIncoming: IncomingMessage = {
            id: `scan_${Date.now()}`,
            chatId,
            from: chatId,
            to: session.phone || '',
            body: incomingText,
            timestamp: incomingTimestamp,
            fromMe: false,
            isGroup: false,
            type: 'text',
            senderPhone: senderPhone !== chatId.replace(/@.*$/, '').replace(/\D/g, '') ? senderPhone : undefined,
            contact: {
              name: contactName,
              pushName: contactName,
            },
          };

          const isMatch = await this.evaluateRuleMatch(session.id, rule, dummyIncoming, senderPhone, incomingText);
          if (isMatch) {
            unreplied.push({
              sessionId: session.id,
              sessionName: session.name,
              chatId,
              contactName,
              senderPhone,
              unreadCount,
              lastMessageText: incomingText,
              lastMessageTimestamp: incomingTimestamp,
              lastMessageDirection: direction,
              ruleId: rule.id,
              ruleName: rule.name,
              systemPrompt: rule.systemPrompt || undefined,
            });
            break; // One rule per chat
          }
        }
      }
    }

    return unreplied;
  }

  /**
   * Scans unreplied chats and dispatches AI auto-replies
   */
  async scanAndProcessUnrepliedChats(
    targetSessionId?: string,
    options: { maxAgeHours?: number; dryRun?: boolean } = {},
  ): Promise<UnrepliedScanSummary> {
    const maxAgeHours = options.maxAgeHours ?? 48;
    const dryRun = options.dryRun ?? false;

    this.logger.log(
      `Starting unreplied chats sweep (sessionId: ${targetSessionId || 'all'}, maxAgeHours: ${maxAgeHours}, dryRun: ${dryRun})`,
    );

    const unrepliedChats = await this.detectUnrepliedChats(targetSessionId, maxAgeHours);

    const allSessions = await this.sessionService.findAll();
    const summary: UnrepliedScanSummary = {
      scannedSessions: targetSessionId && targetSessionId !== '*' ? 1 : allSessions.length,
      scannedChats: unrepliedChats.length,
      unrepliedFound: unrepliedChats.length,
      repliesDispatched: 0,
      details: [],
    };

    if (dryRun) {
      summary.details = unrepliedChats.map(c => ({
        chatId: c.chatId,
        contactName: c.contactName,
        senderPhone: c.senderPhone,
        incomingText: c.lastMessageText,
        ruleName: c.ruleName,
        success: true,
      }));
      return summary;
    }

    // Process each unreplied chat
    for (const item of unrepliedChats) {
      const cooldownKey = `${item.ruleId}:${item.chatId}`;
      const dedupeKey = `unreplied_${item.sessionId}_${item.chatId}_${item.lastMessageTimestamp}`;
      const now = Date.now();
      const lastSent = this.cooldownTracker.get(cooldownKey) || 0;

      const rule = await this.ruleRepository.findOne({ where: { id: item.ruleId } });
      if (!rule || !rule.enabled) continue;

      const cooldownMs = (rule.cooldownSeconds || 10) * 1000;
      if (now - lastSent < cooldownMs) {
        this.logger.debug(`Skipping unreplied chat ${item.chatId} due to active cooldown`);
        continue;
      }

      if (this.cooldownTracker.has(dedupeKey)) {
        this.logger.debug(`Skipping unreplied chat ${item.chatId} - already replied to message timestamp ${item.lastMessageTimestamp}`);
        continue;
      }

      this.cooldownTracker.set(cooldownKey, now);
      this.cooldownTracker.set(dedupeKey, now);

      const start = Date.now();
      try {
        await this.executeAiReply(item.sessionId, rule, item.chatId, item.lastMessageText);
        const engine = this.sessionService.getEngine(item.sessionId);
        if (engine) {
          await engine.sendSeen(item.chatId).catch(() => undefined);
        }

        summary.repliesDispatched++;
        summary.details.push({
          chatId: item.chatId,
          contactName: item.contactName,
          senderPhone: item.senderPhone,
          incomingText: item.lastMessageText,
          ruleName: item.ruleName,
          success: true,
          durationMs: Date.now() - start,
        });
      } catch (err: any) {
        summary.details.push({
          chatId: item.chatId,
          contactName: item.contactName,
          senderPhone: item.senderPhone,
          incomingText: item.lastMessageText,
          ruleName: item.ruleName,
          success: false,
          error: err?.message || String(err),
        });
      }
    }

    this.logger.log(
      `Finished unreplied chats sweep: found ${summary.unrepliedFound}, dispatched ${summary.repliesDispatched} reply(ies)`,
    );
    return summary;
  }
}
