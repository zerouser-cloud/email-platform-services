import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AppPersistenceModule } from '../../outbound/persistence';
// Services (inbound port adapters)
import { LoginService } from '../../../application/services/login.service';
import { RefreshTokenService } from '../../../application/services/refresh-token.service';
import { ValidateTokenService } from '../../../application/services/validate-token.service';
import { RevokeTokenService } from '../../../application/services/revoke-token.service';
import { CreateUserService } from '../../../application/services/create-user.service';
import { ListUsersService } from '../../../application/services/list-users.service';
// Use cases (plain injectables, type-injected via constructor)
import { VerifyCredentialsUseCase } from '../../../application/use-cases/verify-credentials.use-case';
import { IssueTokenPairUseCase } from '../../../application/use-cases/issue-token-pair.use-case';
import { ValidateRefreshTokenUseCase } from '../../../application/use-cases/validate-refresh-token.use-case';
import { VerifyAccessTokenUseCase } from '../../../application/use-cases/verify-access-token.use-case';
import { RevokeRefreshTokenUseCase } from '../../../application/use-cases/revoke-refresh-token.use-case';
import { HashPasswordUseCase } from '../../../application/use-cases/hash-password.use-case';
import { PersistUserUseCase } from '../../../application/use-cases/persist-user.use-case';
import { ListUsersUseCase } from '../../../application/use-cases/list-users.use-case';
// DI tokens (inbound ports — D-11b: kept at root)
import {
  LOGIN_PORT,
  REFRESH_TOKEN_PORT,
  VALIDATE_TOKEN_PORT,
  REVOKE_TOKEN_PORT,
  CREATE_USER_PORT,
  LIST_USERS_PORT,
} from '../../../auth.constants';

/**
 * Inbound gRPC composer (Phase 999.11.2 D-03, D-06).
 *
 * Owns the gRPC controller AND the port → service bindings the controller
 * consumes (Phase 999.11.2 Plan 10 DI-regression fix, Option A): cohesive with
 * hexagonal D-02 — the inbound adapter module owns the inbound port bindings it
 * drives. Use-case providers and outbound `AppPersistenceModule` are declared
 * here so the controller's transitive dependencies (Service → UseCase →
 * Repository) resolve inside this module's DI scope.
 */
@Module({
  imports: [AppPersistenceModule],
  controllers: [AuthController],
  providers: [
    // Inbound ports → services (D-02 per-feature).
    { provide: LOGIN_PORT, useClass: LoginService },
    { provide: REFRESH_TOKEN_PORT, useClass: RefreshTokenService },
    { provide: VALIDATE_TOKEN_PORT, useClass: ValidateTokenService },
    { provide: REVOKE_TOKEN_PORT, useClass: RevokeTokenService },
    { provide: CREATE_USER_PORT, useClass: CreateUserService },
    { provide: LIST_USERS_PORT, useClass: ListUsersService },

    // Use cases — plain @Injectable providers (no Symbol tokens — type-injected)
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
export class GrpcModule {}
