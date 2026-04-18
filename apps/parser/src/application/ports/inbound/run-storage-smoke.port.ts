import type { RunStorageSmokeCommand } from '../../commands/run-storage-smoke.command';

export interface RunStorageSmokePort {
  execute(cmd: RunStorageSmokeCommand): Promise<RunStorageSmokeResult>;
}

export interface SmokeStepResult {
  readonly step: string;
  readonly success: boolean;
  readonly detail: string;
}

export interface SmokeBucketResult {
  readonly bucket: string;
  readonly testKey: string;
  readonly steps: ReadonlyArray<SmokeStepResult>;
  readonly allPassed: boolean;
  readonly publicUrl: string;
}

export interface RunStorageSmokeResult {
  readonly buckets: ReadonlyArray<SmokeBucketResult>;
}
