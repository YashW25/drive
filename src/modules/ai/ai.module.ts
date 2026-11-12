import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAutoReplyRule } from './entities/ai-rule.entity';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { SessionModule } from '../session/session.module';
import { MessageModule } from '../message/message.module';
import { HooksModule } from '../../core/hooks';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiAutoReplyRule], 'data'),
    SessionModule,
    MessageModule,
    HooksModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
