import { Module } from '@nestjs/common';
import { ParserController } from './parser.controller';

/**
 * GrpcModule (Phase 999.11.2 D-03) — owns the gRPC controller for the parser
 * bounded context. Root `parser.module.ts` imports this module instead of
 * registering `ParserController` directly in `controllers[]`.
 *
 * Inbound port → service bindings (CREATE_TASK_PORT → CreateTaskService,
 * etc.) remain in root `ParserModule` providers[] — services are registered
 * at the composition root and injected into the controller via Symbol tokens.
 */
@Module({
  controllers: [ParserController],
})
export class GrpcModule {}
