import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { LoggingModule, GrpcToHttpExceptionFilter } from '@email-platform/foundation';
import { GatewayConfigModule } from './infrastructure/bootstrap/config';
import { HealthModule } from './infrastructure/bootstrap/health';
import { ThrottleModule } from './infrastructure/bootstrap/throttle';
import { AppCacheModule } from './infrastructure/outbound/cache';
import { GrpcClientsModule } from './infrastructure/outbound/grpc-clients';

@Module({
  imports: [
    // @Global() config module — MUST precede any foundation module that uses
    // nested `SomeExternalModule.forRootAsync({inject: [CONFIG_PORT]})` (Plan 10 Rule 3 fix).
    GatewayConfigModule,
    HealthModule,
    // Phase 999.12 D-05/D-13: AppCacheModule MUST appear BEFORE ThrottleModule.
    // NestJS resolves module dependencies in declaration order; Plan 10's
    // ThrottleModule migration injects REDIS_CLIENT via inject:[..., REDIS_CLIENT]
    // and that token is provided transitively by AppCacheModule. Reordering
    // breaks DI resolution at boot. Foundation modules are NOT @Global()
    // (PATTERNS §S-G), so import order is load-bearing.
    AppCacheModule,
    ThrottleModule,
    LoggingModule.forHttpAsync('gateway'),
    GrpcClientsModule,
  ],
  controllers: [],
  providers: [GrpcToHttpExceptionFilter],
})
export class GatewayModule implements OnModuleDestroy {
  private readonly logger = new Logger(GatewayModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down gateway service...');
    // TODO: drain HTTP server connections
  }
}
