import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, OneToOne, JoinColumn } from 'typeorm';
import { ApiKey } from './api-key.entity';
import { Session } from '../../session/entities/session.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  supabaseId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @OneToMany(() => ApiKey, apiKey => apiKey.user)
  apiKeys: ApiKey[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
