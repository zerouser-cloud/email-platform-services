import { Module } from '@nestjs/common';
import { ParserTaskModule } from './parser-task';

/**
 * AppPersistenceModule (Phase 999.11.2 D-06) — app-level composer aggregating
 * per-aggregate persistence sub-modules. Single-sub today (parser-task) but the
 * composer layer stays per D-06 verbatim so future aggregates are added by
 * editing this imports/exports array without restructuring the composition
 * root.
 *
 * `App` prefix disambiguates from foundation's `PersistenceModule` inside
 * parser.module.ts imports.
 */
@Module({
  imports: [ParserTaskModule],
  exports: [ParserTaskModule],
})
export class AppPersistenceModule {}
