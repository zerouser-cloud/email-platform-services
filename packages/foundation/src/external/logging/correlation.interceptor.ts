import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PinoLogger } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';
import { storage, Store } from 'nestjs-pino/storage';

@Injectable()
export class GrpcCorrelationInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: PinoLogger,
    private readonly cls: ClsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const correlationId = this.cls.getId();
    const childLogger = PinoLogger.root.child({ correlationId });

    return new Observable((subscriber) => {
      storage.run(new Store(childLogger), () => {
        next.handle().subscribe({
          next: (val) => subscriber.next(val),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
