import { Catch, ExceptionFilter, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { PinoLogger } from 'nestjs-pino';
import type { Response } from 'express';
import { ERROR_MESSAGE } from './error-messages';

const GRPC_TO_HTTP: Record<number, number> = {
  [GrpcStatus.INVALID_ARGUMENT]: HttpStatus.BAD_REQUEST,
  [GrpcStatus.FAILED_PRECONDITION]: HttpStatus.BAD_REQUEST,
  [GrpcStatus.OUT_OF_RANGE]: HttpStatus.BAD_REQUEST,
  [GrpcStatus.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [GrpcStatus.ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [GrpcStatus.ABORTED]: HttpStatus.CONFLICT,
  [GrpcStatus.PERMISSION_DENIED]: HttpStatus.FORBIDDEN,
  [GrpcStatus.UNAUTHENTICATED]: HttpStatus.UNAUTHORIZED,
  [GrpcStatus.UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [GrpcStatus.DEADLINE_EXCEEDED]: HttpStatus.GATEWAY_TIMEOUT,
  [GrpcStatus.RESOURCE_EXHAUSTED]: HttpStatus.TOO_MANY_REQUESTS,
  [GrpcStatus.UNIMPLEMENTED]: HttpStatus.NOT_IMPLEMENTED,
  [GrpcStatus.INTERNAL]: HttpStatus.INTERNAL_SERVER_ERROR,
  [GrpcStatus.UNKNOWN]: HttpStatus.INTERNAL_SERVER_ERROR,
  [GrpcStatus.DATA_LOSS]: HttpStatus.INTERNAL_SERVER_ERROR,
  [GrpcStatus.CANCELLED]: HttpStatus.INTERNAL_SERVER_ERROR,
};

const ERROR_CODE_TO_MESSAGE: Record<number, string> = {
  [GrpcStatus.INVALID_ARGUMENT]: ERROR_MESSAGE.INVALID_ARGUMENT,
  [GrpcStatus.FAILED_PRECONDITION]: ERROR_MESSAGE.FAILED_PRECONDITION,
  [GrpcStatus.OUT_OF_RANGE]: ERROR_MESSAGE.OUT_OF_RANGE,
  [GrpcStatus.NOT_FOUND]: ERROR_MESSAGE.NOT_FOUND,
  [GrpcStatus.ALREADY_EXISTS]: ERROR_MESSAGE.ALREADY_EXISTS,
  [GrpcStatus.ABORTED]: ERROR_MESSAGE.ABORTED,
  [GrpcStatus.PERMISSION_DENIED]: ERROR_MESSAGE.PERMISSION_DENIED,
  [GrpcStatus.UNAUTHENTICATED]: ERROR_MESSAGE.UNAUTHENTICATED,
  [GrpcStatus.UNAVAILABLE]: ERROR_MESSAGE.UNAVAILABLE,
  [GrpcStatus.DEADLINE_EXCEEDED]: ERROR_MESSAGE.DEADLINE_EXCEEDED,
  [GrpcStatus.RESOURCE_EXHAUSTED]: ERROR_MESSAGE.RESOURCE_EXHAUSTED,
  [GrpcStatus.UNIMPLEMENTED]: ERROR_MESSAGE.UNIMPLEMENTED,
  [GrpcStatus.INTERNAL]: ERROR_MESSAGE.INTERNAL,
  [GrpcStatus.UNKNOWN]: ERROR_MESSAGE.INTERNAL,
  [GrpcStatus.DATA_LOSS]: ERROR_MESSAGE.DATA_LOSS,
  [GrpcStatus.CANCELLED]: ERROR_MESSAGE.CANCELLED,
};

@Catch()
export class GrpcToHttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof HttpException) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const status = exception.getStatus();
      response.status(status).json(exception.getResponse());
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const grpcCode = this.extractGrpcCode(exception);
    const rawMessage = this.extractRawMessage(exception);
    const safeMessage = ERROR_CODE_TO_MESSAGE[grpcCode] ?? ERROR_MESSAGE.INTERNAL;
    const httpStatus = GRPC_TO_HTTP[grpcCode] ?? HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.warn({ grpcCode, httpStatus, message: rawMessage }, 'gRPC-to-HTTP error mapping');

    response.status(httpStatus).json({
      statusCode: httpStatus,
      message: safeMessage,
      error: HttpStatus[httpStatus] ?? 'Internal Server Error',
    });
  }

  private extractGrpcCode(exception: unknown): number {
    if (
      exception &&
      typeof exception === 'object' &&
      'code' in exception &&
      typeof (exception as Record<string, unknown>).code === 'number'
    ) {
      return (exception as Record<string, unknown>).code as number;
    }
    return GrpcStatus.INTERNAL;
  }

  private extractRawMessage(exception: unknown): string {
    if (exception instanceof Error) {
      return exception.message;
    }
    if (
      exception &&
      typeof exception === 'object' &&
      'message' in exception &&
      typeof (exception as Record<string, unknown>).message === 'string'
    ) {
      return (exception as Record<string, unknown>).message as string;
    }
    if (
      exception &&
      typeof exception === 'object' &&
      'details' in exception &&
      typeof (exception as Record<string, unknown>).details === 'string'
    ) {
      return (exception as Record<string, unknown>).details as string;
    }
    return ERROR_MESSAGE.INTERNAL;
  }
}
