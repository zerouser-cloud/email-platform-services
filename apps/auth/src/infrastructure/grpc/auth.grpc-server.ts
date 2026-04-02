import { Controller, Inject, NotImplementedException } from '@nestjs/common';
import { AuthProto } from '@email-platform/contracts';
import { LoginPort } from '../../application/ports/inbound/login.port';

@Controller()
@AuthProto.AuthServiceControllerMethods()
export class AuthGrpcServer implements AuthProto.AuthServiceController {
  constructor(
    @Inject('LoginPort') private readonly loginPort: LoginPort,
  ) {}

  async healthCheck(
    _request: AuthProto.Empty,
  ): Promise<AuthProto.HealthStatus> {
    throw new NotImplementedException('healthCheck not yet implemented');
  }

  async login(
    _request: AuthProto.LoginRequest,
  ): Promise<AuthProto.TokenPair> {
    throw new NotImplementedException('login not yet implemented');
  }

  async refreshToken(
    _request: AuthProto.RefreshRequest,
  ): Promise<AuthProto.TokenPair> {
    throw new NotImplementedException('refreshToken not yet implemented');
  }

  async validateToken(
    _request: AuthProto.ValidateRequest,
  ): Promise<AuthProto.UserContext> {
    throw new NotImplementedException('validateToken not yet implemented');
  }

  async revokeToken(
    _request: AuthProto.RevokeRequest,
  ): Promise<AuthProto.Empty> {
    throw new NotImplementedException('revokeToken not yet implemented');
  }

  async createUser(
    _request: AuthProto.CreateUserRequest,
  ): Promise<AuthProto.User> {
    throw new NotImplementedException('createUser not yet implemented');
  }

  async listUsers(
    _request: AuthProto.ListUsersRequest,
  ): Promise<AuthProto.UserList> {
    throw new NotImplementedException('listUsers not yet implemented');
  }
}
