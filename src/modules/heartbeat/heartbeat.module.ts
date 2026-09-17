import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeartbeatService } from './heartbeat.service';
import { HeartbeatMiddleware } from './heartbeat.middleware';
import { Session } from '../session/entities/session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session], 'data')
  ],
  providers: [HeartbeatService],
  exports: [HeartbeatService],
})
export class HeartbeatModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HeartbeatMiddleware).forRoutes('*');
  }
}
