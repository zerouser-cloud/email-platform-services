import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { ClsService } from 'nestjs-cls';
import { AuthProto, CommonProto } from '@email-platform/contracts';
import { SERVICE } from '@email-platform/config';
import { AbstractGrpcClient } from '../abstract-grpc-client';
import type { CallOpts } from '../grpc-client-logging.types';
import { AUTH_CLIENT_GRPC } from './auth-client.constants';

@Injectable()
export class AuthClient extends AbstractGrpcClient<AuthProto.AuthServiceClient> {
  constructor(
    @Inject(AUTH_CLIENT_GRPC) grpc: ClientGrpc,
    cls: ClsService,
    defaultDeadlineMs: number,
  ) {
    super(grpc, cls, SERVICE.auth.grpc.serviceName, defaultDeadlineMs, AuthClient.name);
  }

  healthCheck(request: CommonProto.Empty, opts?: CallOpts): Promise<CommonProto.HealthStatus> {
    return this.call('healthCheck', this.raw.healthCheck(request, this.buildMetadata(opts)));
  }
  login(request: AuthProto.LoginRequest, opts?: CallOpts): Promise<AuthProto.TokenPair> {
    return this.call('login', this.raw.login(request, this.buildMetadata(opts)));
  }
  refreshToken(request: AuthProto.RefreshRequest, opts?: CallOpts): Promise<AuthProto.TokenPair> {
    return this.call('refreshToken', this.raw.refreshToken(request, this.buildMetadata(opts)));
  }
  validateToken(
    request: AuthProto.ValidateRequest,
    opts?: CallOpts,
  ): Promise<AuthProto.UserContext> {
    return this.call('validateToken', this.raw.validateToken(request, this.buildMetadata(opts)));
  }
  revokeToken(request: AuthProto.RevokeRequest, opts?: CallOpts): Promise<CommonProto.Empty> {
    return this.call('revokeToken', this.raw.revokeToken(request, this.buildMetadata(opts)));
  }
  createUser(request: AuthProto.CreateUserRequest, opts?: CallOpts): Promise<AuthProto.User> {
    return this.call('createUser', this.raw.createUser(request, this.buildMetadata(opts)));
  }
  listUsers(request: AuthProto.ListUsersRequest, opts?: CallOpts): Promise<AuthProto.UserList> {
    return this.call('listUsers', this.raw.listUsers(request, this.buildMetadata(opts)));
  }
}
