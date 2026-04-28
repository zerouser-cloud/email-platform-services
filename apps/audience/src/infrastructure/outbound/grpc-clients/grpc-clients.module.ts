import { Module } from '@nestjs/common';
import { ParserClientModule } from './parser';

/**
 * Outbound gRPC clients composer (Phase 999.11.2 D-06 single-sub demo, D-09).
 *
 * Wraps the single upstream gRPC client (parser) so the root composition root
 * imports ONE outbound composer rather than the sub-module directly. Per-module
 * tokens (PARSER_CLIENT_GRPC, PARSER_GRPC_HEALTH) stay in the parser sub-barrel;
 * no `clients.constants.ts` per D-09 (CORRECTED).
 */
@Module({
  imports: [ParserClientModule.forRoot()],
  exports: [ParserClientModule],
})
export class GrpcClientsModule {}
