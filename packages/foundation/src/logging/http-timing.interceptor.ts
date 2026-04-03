import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PinoLogger } from 'nestjs-pino';
import type { Request, Response } from 'express';

@Injectable()
export class HttpTimingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method;
    const path = req.url;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          const durationMs = Date.now() - startTime;
          this.logger.info(
            { method, path, statusCode: res.statusCode, durationMs },
            'HTTP request completed',
          );
        },
        error: (error: Error) => {
          const durationMs = Date.now() - startTime;
          this.logger.error(
            { method, path, durationMs, error: error.message },
            'HTTP request failed',
          );
        },
      }),
    );
  }
}
