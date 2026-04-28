/**
 * PinoHttpClientLoggerAdapter — Pino-backed `HttpClientLogger` (D-05, D-06).
 *
 * Pitfall 6 (Phase 23): `PinoLogger.root` is `undefined` until
 * `LoggerModule.onModuleInit()` populates it. We defer child-logger creation
 * to the first actual call via the private `ensureInit()` guard;
 * `onModuleInit()` also calls `ensureInit()` to preserve eager initialisation
 * when this adapter IS resolved through the DI graph.
 *
 * LIFECYCLE (IMPORTANT): this adapter is constructed MANUALLY inside the
 * `httpClientProvider` factory's `useFactory` (Plan 02) — not
 * DI-graph-resolved. NestJS invokes `onModuleInit()` only on DI-graph
 * providers, so a pure `onModuleInit`-based init would NEVER fire for
 * manually-constructed instances. The lazy `ensureInit()` guard inside
 * `call()` / `transition()` is what makes Pitfall 6 protection robust in the
 * manual-construction path.
 *
 * Level selection (info vs error/warn) lives HERE (D-05), not in
 * AbstractHttpClient — the orchestrator stays transport-agnostic.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PinoLogger } from 'nestjs-pino';
import type { Logger as PinoNativeLogger } from 'pino';
import { HTTP_CLIENT_LOG } from '../client/constants';
import type { HttpClientLogger } from './http-client-logger.port';
import type { CircuitTransitionLogFields, HttpClientLogFields } from './types';

@Injectable()
export class PinoHttpClientLoggerAdapter implements HttpClientLogger, OnModuleInit {
  private logger!: PinoNativeLogger;

  constructor(
    private readonly cls: ClsService,
    private readonly logContext: string,
  ) {}

  private ensureInit(): void {
    if (!this.logger) {
      this.logger = PinoLogger.root.child({ context: this.logContext });
    }
  }

  onModuleInit(): void {
    this.ensureInit();
  }

  call(fields: HttpClientLogFields): void {
    this.ensureInit();
    const enriched = { ...fields, correlationId: fields.correlationId ?? this.cls.getId() };
    const level = enriched.status === HTTP_CLIENT_LOG.STATUS_OK ? 'info' : 'error';
    this.logger[level](enriched, HTTP_CLIENT_LOG.EVENT_CALL);
  }

  transition(fields: CircuitTransitionLogFields): void {
    this.ensureInit();
    const level = fields.transition === HTTP_CLIENT_LOG.CB_CLOSE ? 'info' : 'warn';
    this.logger[level](fields, HTTP_CLIENT_LOG.EVENT_CB_TRANSITION);
  }
}
