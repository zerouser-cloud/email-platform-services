import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { LoggingModule } from '@email-platform/foundation';
import { AuthConfigModule } from './infrastructure/bootstrap/config';
import { HealthModule } from './infrastructure/bootstrap/health';
import { GrpcModule } from './infrastructure/inbound/grpc';

@Module({
  imports: [
    // @Global() config module — MUST precede any foundation module that uses
    // nested `SomeExternalModule.forRootAsync({inject: [CONFIG_PORT]})` (Plan 10 Rule 3 fix).
    AuthConfigModule,
    HealthModule,
    LoggingModule.forGrpcAsync('auth'),
    // GrpcModule owns inbound port → service bindings + use-cases + outbound
    // AppPersistenceModule (Plan 10 Option A — cohesion with D-02).
    GrpcModule,
  ],
  controllers: [],
  providers: [],
})
export class AuthModule implements OnModuleDestroy {
  private readonly logger = new Logger(AuthModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down auth service...');
  }
}
