import { Injectable } from '@nestjs/common';
import type {
  CleanupStorageSmokePort,
  CleanupStorageSmokeResult,
} from '../ports/inbound/cleanup-storage-smoke.port';
import type { CleanupStorageSmokeCommand } from '../commands/cleanup-storage-smoke.command';
import { CleanupSmokeObjectUseCase } from '../use-cases/cleanup-smoke-object.use-case';

@Injectable()
export class CleanupStorageSmokeService implements CleanupStorageSmokePort {
  constructor(private readonly cleanupSmokeObject: CleanupSmokeObjectUseCase) {}

  async execute(cmd: CleanupStorageSmokeCommand): Promise<CleanupStorageSmokeResult> {
    return this.cleanupSmokeObject.execute(cmd.bucket, cmd.key);
  }
}
