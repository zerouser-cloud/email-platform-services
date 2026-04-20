import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { LoggingModule } from '@email-platform/foundation';
import { AuthConfigModule } from './infrastructure/bootstrap/config';
import { HealthModule } from './infrastructure/bootstrap/health';
import { GrpcModule } from './infrastructure/inbound/grpc';
import { AppPersistenceModule } from './infrastructure/outbound/persistence';
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
// DI tokens (domain ports — D-11b: kept at root)
import {
  LOGIN_PORT,
  REFRESH_TOKEN_PORT,
  VALIDATE_TOKEN_PORT,
  REVOKE_TOKEN_PORT,
  CREATE_USER_PORT,
  LIST_USERS_PORT,
} from './auth.constants';

@Module({
  imports: [
    // @Global() config module — MUST precede any foundation module that uses
    // nested `SomeExternalModule.forRootAsync({inject: [CONFIG_PORT]})` (Plan 10 Rule 3 fix).
    AuthConfigModule.forRoot(),
    HealthModule,
    LoggingModule.forGrpcAsync('auth'),
    AppPersistenceModule,
    GrpcModule,
  ],
  controllers: [],
  providers: [
    // Zone 2: Inbound ports → services (D-02 per-feature).
    // Outbound USER_REPOSITORY_PORT binding owned by UserModule (outbound/persistence/user).
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
