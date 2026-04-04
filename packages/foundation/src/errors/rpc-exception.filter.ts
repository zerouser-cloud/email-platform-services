import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseRpcExceptionFilter, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Observable, throwError } from 'rxjs';
import { PinoLogger } from 'nestjs-pino';
import { ERROR_MESSAGE } from './error-messages';

@Catch()
export class AllRpcExceptionsFilter extends BaseRpcExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    super();
  }

  catch(exception: unknown, _host: ArgumentsHost): Observable<never> {
    if (exception instanceof RpcException) {
      const error = exception.getError();
      this.logger.warn({ error }, 'RPC exception');
      return throwError(() => error);
    }

    const errorMessage = exception instanceof Error ? exception.message : ERROR_MESSAGE.INTERNAL;
    const stack = exception instanceof Error ? exception.stack : undefined;

    this.logger.error({ error: errorMessage, stack }, 'Unhandled exception in gRPC service');

    return throwError(() => ({
      code: GrpcStatus.INTERNAL,
      message: ERROR_MESSAGE.INTERNAL,
    }));
  }
}
