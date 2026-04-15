import { Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { PinoLogger } from 'nestjs-pino';
import type { Logger as PinoNativeLogger } from 'pino';
import { ClsService } from 'nestjs-cls';
import { type Observable, lastValueFrom } from 'rxjs';
import { GRPC_CLIENT_LOG, GRPC_CLIENT_DEADLINE } from './clients.constants';
import type { CallOpts, GrpcClientLogFields } from './grpc-client-logging.types';

@Injectable()
export abstract class AbstractGrpcClient<TRaw extends object> implements OnModuleInit {
  protected raw!: TRaw;
  // Per-instance child logger derived from the static root pino.Logger.
  // Pitfall 6: MUST NOT inject PinoLogger and call setContext — that mutates the
  // shared singleton and the last-initialized subclass overwrites all others.
  // PinoLogger.root is initialized by LoggerModule.onModuleInit, so we defer
  // child creation to onModuleInit (constructor runs too early — root is undefined).
  // Mirrors the precedent in packages/foundation/src/external/logging/correlation.interceptor.ts.
  private logger!: PinoNativeLogger;

  constructor(
    private readonly grpc: ClientGrpc,
    private readonly cls: ClsService,
    protected readonly serviceName: string,
    protected readonly defaultDeadlineMs: number,
    private readonly logContext: string,
  ) {}

  onModuleInit(): void {
    // Pitfall 3: must happen in lifecycle hook, not constructor.
    this.raw = this.grpc.getService<TRaw>(this.serviceName);
    // Pitfall 6 (refined): PinoLogger.root is undefined in constructor — defer.
    this.logger = PinoLogger.root.child({ context: this.logContext });
  }

  protected buildMetadata(opts?: CallOpts): Metadata {
    const metadata = new Metadata();
    const deadlineMs = opts?.deadlineMs ?? this.defaultDeadlineMs;
    metadata.set(
      GRPC_CLIENT_DEADLINE.METADATA_HEADER,
      `${deadlineMs}${GRPC_CLIENT_DEADLINE.METADATA_UNIT_MILLISECONDS}`,
    );
    return metadata;
  }

  protected async call<TResponse>(
    method: string,
    observable: Observable<TResponse>,
  ): Promise<TResponse> {
    const start = Date.now();
    try {
      const response = await lastValueFrom(observable);
      this.emitLog(method, start, GRPC_CLIENT_LOG.STATUS_OK);
      return response;
    } catch (error) {
      this.emitLog(method, start, GRPC_CLIENT_LOG.STATUS_ERROR);
      throw error;
    }
  }

  private emitLog(
    method: string,
    startedAt: number,
    status: typeof GRPC_CLIENT_LOG.STATUS_OK | typeof GRPC_CLIENT_LOG.STATUS_ERROR,
  ): void {
    const fields: GrpcClientLogFields = {
      service: this.serviceName,
      method,
      duration_ms: Date.now() - startedAt,
      status,
      correlationId: this.cls.getId(),
    };
    const logLevel = status === GRPC_CLIENT_LOG.STATUS_OK ? 'info' : 'error';
    this.logger[logLevel](fields, GRPC_CLIENT_LOG.EVENT);
  }
}
