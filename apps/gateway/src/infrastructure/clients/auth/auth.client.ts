import type { ClientGrpc } from '@nestjs/microservices';
import { AuthProto, CommonProto } from '@email-platform/contracts';
import { SERVICE } from '@email-platform/config';
import type { GrpcCaller, CallOpts } from '@email-platform/foundation';

export class AuthClient {
  private readonly raw: AuthProto.AuthServiceClient;

  constructor(
    grpcClient: ClientGrpc,
    private readonly grpc: GrpcCaller,
  ) {
    this.raw = grpcClient.getService<AuthProto.AuthServiceClient>(SERVICE.auth.grpc.serviceName);
  }

  healthCheck(req: CommonProto.Empty, opts?: CallOpts): Promise<CommonProto.HealthStatus> {
    return this.grpc.call('healthCheck', opts, (m) => this.raw.healthCheck(req, m));
  }
  login(req: AuthProto.LoginRequest, opts?: CallOpts): Promise<AuthProto.TokenPair> {
    return this.grpc.call('login', opts, (m) => this.raw.login(req, m));
  }
  refreshToken(req: AuthProto.RefreshRequest, opts?: CallOpts): Promise<AuthProto.TokenPair> {
    return this.grpc.call('refreshToken', opts, (m) => this.raw.refreshToken(req, m));
  }
  validateToken(req: AuthProto.ValidateRequest, opts?: CallOpts): Promise<AuthProto.UserContext> {
    return this.grpc.call('validateToken', opts, (m) => this.raw.validateToken(req, m));
  }
  revokeToken(req: AuthProto.RevokeRequest, opts?: CallOpts): Promise<CommonProto.Empty> {
    return this.grpc.call('revokeToken', opts, (m) => this.raw.revokeToken(req, m));
  }
  createUser(req: AuthProto.CreateUserRequest, opts?: CallOpts): Promise<AuthProto.User> {
    return this.grpc.call('createUser', opts, (m) => this.raw.createUser(req, m));
  }
  listUsers(req: AuthProto.ListUsersRequest, opts?: CallOpts): Promise<AuthProto.UserList> {
    return this.grpc.call('listUsers', opts, (m) => this.raw.listUsers(req, m));
  }
}
