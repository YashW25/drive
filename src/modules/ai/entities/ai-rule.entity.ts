import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { jsonColumnType } from '../../../common/utils/column-types';

export enum AiTriggerType {
  ALL = 'all',
  SPECIFIC = 'specific',
  UNKNOWN_ONLY = 'unknown_only',
  CUSTOM_KEYWORD = 'custom_keyword',
}

@Entity('ai_auto_reply_rules')
export class AiAutoReplyRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  /** Session ID to monitor, or '*' for all sessions */
  @Column({ type: 'varchar', length: 255, default: '*' })
  sessionId: string;

  /** Human-readable session name or '*' */
  @Column({ type: 'varchar', length: 255, default: 'All Sessions' })
  sessionName: string;

  /**
   * Filter condition:
   * - 'all': reply to all 1-on-1 chats
   * - 'specific': reply only to numbers in `specificNumbers`
   * - 'unknown_only': reply only to numbers NOT in saved contacts
   * - 'custom_keyword': reply only if message contains any `customKeywords`
   */
  @Column({ type: 'varchar', length: 50, default: AiTriggerType.ALL })
  triggerType: AiTriggerType;

  /** List of phone numbers to trigger on (when triggerType = specific) */
  @Column({ type: jsonColumnType(), default: '[]' })
  specificNumbers: string[];

  /** List of keywords or phrases to trigger on (when triggerType = custom_keyword) */
  @Column({ type: jsonColumnType(), default: '[]' })
  customKeywords: string[];

  /** AI Endpoint to call */
  @Column({ type: 'varchar', length: 2048, default: 'https://ai.innovaradynamics.in/v1/chat' })
  aiEndpoint: string;

  /** AI API Key for Authorization */
  @Column({ type: 'varchar', length: 255, default: 'inv_EKnXYFij82V2noa9udqJ3zA6pjqXIxvI8md_AoER838' })
  aiApiKey: string;

  /** Optional custom system prompt or persona instructions */
  @Column({ type: 'text', nullable: true })
  systemPrompt: string | null;

  /** Minimum seconds to wait before replying to the same contact again */
  @Column({ type: 'int', default: 10 })
  cooldownSeconds: number;

  /** Max completion tokens */
  @Column({ type: 'int', default: 80 })
  maxTokens: number;

  /** Counter of replies sent */
  @Column({ type: 'int', default: 0 })
  totalRepliesSent: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ownerSupabaseId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
