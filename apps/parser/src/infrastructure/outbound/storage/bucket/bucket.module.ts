import { Module } from '@nestjs/common';
import { PrivateStorageModule } from '@email-platform/foundation/internal';
import {
  PARSER_STORAGE,
  PARSER_STORAGE_HEALTH,
  PARSER_STORAGE_BUCKET,
  PARSER_STORAGE_HEALTH_KEY,
} from '../../../../parser.constants';

/**
 * BucketModule (Phase 999.11.2 D-02, D-06) — private parser bucket sub-module
 * wrapping foundation `PrivateStorageModule.forBucket(...)`. Renamed from
 * `ParserStorageModule` during the 999.11.2 canonical split; previously at
 * `infrastructure/storage/parser-storage.module.ts`.
 *
 * Provides `PARSER_STORAGE` (client), `PARSER_STORAGE_HEALTH` (indicator) and
 * is consumed transitively through `AppStorageModule` (outbound/storage
 * composer) by both the root `ParserModule` and `HealthModule`.
 */
@Module({
  imports: [
    PrivateStorageModule.forBucket({
      bucket: PARSER_STORAGE_BUCKET,
      token: PARSER_STORAGE,
      healthToken: PARSER_STORAGE_HEALTH,
      healthKey: PARSER_STORAGE_HEALTH_KEY,
    }),
  ],
  exports: [PrivateStorageModule],
})
export class BucketModule {}
