import { Controller, Inject } from '@nestjs/common';
import { AuthProto, CommonProto } from '@email-platform/contracts';
import type { LoginPort } from '../../../application/ports/inbound/login.port';
import type { RefreshTokenPort } from '../../../application/ports/inbound/refresh-token.port';
import type { ValidateTokenPort } from '../../../application/ports/inbound/validate-token.port';
import type { RevokeTokenPort } from '../../../application/ports/inbound/revoke-token.port';
import type { CreateUserPort } from '../../../application/ports/inbound/create-user.port';
import type { ListUsersPort } from '../../../application/ports/inbound/list-users.port';
import { LoginCommand } from '../../../application/commands/login.command';
import { RefreshTokenCommand } from '../../../application/commands/refresh-token.command';
import { ValidateTokenCommand } from '../../../application/commands/validate-token.command';
import { RevokeTokenCommand } from '../../../application/commands/revoke-token.command';
import { CreateUserCommand } from '../../../application/commands/create-user.command';
import { ListUsersCommand } from '../../../application/commands/list-users.command';
import { HEALTH } from '@email-platform/foundation';
import {
  LOGIN_PORT,
  REFRESH_TOKEN_PORT,
  VALIDATE_TOKEN_PORT,
  REVOKE_TOKEN_PORT,
  CREATE_USER_PORT,
  LIST_USERS_PORT,
  PAGINATION_DEFAULTS,
} from '../../../auth.constants';

@Controller()
@AuthProto.AuthServiceControllerMethods()
export class AuthController implements AuthProto.AuthServiceController {
  constructor(
    @Inject(LOGIN_PORT) private readonly loginService: LoginPort,
    @Inject(REFRESH_TOKEN_PORT) private readonly refreshTokenService: RefreshTokenPort,
    @Inject(VALIDATE_TOKEN_PORT) private readonly validateTokenService: ValidateTokenPort,
    @Inject(REVOKE_TOKEN_PORT) private readonly revokeTokenService: RevokeTokenPort,
    @Inject(CREATE_USER_PORT) private readonly createUserService: CreateUserPort,
    @Inject(LIST_USERS_PORT) private readonly listUsersService: ListUsersPort,
  ) {}

  async healthCheck(_request: CommonProto.Empty): Promise<CommonProto.HealthStatus> {
    // D-14: REST probe is the standard; gRPC health uses grpc-health-check protocol
    // registered in main.ts via createGrpcServerOptions. Stub here is acceptable.
    return { status: HEALTH.GRPC_STATUS_SERVING };
  }

  async login(req: AuthProto.LoginRequest): Promise<AuthProto.TokenPair> {
    const cmd = new LoginCommand(req.email, req.password);
    const result = await this.loginService.execute(cmd);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  async refreshToken(req: AuthProto.RefreshRequest): Promise<AuthProto.TokenPair> {
    const cmd = new RefreshTokenCommand(req.refreshToken);
    const result = await this.refreshTokenService.execute(cmd);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  async validateToken(req: AuthProto.ValidateRequest): Promise<AuthProto.UserContext> {
    const cmd = new ValidateTokenCommand(req.accessToken);
    const result = await this.validateTokenService.execute(cmd);
    return {
      userId: result.userId,
      role: result.role,
      organization: result.organization,
      team: result.team,
    };
  }

  async revokeToken(req: AuthProto.RevokeRequest): Promise<CommonProto.Empty> {
    const cmd = new RevokeTokenCommand(req.refreshToken);
    await this.revokeTokenService.execute(cmd);
    return {};
  }

  async createUser(req: AuthProto.CreateUserRequest): Promise<AuthProto.User> {
    const cmd = new CreateUserCommand(
      req.email,
      req.password,
      req.role,
      req.organization,
      req.team,
    );
    const result = await this.createUserService.execute(cmd);
    return {
      id: result.id,
      email: result.email,
      role: result.role,
      organization: result.organization,
      team: result.team,
      createdAt: result.createdAt,
    };
  }

  async listUsers(req: AuthProto.ListUsersRequest): Promise<AuthProto.UserList> {
    const page = req.pagination?.page ?? PAGINATION_DEFAULTS.PAGE;
    const limit = req.pagination?.limit ?? PAGINATION_DEFAULTS.LIMIT;
    const cmd = new ListUsersCommand(page, limit);
    const result = await this.listUsersService.execute(cmd);
    return {
      users: result.users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        organization: u.organization,
        team: u.team,
        createdAt: u.createdAt,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    };
  }
}
