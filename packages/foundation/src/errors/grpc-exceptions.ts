import { status as GrpcStatus } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { ERROR_MESSAGE } from './error-messages';

export interface GrpcErrorPayload {
  code: GrpcStatus;
  message: string;
  details?: Record<string, unknown>;
}

export abstract class GrpcException extends RpcException {
  readonly code: GrpcStatus;

  protected constructor(code: GrpcStatus, message: string, details?: Record<string, unknown>) {
    super({ code, message, ...(details && { details }) });
    this.code = code;
  }
}

export class GrpcNotFoundException extends GrpcException {
  constructor(message = ERROR_MESSAGE.NOT_FOUND, details?: Record<string, unknown>) {
    super(GrpcStatus.NOT_FOUND, message, details);
  }
}

export class GrpcInvalidArgumentException extends GrpcException {
  constructor(message = ERROR_MESSAGE.INVALID_ARGUMENT, details?: Record<string, unknown>) {
    super(GrpcStatus.INVALID_ARGUMENT, message, details);
  }
}

export class GrpcAlreadyExistsException extends GrpcException {
  constructor(message = ERROR_MESSAGE.ALREADY_EXISTS, details?: Record<string, unknown>) {
    super(GrpcStatus.ALREADY_EXISTS, message, details);
  }
}

export class GrpcPermissionDeniedException extends GrpcException {
  constructor(message = ERROR_MESSAGE.PERMISSION_DENIED, details?: Record<string, unknown>) {
    super(GrpcStatus.PERMISSION_DENIED, message, details);
  }
}

export class GrpcUnauthenticatedException extends GrpcException {
  constructor(message = ERROR_MESSAGE.UNAUTHENTICATED, details?: Record<string, unknown>) {
    super(GrpcStatus.UNAUTHENTICATED, message, details);
  }
}

export class GrpcInternalException extends GrpcException {
  constructor(message = ERROR_MESSAGE.INTERNAL, details?: Record<string, unknown>) {
    super(GrpcStatus.INTERNAL, message, details);
  }
}

export class GrpcUnavailableException extends GrpcException {
  constructor(message = ERROR_MESSAGE.UNAVAILABLE, details?: Record<string, unknown>) {
    super(GrpcStatus.UNAVAILABLE, message, details);
  }
}
