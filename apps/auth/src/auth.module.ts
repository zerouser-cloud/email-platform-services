import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { AuthEnvSchema } from './infrastructure/config';
import { LoggingModule, PersistenceModule } from '@email-platform/foundation';
import { AuthGrpcServer } from './infrastructure/grpc/auth.grpc-server';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { PgUserRepository } from './infrastructure/persistence/pg-user.repository';
import { HealthController } from './health/health.controller';
import { USER_REPOSITORY_PORT, LOGIN_PORT } from './auth.constants';

@Module({
  imports: [AppConfigModule.forRoot(AuthEnvSchema), PersistenceModule.forRootAsync(), LoggingModule.forGrpcAsync('auth')],
  controllers: [AuthGrpcServer, HealthController],
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
