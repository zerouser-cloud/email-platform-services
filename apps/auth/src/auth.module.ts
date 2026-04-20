import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import {
  LoggingModule,
  PersistenceModule,
  LOGGING_CONFIG_PORT,
  PERSISTENCE_CONFIG_PORT,
  type LoggingConfig,
  type PersistenceConfig,
} from '@email-platform/foundation';
import { AuthEnvSchema, authConfigProvider, type AuthEnv } from './infrastructure/config';
import { AuthController } from './infrastructure/controllers/grpc/auth.controller';
import { HealthController } from './infrastructure/controllers/rest/health.controller';
import { PgUserRepository } from './infrastructure/persistence/pg-user.repository';
// Services (inbound port adapters)
import { LoginService } from './application/services/login.service';
import { RefreshTokenService } from './application/services/refresh-token.service';
import { ValidateTokenService } from './application/services/validate-token.service';
import { RevokeTokenService } from './application/services/revoke-token.service';
import { CreateUserService } from './application/services/create-user.service';
import { ListUsersService } from './application/services/list-users.service';
// Use cases (plain injectables, no tokens)
import { VerifyCredentialsUseCase } from './application/use-cases/verify-credentials.use-case';
import { IssueTokenPairUseCase } from './application/use-cases/issue-token-pair.use-case';
import { ValidateRefreshTokenUseCase } from './application/use-cases/validate-refresh-token.use-case';
import { VerifyAccessTokenUseCase } from './application/use-cases/verify-access-token.use-case';
import { RevokeRefreshTokenUseCase } from './application/use-cases/revoke-refresh-token.use-case';
import { HashPasswordUseCase } from './application/use-cases/hash-password.use-case';
import { PersistUserUseCase } from './application/use-cases/persist-user.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case';
// DI tokens
import {
  USER_REPOSITORY_PORT,
  LOGIN_PORT,
  REFRESH_TOKEN_PORT,
  VALIDATE_TOKEN_PORT,
  REVOKE_TOKEN_PORT,
  CREATE_USER_PORT,
  LIST_USERS_PORT,
  AUTH_CONFIG,
} from './auth.constants';

@Module({
  imports: [
    AppConfigModule.forRoot(AuthEnvSchema),
    PersistenceModule.forRootAsync(),
    LoggingModule.forGrpcAsync('auth'),
  ],
  controllers: [AuthController, HealthController],
  providers: [
    authConfigProvider,

    // Canonical Config Access Contract (Phase 999.11.1 D-10) — narrow config slices.
    {
      provide: PERSISTENCE_CONFIG_PORT,
      useFactory: (c: AuthEnv): PersistenceConfig => ({ DATABASE_URL: c.DATABASE_URL }),
      inject: [AUTH_CONFIG],
    },
    {
      provide: LOGGING_CONFIG_PORT,
      useFactory: (c: AuthEnv): LoggingConfig => ({
        LOG_LEVEL: c.LOG_LEVEL,
        LOG_FORMAT: c.LOG_FORMAT,
      }),
      inject: [AUTH_CONFIG],
    },

    // Zone 1: Outbound port → adapter
    { provide: USER_REPOSITORY_PORT, useClass: PgUserRepository },

    // Zone 2: Inbound ports → services (D-02 per-feature)
    { provide: LOGIN_PORT, useClass: LoginService },
    { provide: REFRESH_TOKEN_PORT, useClass: RefreshTokenService },
    { provide: VALIDATE_TOKEN_PORT, useClass: ValidateTokenService },
    { provide: REVOKE_TOKEN_PORT, useClass: RevokeTokenService },
    { provide: CREATE_USER_PORT, useClass: CreateUserService },
    { provide: LIST_USERS_PORT, useClass: ListUsersService },

    // Zone 3: Use cases — plain @Injectable providers (no Symbol tokens — type-injected)
    VerifyCredentialsUseCase,
    IssueTokenPairUseCase,
    ValidateRefreshTokenUseCase,
    VerifyAccessTokenUseCase,
    RevokeRefreshTokenUseCase,
    HashPasswordUseCase,
    PersistUserUseCase,
    ListUsersUseCase,
  ],
})
export class AuthModule implements OnModuleDestroy {
  private readonly logger = new Logger(AuthModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down auth service...');
  }
}
