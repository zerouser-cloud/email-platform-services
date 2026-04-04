import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { LoggingModule, PersistenceModule } from '@email-platform/foundation';
import { AuthGrpcServer } from './infrastructure/grpc/auth.grpc-server';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { PgUserRepository } from './infrastructure/persistence/pg-user.repository';
import { HealthModule } from './health/health.module';

export const USER_REPOSITORY_PORT = 'UserRepositoryPort';
export const LOGIN_PORT = 'LoginPort';

@Module({
  imports: [
    AppConfigModule,
    PersistenceModule.forRootAsync(),
    LoggingModule.forGrpcAsync('auth'),
    HealthModule,
  ],
  controllers: [AuthGrpcServer],
  providers: [
    { provide: USER_REPOSITORY_PORT, useClass: PgUserRepository },
    { provide: LOGIN_PORT, useClass: LoginUseCase },
  ],
})
export class AuthModule implements OnModuleDestroy {
  private readonly logger = new Logger(AuthModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down auth service...');
    // TODO: drain gRPC server connections
  }
}
