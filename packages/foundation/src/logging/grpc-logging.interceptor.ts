import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class GrpcLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const method =
      context.getHandler().name || context.getClass().name + '.' + context.getHandler().name;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.info({ method, duration, status: 'OK' }, 'gRPC call completed');
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            {
              method,
              duration,
              status: 'ERROR',
              error: error.message,
            },
            'gRPC call failed',
          );
        },
      }),
    );
  }
}
