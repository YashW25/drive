import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EngineFactory } from './engine.factory';
import { BaileysStoredMessage } from './adapters/baileys-stored-message.entity';
import { BaileysMessageStoreService } from './adapters/baileys-message-store.service';
import { LidMapping } from './identity/lid-mapping.entity';
import { LidMappingStoreService } from './identity/lid-mapping-store.service';
import { Session } from '../modules/session/entities/session.entity';
import { Message } from '../modules/message/entities/message.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([BaileysStoredMessage, LidMapping, Session, Message], 'data')],
  providers: [EngineFactory, BaileysMessageStoreService, LidMappingStoreService],
  exports: [EngineFactory, LidMappingStoreService, BaileysMessageStoreService],
})
export class EngineModule {}
