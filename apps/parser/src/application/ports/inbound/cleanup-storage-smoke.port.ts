import type { CleanupStorageSmokeCommand } from '../../commands/cleanup-storage-smoke.command';

export interface CleanupStorageSmokePort {
  execute(cmd: CleanupStorageSmokeCommand): Promise<CleanupStorageSmokeResult>;
}

export interface CleanupStorageSmokeResult {
  readonly success: boolean;
  readonly detail: string;
}
