import { Module } from '@nestjs/common';
import { PersistenceModule } from '@email-platform/foundation';
import { PARSER_TASK_REPOSITORY_PORT } from '../../../../parser.constants';
import { PgParserTaskRepository } from './pg-parser-task.repository';

/**
 * ParserTaskModule (Phase 999.11.2 D-02, D-06) — per-aggregate persistence
 * sub-module. Owns `PARSER_TASK_REPOSITORY_PORT` → `PgParserTaskRepository`
 * binding and explicitly imports foundation `PersistenceModule.forRootAsync()`
 * so the repository's `@Inject(DRIZZLE)` resolves without relying on root-level
 * propagation (foundation's module is NOT `@Global()`).
 */
@Module({
  imports: [PersistenceModule.forRootAsync()],
  providers: [{ provide: PARSER_TASK_REPOSITORY_PORT, useClass: PgParserTaskRepository }],
  exports: [PARSER_TASK_REPOSITORY_PORT],
})
export class ParserTaskModule {}
