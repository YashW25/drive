import { MiddlewareConsumer, NestModule } from '@nestjs/common';
export declare class HeartbeatModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void;
}
