import { Metadata } from '@grpc/grpc-js';
import { PinoLogger } from 'nestjs-pino';
import type { Logger as PinoNativeLogger } from 'pino';
import { ClsService } from 'nestjs-cls';
import { type Observable, lastValueFrom } from 'rxjs';
import { GRPC_CLIENT_LOG, GRPC_CLIENT_DEADLINE } from './clients.constants';
import type { CallOpts, GrpcClientLogFields } from './grpc-client-logging.types';

/**
 * Per-upstream gRPC call helper. Plain class with no NestJS decorators and no
 * lifecycle hooks — instantiated directly via `new GrpcCaller(...)` inside
 * `defineGrpcClient.useFactory` (see D-01).
 *
 * Encapsulates three concerns so the 8 client facades stay dumb:
 *  1. gRPC metadata construction with per-call deadline header
 *  2. Observable -> Promise conversion via lastValueFrom
 *  3. Structured logging (service/method/duration/status/correlationId)
 *
 * Instantiated ONCE PER UPSTREAM inside `defineGrpcClient.useFactory`. One instance
 * per client facade — not a singleton, not service-locator.
 *
 * D-05 signature rationale: the `call()` method accepts a `rpcFactory` CALLBACK
 * (not a pre-built Observable) so future retry / distributed tracing / circuit
 * breaker / error policy can re-create the Observable with fresh metadata from a
 * single extension point inside this file.
 *
 * Pitfall 6 defence — lazy `getLogger()`:
 * The pino root logger is populated during NestApplication.init step 2 (the logger
 * module configure). But useFactory fires in step 1 (registerModules), so at
 * construction time the root logger may still be undefined. Storing only
 * `logContext: string` and deferring the `.child(...)` resolution to the first
 * `call()` (which fires from a request handler — long after step 2) sidesteps the
 * race entirely. See 999.7.2-RESEARCH.md Target 2.
 *
 * Pitfall-6-original defence — always `.child(bindings)`:
 * Never call `setContext(name)` on the shared logger wrapper (mutates a singleton —
 * last-init overwrites all). `.child({ context })` returns a detached pino.Logger.
 */
export class GrpcCaller {
  private logger: PinoNativeLogger | undefined;

  constructor(
    private readonly cls: ClsService,
    private readonly serviceName: string,
    private readonly defaultDeadlineMs: number,
    private readonly logContext: string,
  ) {}

  async call<TResponse>(
    method: string,
    opts: CallOpts | undefined,
    rpcFactory: (metadata: Metadata) => Observable<TResponse>,
  ): Promise<TResponse> {
    const start = Date.now();
    const metadata = this.buildMetadata(opts);
    // Extension point (D-05): span creation / retry loop / circuit check insert here.
    try {
      const response = await lastValueFrom(rpcFactory(metadata));
      this.emitLog(method, start, GRPC_CLIENT_LOG.STATUS_OK);
      return response;
    } catch (error) {
      this.emitLog(method, start, GRPC_CLIENT_LOG.STATUS_ERROR);
      throw error;
    }
  }

  private buildMetadata(opts: CallOpts | undefined): Metadata {
    const metadata = new Metadata();
    const deadlineMs = opts?.deadlineMs ?? this.defaultDeadlineMs;
    metadata.set(
      GRPC_CLIENT_DEADLINE.METADATA_HEADER,
      `${deadlineMs}${GRPC_CLIENT_DEADLINE.METADATA_UNIT_MILLISECONDS}`,
    );
    return metadata;
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
    this.getLogger()[logLevel](fields, GRPC_CLIENT_LOG.EVENT);
  }

  private getLogger(): PinoNativeLogger {
    if (!this.logger) {
      this.logger = PinoLogger.root.child({ context: this.logContext });
    }
    return this.logger;
  }
}
