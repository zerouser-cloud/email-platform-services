import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MESSAGING_HEALTH } from './messaging.constants';
import { MessagingHealthIndicator } from './messaging.health';

/**
 * MessagingModule (Phase 999.12.1 D-08) — Symbol-DI registration for the
 * MESSAGING_HEALTH indicator. Mirrors CacheModule.forRootAsync skeleton
 * (no options yet — 999.13 will add queue/connection config when the real
 * amqplib adapter lands).
 */
@Module({})
export class MessagingModule {
  static forRootAsync(): DynamicModule {
    const messagingHealthProvider: Provider = {
      provide: MESSAGING_HEALTH,
      useExisting: MessagingHealthIndicator,
    };
    return {
      module: MessagingModule,
      imports: [TerminusModule],
      providers: [MessagingHealthIndicator, messagingHealthProvider],
      exports: [TerminusModule, MESSAGING_HEALTH],
    };
  }
}
