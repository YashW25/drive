import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type * as BaileysLib from '@whiskeysockets/baileys';
import type { WAMessage } from '@whiskeysockets/baileys';
import { BaileysStoredMessage } from './baileys-stored-message.entity';
import { BaileysMessageStore } from '../types/baileys.types';
import { createLogger } from '../../common/services/logger.service';
import { Session } from '../../modules/session/entities/session.entity';
import { Message, MessageDirection } from '../../modules/message/entities/message.entity';

function positiveIntFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isMissingParentSessionError(err: unknown): boolean {
  const e = err as { code?: string; driverError?: { code?: string }; message?: string };
  const code = e?.driverError?.code ?? e?.code;
  if (code === '23503') {
    return true; // Postgres foreign_key_violation
  }
  const message = e?.message ?? '';
  if (typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT')) {
    return code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || /FOREIGN KEY/i.test(message);
  }
  return /FOREIGN KEY constraint failed/i.test(message);
}

@Injectable()
export class BaileysMessageStoreService implements BaileysMessageStore {
  private readonly logger = createLogger('BaileysMessageStore');
  /** Sessions already warned about a missing parent row — keeps the orphan log to once per session. */
  private readonly orphanWarnedSessions = new Set<string>();

  /** Lazily loaded @whiskeysockets/baileys module (ESM-only; loaded on first use, not at boot). */
  private baileysLib?: typeof BaileysLib;

  private async loadLib(): Promise<typeof BaileysLib> {
    return (this.baileysLib ??= await import('@whiskeysockets/baileys'));
  }

  constructor(
    @InjectRepository(BaileysStoredMessage, 'data')
    private readonly repo: Repository<BaileysStoredMessage>,
    @Optional()
    @InjectRepository(Session, 'data')
    private readonly sessionRepo?: Repository<Session>,
    @Optional()
    @InjectRepository(Message, 'data')
    private readonly messageRepo?: Repository<Message>,
  ) {}

  private async resolveSessionId(sessionId: string): Promise<string> {
    if (this.sessionRepo) {
      try {
        const s = await this.sessionRepo.findOne({
          where: [{ id: sessionId }, { name: sessionId }],
          select: ['id'],
        });
        if (s?.id) {
          return s.id;
        }
      } catch {
        // Fall back to provided sessionId
      }
    }
    return sessionId;
  }

  async put(sessionId: string, msg: WAMessage): Promise<void> {
    const waMessageId = msg.key?.id;
    if (!waMessageId) {
      return;
    }
    const resolvedSessionId = await this.resolveSessionId(sessionId);
    const { BufferJSON } = await this.loadLib();
    const serializedMessage = JSON.stringify(msg, BufferJSON.replacer);

    try {
      await this.repo.upsert(
        { sessionId: resolvedSessionId, waMessageId, serializedMessage, createdAt: new Date() },
        ['sessionId', 'waMessageId'],
      );
    } catch (err) {
      if (isMissingParentSessionError(err)) {
        if (!this.orphanWarnedSessions.has(resolvedSessionId)) {
          this.orphanWarnedSessions.add(resolvedSessionId);
          this.logger.warn(
            `No parent session row for "${resolvedSessionId}" — skipping Baileys message store (orphaned/recreated session). ` +
              `reply/forward/react/delete-by-id will be unavailable for messages received under this id.`,
          );
        }
        return;
      }
      throw err; // a genuine persistence failure — let the adapter's catch surface it
    }
    await this.enforceLimit(resolvedSessionId);
  }

  async getMessage(sessionId: string, messageId: string): Promise<WAMessage | null> {
    const resolvedSessionId = await this.resolveSessionId(sessionId);
    const row = await this.repo.findOne({
      where: [
        { sessionId: resolvedSessionId, waMessageId: messageId },
        { sessionId, waMessageId: messageId },
      ],
    });

    const { BufferJSON } = await this.loadLib();
    if (row?.serializedMessage) {
      try {
        return JSON.parse(row.serializedMessage, BufferJSON.reviver) as WAMessage;
      } catch {
        // fall through to fallback
      }
    }

    // Fall back to neutral messages table for retry re-encryption
    if (this.messageRepo) {
      try {
        const msgEntity = await this.messageRepo.findOne({
          where: [
            { sessionId: resolvedSessionId, waMessageId: messageId },
            { sessionId, waMessageId: messageId },
            { sessionId: resolvedSessionId, id: messageId },
            { sessionId, id: messageId },
          ],
        });
        if (msgEntity && msgEntity.body) {
          return {
            key: {
              id: msgEntity.waMessageId || msgEntity.id,
              remoteJid: msgEntity.chatId,
              fromMe: msgEntity.direction === MessageDirection.OUTGOING,
            },
            messageTimestamp: Math.floor(new Date(msgEntity.createdAt).getTime() / 1000),
            message: {
              conversation: msgEntity.body,
              extendedTextMessage: { text: msgEntity.body },
            },
          } as unknown as WAMessage;
        }
      } catch {
        // ignore fallback error
      }
    }

    return null;
  }

  async clearSession(sessionId: string): Promise<void> {
    const resolvedSessionId = await this.resolveSessionId(sessionId);
    await this.repo.delete({ sessionId: resolvedSessionId });
    if (resolvedSessionId !== sessionId) {
      await this.repo.delete({ sessionId });
    }
  }

  /** Per-session row cap: keep the newest N, delete the rest. Deterministic via (createdAt, id). */
  private async enforceLimit(sessionId: string): Promise<void> {
    const limit = positiveIntFromEnv('BAILEYS_MESSAGE_STORE_LIMIT', 5000);
    const cutoff = await this.repo.find({
      where: { sessionId },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: limit,
      take: 1,
      select: ['id', 'createdAt'],
    });
    if (cutoff.length === 0) {
      return; // under the cap — nothing to evict
    }
    const { id, createdAt } = cutoff[0];
    await this.repo
      .createQueryBuilder()
      .delete()
      .where('sessionId = :sessionId', { sessionId })
      .andWhere('(createdAt < :createdAt OR (createdAt = :createdAt AND id <= :id))', { createdAt, id })
      .execute();
  }
}
