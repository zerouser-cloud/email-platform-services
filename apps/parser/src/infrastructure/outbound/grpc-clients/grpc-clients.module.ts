import { Module } from '@nestjs/common';
import { NotifierClientModule } from './notifier';

/**
 * GrpcClientsModule (Phase 999.11.2 D-06) — app-level composer for upstream
 * gRPC clients. Single-sub today (notifier) but the composer layer stays per
 * D-06 verbatim: future upstreams added by editing this imports/exports array
 * without restructuring the composition root.
 *
 * D-09 CORRECTED (RESEARCH OQ-1, 2026-04-20): no `clients.constants.ts` file
 * — gRPC client tokens stay per-sub-module per ESLint Override 7 / 999.7.x
 * precedent. The relocation from `infrastructure/clients/notifier/` to
 * `infrastructure/outbound/grpc-clients/notifier/` (subsumed by D-02) itself
 * satisfies the "tokens near consumers" intent.
 */
@Module({
  imports: [NotifierClientModule.forRoot()],
  exports: [NotifierClientModule],
})
export class GrpcClientsModule {}
