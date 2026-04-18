import { Inject, Injectable } from '@nestjs/common';
import {
  type NamespacedStoragePort,
  type PrivateStoragePort,
  SHARED_REPORTS,
  PUBLIC_BUCKET,
} from '@email-platform/foundation';
import type { CleanupStorageSmokeResult } from '../ports/inbound/cleanup-storage-smoke.port';
import { PARSER_STORAGE, PARSER_STORAGE_BUCKET } from '../../parser.constants';

type BucketDeleteFn = (key: string) => Promise<void>;

@Injectable()
export class CleanupSmokeObjectUseCase {
  private readonly dispatch: Record<string, BucketDeleteFn>;

  constructor(
    @Inject(PARSER_STORAGE) private readonly parserStorage: PrivateStoragePort,
    @Inject(SHARED_REPORTS) private readonly publicReports: NamespacedStoragePort,
  ) {
    // Record dispatch per CLAUDE.md no-switch/case rule (3+ branches would be switch;
    // with 2 + fallback this is consistent with the branching-patterns skill).
    this.dispatch = {
      [PARSER_STORAGE_BUCKET]: (key) => this.parserStorage.delete(key),
      [PUBLIC_BUCKET]: (key) => this.publicReports.delete(key),
    };
  }

  async execute(bucket: string, key: string): Promise<CleanupStorageSmokeResult> {
    const fn = this.dispatch[bucket];
    if (!fn) {
      return { success: false, detail: `Unknown bucket: ${bucket}` };
    }
    try {
      await fn(key);
      return { success: true, detail: '' };
    } catch (err) {
      return { success: false, detail: String(err) };
    }
  }
}
