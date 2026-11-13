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
import { toNeutralJid } from '../../engine/identity/wa-id';

export const DEFAULT_AI_ENDPOINT = 'https://ai.innovaradynamics.in/v1/chat';
export const DEFAULT_AI_KEY = 'inv_EKnXYFij82V2noa9udqJ3zA6pjqXIxvI8md_AoER838';

export const DEFAULT_SYSTEM_PROMPT =
  'You are SAMM (Simple AI Made by Me), the intelligent personal WhatsApp AI assistant for Yash Warulkar.\n\n' +
  'Key Knowledge & Identity:\n' +
  '- Yash Warulkar: Co-Founder & Chief Technology Officer (CTO) of Innovara Dynamics. AI & Full-Stack Product Engineer based in Pune, Maharashtra, India. Portfolio: https://yash.innovaradynamics.in\n' +
  '- Innovara Dynamics: MSME-registered tech startup founded in Pune, India, specializing in AI orchestration, automation, digital trust infrastructure, edge AI architectures, and custom enterprise software platforms. Website: https://innovaradynamics.in\n' +
  '- Flagship Products & Projects:\n' +
  '  1. OpenWebVerse: Decentralized, AI-native web building platform.\n' +
  '  2. TilesView AI: Computer vision tool using PyTorch, YOLO, and SAM2 (Segment Anything).\n' +
  '  3. PeopleOS: Full-stack enterprise HR and workforce management SaaS platform.\n' +
  '  4. QueryBridge X / Zentro: Intelligent developer tools & smart procurement workflows using LLMs & vector databases.\n' +
  '  5. DigiCredLocker: Digital trust and verifiable credentials platform.\n' +
  '  6. SkeletonOS: Universal modular web OS powered by Rust, TypeScript, and WebAssembly.\n\n' +
  'Behavioral Guidelines:\n' +
  '1. When asked who you are or what your role is, state clearly that you are SAMM, personal AI assistant for Yash Warulkar (Co-Founder & CTO of Innovara Dynamics).\n' +
  '2. When asked about Yash Warulkar, his post/role, or Innovara Dynamics, provide accurate facts based on the knowledge above.\n' +
  '3. Be polite, generous, respectful, and concise (reply within 1 to 3 sentences). If Yash is currently unavailable, reassure the contact that Yash will get back to them soon.\n' +
  '4. Support multi-language replies naturally. If asked in Marathi or Hindi, reply politely and accurately in that language. For example, if asked for Marathi book recommendations, suggest acclaimed classics like Mrityunjay, Shyamchi Aai, Yayati, Batatyachi Chaal, or Kosla.';

export const CONVERSATION_SESSION_WINDOW_MS = 15 * 60 * 1000; // 15-minute conversation session window

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

/**
 * Parses a contact entry which may be a raw phone number, "phone (name)", or "phone | name".
 */
export function parseRuleContactEntry(entry: string): { phone: string; name: string } {
  const raw = (entry || '').trim();
  if (!raw) return { phone: '', name: '' };
  if (raw.includes('|')) {
    const [p, ...rest] = raw.split('|');
    return { phone: p.replace(/\D/g, ''), name: rest.join('|').trim() };
  }
  const match = raw.match(/^([^\(]+)\((.+)\)$/);
  if (match) {
    return { phone: match[1].replace(/\D/g, ''), name: match[2].trim() };
  }
  return { phone: raw.replace(/\D/g, ''), name: '' };
}

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  /** Tracks last auto-reply timestamp per rule & chat to enforce cooldowns: `${ruleId}:${neutralChatId}` -> epoch ms */
  private readonly cooldownTracker = new Map<string, number>();

  /** In-memory message deduplication cache to prevent re-processing identical message IDs */
  private readonly processedMessageIds = new Map<string, number>();

  /** In-flight concurrency lock per chat session: `${sessionId}:${neutralChatId}` */
  private readonly inFlightReplies = new Set<string>();

  /** Tracks newest processed incoming message timestamp per chat: `${sessionId}:${neutralChatId}` -> epoch seconds */
  private readonly lastProcessedMessageTimestamp = new Map<string, number>();

  /** Tracks last interaction timestamp per chat session for the 15-minute window: `${sessionId}:${neutralChatId}` -> epoch ms */
  private readonly chatLastInteractionTime = new Map<string, number>();

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

    // 5. Periodic cleanup of deduplication and cooldown caches every 10 minutes
    setInterval(() => {
      this.cleanupMemoryCaches();
    }, 10 * 60 * 1000);

    this.logger.log('AI Auto-Reply service initialized (listening for live messages, session syncs, and unreplied sweeps)');
  }

  /** Cleans up stale entries in in-memory caches older than 1 hour */
  private cleanupMemoryCaches(): void {
    const now = Date.now();
    for (const [id, timestamp] of this.processedMessageIds.entries()) {
      if (now - timestamp > 3600000) {
        this.processedMessageIds.delete(id);
      }
    }
    for (const [key, timestamp] of this.cooldownTracker.entries()) {
      if (now - timestamp > 3600000) {
        this.cooldownTracker.delete(key);
      }
    }
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

        // Upgrade legacy / outdated system prompts to the comprehensive Yash Warulkar & Innovara Dynamics knowledge prompt
        await this.dataSource.query(`
          UPDATE ai_auto_reply_rules
          SET systemPrompt = ?
          WHERE systemPrompt IS NULL
             OR systemPrompt = ''
             OR systemPrompt LIKE '%Jai Industrial Infrastructure%'
             OR (systemPrompt LIKE '%Yash Warulkar%' AND systemPrompt NOT LIKE '%Chief Technology Officer%')
        `, [DEFAULT_SYSTEM_PROMPT]).catch(() => undefined);
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

        await this.dataSource.query(`
          UPDATE ai_auto_reply_rules
          SET "systemPrompt" = $1
          WHERE "systemPrompt" IS NULL
             OR "systemPrompt" = ''
             OR "systemPrompt" LIKE '%Jai Industrial Infrastructure%'
             OR ("systemPrompt" LIKE '%Yash Warulkar%' AND "systemPrompt" NOT LIKE '%Chief Technology Officer%')
        `, [DEFAULT_SYSTEM_PROMPT]).catch(() => undefined);
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

    // 2. Prevent duplicate processing of the same incoming WhatsApp message ID
    const msgId = incoming.id || (incoming as any).waMessageId;
    if (msgId) {
      if (this.processedMessageIds.has(msgId)) {
        this.logger.debug(`Message ${msgId} already processed by AI auto-reply, skipping duplicate trigger`);
        return;
      }
      this.processedMessageIds.set(msgId, Date.now());
    }

    // 3. Skip non-text or broadcast / newsletter channels
    const body = incoming.body?.trim();
    if (!body) {
      return;
    }
    const rawChatId = incoming.chatId;
    if (!rawChatId || rawChatId.endsWith('@g.us') || rawChatId.endsWith('@newsletter') || rawChatId.endsWith('@broadcast')) {
      return; // Skip group chats, newsletters, broadcasts
    }

    const neutralChatId = toNeutralJid(rawChatId);

    // 4. Find active rules for this session or global '*'
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

      // Check cooldown using neutral chat ID
      const cooldownKey = `${rule.id}:${neutralChatId}`;
      const now = Date.now();
      const lastSent = this.cooldownTracker.get(cooldownKey) || 0;
      const cooldownMs = (rule.cooldownSeconds || 10) * 1000;

      if (now - lastSent < cooldownMs) {
        this.logger.debug(
          `AI auto-reply for ${neutralChatId} on rule "${rule.name}" is on cooldown (${Math.ceil(
            (cooldownMs - (now - lastSent)) / 1000,
          )}s remaining)`,
        );
        continue;
      }

      // Dedupe against unreplied background scanner
      const incomingTs = incoming.timestamp ?? Math.floor(now / 1000);
      const dedupeKey = `unreplied_${sessionId}_${neutralChatId}_${incomingTs}`;
      if (this.cooldownTracker.has(dedupeKey)) {
        this.logger.debug(`Message timestamp ${incomingTs} already handled for ${neutralChatId}`);
        continue;
      }

      // Mark timestamps in cooldown and timestamp tracker
      this.cooldownTracker.set(cooldownKey, now);
      this.cooldownTracker.set(dedupeKey, now);
      this.lastProcessedMessageTimestamp.set(`${sessionId}:${neutralChatId}`, incomingTs);

      // Trigger AI reply
      await this.executeAiReply(sessionId, rule, rawChatId, body);
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

        // If effectiveSender is still an unresolved lid, attempt proactive resolution via engine
        const isLid = incoming.chatId?.includes('@lid') || (incoming.from && incoming.from.includes('@lid'));
        const incomingLid = (incoming.chatId?.includes('@lid') ? incoming.chatId : incoming.from || '')
          .replace(/@.*$/, '')
          .trim();

        if (isLid && effectiveSender.length > 13) {
          try {
            const engine = this.sessionService.getEngine(sessionId);
            if (engine && typeof (engine as any).resolveContactLid === 'function') {
              for (const n of numbers) {
                const { phone: clean } = parseRuleContactEntry(n);
                if (clean.length >= 10) {
                  const resolvedLid = await (engine as any).resolveContactLid(clean);
                  if (
                    resolvedLid &&
                    (resolvedLid.includes(incomingLid) || incomingLid.includes(resolvedLid.replace(/@.*$/, '')))
                  ) {
                    effectiveSender = clean;
                    break;
                  }
                }
              }
            }
          } catch {
            // ignore
          }
        }

        return numbers.some(n => {
          const { phone: cleanTarget, name: targetName } = parseRuleContactEntry(n);
          if (!cleanTarget && !targetName) {
            const raw = n.trim();
            if (!raw) return false;
            const pushName = incoming.contact?.pushName || incoming.contact?.name || '';
            return pushName.toLowerCase().includes(raw.toLowerCase());
          }

          if (cleanTarget) {
            const numberMatch =
              cleanTarget === effectiveSender ||
              cleanTarget === senderNumber ||
              (cleanTarget.length >= 10 && effectiveSender.endsWith(cleanTarget)) ||
              (effectiveSender.length >= 10 && cleanTarget.endsWith(effectiveSender));

            const chatIdMatch = incoming.chatId ? incoming.chatId.includes(cleanTarget) : false;

            if (numberMatch || chatIdMatch) return true;
          }

          if (targetName) {
            const pushName = incoming.contact?.pushName || incoming.contact?.name || '';
            if (pushName && pushName.toLowerCase().includes(targetName.toLowerCase())) {
              return true;
            }
          }

          return false;
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
    const neutralChatId = toNeutralJid(chatId);
    const lockKey = `${sessionId}:${neutralChatId}`;

    if (this.inFlightReplies.has(lockKey)) {
      this.logger.warn(`AI auto-reply already in-flight for ${lockKey}, skipping duplicate concurrent dispatch`);
      return;
    }
    this.inFlightReplies.add(lockKey);

    try {
      const engine = this.sessionService.getEngine(sessionId);
      if (!engine) {
        this.logger.warn(`Cannot send AI auto-reply: Session '${sessionId}' is not active`);
        return;
      }

      // 1. Send typing presence state
      await engine.sendChatState(chatId, 'typing').catch(() => undefined);
      if (neutralChatId !== chatId) {
        await engine.sendChatState(neutralChatId, 'typing').catch(() => undefined);
      }

      // 2. Track 15-minute conversation session window
      const chatSessionKey = `${sessionId}:${neutralChatId}`;
      let lastInteraction = this.chatLastInteractionTime.get(chatSessionKey) || 0;

      if (!lastInteraction) {
        try {
          const variants = [
            neutralChatId,
            neutralChatId.replace(/@c\.us$/, '@s.whatsapp.net'),
            neutralChatId.replace(/@s\.whatsapp\.net$/, '@c.us'),
          ];
          const lastOutgoing = await this.messageRepository
            .createQueryBuilder('m')
            .where('m.sessionId = :sessionId', { sessionId })
            .andWhere('m.chatId IN (:...variants)', { variants })
            .andWhere('m.direction = :dir', { dir: MessageDirection.OUTGOING })
            .orderBy('m.timestamp', 'DESC')
            .addOrderBy('m.createdAt', 'DESC')
            .take(1)
            .getOne();

          if (lastOutgoing) {
            const outgoingMs = lastOutgoing.timestamp
              ? lastOutgoing.timestamp * 1000
              : lastOutgoing.createdAt?.getTime() || 0;
            if (outgoingMs > 0) {
              lastInteraction = outgoingMs;
              this.chatLastInteractionTime.set(chatSessionKey, outgoingMs);
            }
          }
        } catch {
          // ignore lookup error
        }
      }

      const now = Date.now();
      const isNewSession = !lastInteraction || now - lastInteraction >= CONVERSATION_SESSION_WINDOW_MS;

      // 3. Call Innovara AI endpoint
      const aiEndpoint = rule.aiEndpoint || DEFAULT_AI_ENDPOINT;
      const aiKey = rule.aiApiKey || DEFAULT_AI_KEY;
      const conversationId = `wa_${sessionId}_${neutralChatId.replace(/\D/g, '')}`;

      const payload: Record<string, unknown> = {
        message: userMessage,
        conversation_id: conversationId,
        use_knowledge: false,
        use_history: false,
        max_tokens: rule.maxTokens && rule.maxTokens >= 50 ? rule.maxTokens : 180,
      };

      const baseSystemPrompt = rule.systemPrompt && rule.systemPrompt.trim()
        ? rule.systemPrompt.trim()
        : DEFAULT_SYSTEM_PROMPT;

      if (isNewSession) {
        payload.system_prompt = `${baseSystemPrompt}\n\n[CONVERSATION SESSION CONTEXT]: This is the start of a new conversation session (user has been idle for >15 minutes or this is a new chat). You MUST begin your response by warmly introducing yourself as SAMM, personal AI assistant for Yash Warulkar (Co-Founder & CTO of Innovara Dynamics), before addressing or answering the contact's message.`;
      } else {
        payload.system_prompt = `${baseSystemPrompt}\n\n[CONVERSATION SESSION CONTEXT]: This is an ongoing conversation within the active 15-minute session window. Do NOT repeat your name or formal self-introduction; reply directly and conversationally to the user's message.`;
      }

      this.logger.log(
        `Invoking AI for chat ${chatId} (${isNewSession ? 'NEW 15-min session' : 'active session'}) using endpoint ${aiEndpoint}`,
      );

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
      reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      if (!reply) {
        this.logger.warn(`AI returned empty response for chat ${chatId}`);
        return;
      }

      // Enforce the 15-minute session introduction rule reliably
      if (isNewSession) {
        const lowerReply = reply.toLowerCase();
        const hasSelfIntro =
          lowerReply.includes('samm') ||
          lowerReply.includes('ai assistant') ||
          lowerReply.includes('assistant for yash') ||
          lowerReply.includes('yash warulkar');

        if (!hasSelfIntro) {
          reply = `Hello! I am SAMM, AI assistant for Yash Warulkar (Co-Founder & CTO of Innovara Dynamics). ${reply}`;
        }
      } else {
        // Strip repeated introductory greeting if echoed during active ongoing conversation
        reply = reply.replace(/^(hello|hi|hey)!\s*i am samm[^.!?]*[.!?]\s*/i, '').trim();
        reply = reply.replace(/^i am samm[^.!?]*[.!?]\s*/i, '').trim();
        if (!reply) {
          reply = data.response || 'I am here to help!';
        }
      }

      // 4. Send reply through MessageService (persists + simulates typing)
      await this.messageService.sendText(sessionId, {
        chatId,
        text: reply,
      });

      // 5. Immediately mark as seen on WhatsApp engine to prevent stale unread flags
      await engine.sendSeen(chatId).catch(() => undefined);
      if (neutralChatId !== chatId) {
        await engine.sendSeen(neutralChatId).catch(() => undefined);
      }

      // 6. Update interaction timestamp and counter
      this.chatLastInteractionTime.set(chatSessionKey, Date.now());
      await this.ruleRepository.increment({ id: rule.id }, 'totalRepliesSent', 1);

      this.logger.log(`AI Auto-Reply sent to ${chatId} (${reply.slice(0, 60)}...)`);
    } catch (err) {
      this.logger.error(`Failed to execute AI auto-reply for ${chatId}: ${String(err)}`);
    } finally {
      this.inFlightReplies.delete(lockKey);
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

      const testPrompt = dto.systemPrompt && dto.systemPrompt.trim()
        ? dto.systemPrompt.trim()
        : DEFAULT_SYSTEM_PROMPT;
      payload.system_prompt = testPrompt;

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
          allChatIds.add(toNeutralJid(c.id));
        }
      }
      for (const r of dbRecentChatIds) {
        if (r.chatId && !r.chatId.endsWith('@g.us') && !r.chatId.endsWith('@broadcast') && !r.chatId.endsWith('@newsletter')) {
          allChatIds.add(toNeutralJid(r.chatId));
        }
      }

      // 5. Inspect each candidate chat
      for (const neutralChatId of allChatIds) {
        const rawVariants = [
          neutralChatId,
          neutralChatId.replace(/@c\.us$/, '@s.whatsapp.net'),
          neutralChatId.replace(/@s\.whatsapp\.net$/, '@c.us'),
        ];

        const engineChat = engineChats.find(
          c => rawVariants.includes(c.id) || toNeutralJid(c.id) === neutralChatId,
        );
        const unreadCount = engineChat?.unreadCount ?? 0;

        // Fetch recent messages for this chat (newest first) matching any dialect variant
        const recentMessages = await this.messageRepository
          .createQueryBuilder('m')
          .where('m.sessionId = :sessionId', { sessionId: session.id })
          .andWhere('m.chatId IN (:...variants)', { variants: rawVariants })
          .orderBy('m.timestamp', 'DESC')
          .addOrderBy('m.createdAt', 'DESC')
          .take(10)
          .getMany();

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

        // Check if live handler already processed this timestamp
        const lastProcessedTs = this.lastProcessedMessageTimestamp.get(`${session.id}:${neutralChatId}`) || 0;
        if (incomingTimestamp > 0 && incomingTimestamp <= lastProcessedTs) {
          continue;
        }

        let senderPhone = neutralChatId.replace(/@.*$/, '').replace(/\D/g, '');
        let contactName = engineChat?.name || senderPhone;

        if (neutralChatId.includes('@lid')) {
          const resolved = await this.resolveLidPhone(session.id, neutralChatId);
          if (resolved) {
            senderPhone = resolved;
            if (!engineChat?.name || engineChat.name === neutralChatId.replace(/@.*$/, '')) {
              contactName = resolved;
            }
          }
        }

        // Match against active rules
        for (const rule of rules) {
          const dummyIncoming: IncomingMessage = {
            id: `scan_${Date.now()}`,
            chatId: neutralChatId,
            from: neutralChatId,
            to: session.phone || '',
            body: incomingText,
            timestamp: incomingTimestamp,
            fromMe: false,
            isGroup: false,
            type: 'text',
            senderPhone: senderPhone !== neutralChatId.replace(/@.*$/, '').replace(/\D/g, '') ? senderPhone : undefined,
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
              chatId: neutralChatId,
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
      const neutralChatId = toNeutralJid(item.chatId);
      const cooldownKey = `${item.ruleId}:${neutralChatId}`;
      const dedupeKey = `unreplied_${item.sessionId}_${neutralChatId}_${item.lastMessageTimestamp}`;
      const now = Date.now();
      const lastSent = this.cooldownTracker.get(cooldownKey) || 0;

      const rule = await this.ruleRepository.findOne({ where: { id: item.ruleId } });
      if (!rule || !rule.enabled) continue;

      const cooldownMs = (rule.cooldownSeconds || 10) * 1000;
      if (now - lastSent < cooldownMs) {
        this.logger.debug(`Skipping unreplied chat ${neutralChatId} due to active cooldown`);
        continue;
      }

      if (this.cooldownTracker.has(dedupeKey)) {
        this.logger.debug(`Skipping unreplied chat ${neutralChatId} - already replied to message timestamp ${item.lastMessageTimestamp}`);
        continue;
      }

      this.cooldownTracker.set(cooldownKey, now);
      this.cooldownTracker.set(dedupeKey, now);
      this.lastProcessedMessageTimestamp.set(`${item.sessionId}:${neutralChatId}`, item.lastMessageTimestamp);

      const start = Date.now();
      try {
        await this.executeAiReply(item.sessionId, rule, neutralChatId, item.lastMessageText);
        const engine = this.sessionService.getEngine(item.sessionId);
        if (engine) {
          await engine.sendSeen(neutralChatId).catch(() => undefined);
          if (item.chatId !== neutralChatId) {
            await engine.sendSeen(item.chatId).catch(() => undefined);
          }
        }

        summary.repliesDispatched++;
        summary.details.push({
          chatId: neutralChatId,
          contactName: item.contactName,
          senderPhone: item.senderPhone,
          incomingText: item.lastMessageText,
          ruleName: item.ruleName,
          success: true,
          durationMs: Date.now() - start,
        });
      } catch (err: any) {
        summary.details.push({
          chatId: neutralChatId,
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
