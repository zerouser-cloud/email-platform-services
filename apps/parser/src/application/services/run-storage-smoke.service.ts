import { Injectable } from '@nestjs/common';
import type {
  RunStorageSmokePort,
  RunStorageSmokeResult,
} from '../ports/inbound/run-storage-smoke.port';
import type { RunStorageSmokeCommand } from '../commands/run-storage-smoke.command';
import { RunPrivateSmokeCycleUseCase } from '../use-cases/run-private-smoke-cycle.use-case';
import { RunPublicSmokeCycleUseCase } from '../use-cases/run-public-smoke-cycle.use-case';

@Injectable()
export class RunStorageSmokeService implements RunStorageSmokePort {
  constructor(
    private readonly runPrivateCycle: RunPrivateSmokeCycleUseCase,
    private readonly runPublicCycle: RunPublicSmokeCycleUseCase,
  ) {}

  async execute(_cmd: RunStorageSmokeCommand): Promise<RunStorageSmokeResult> {
    const [privateResult, publicResult] = await Promise.all([
      this.runPrivateCycle.execute(),
      this.runPublicCycle.execute(),
    ]);
    return { buckets: [privateResult, publicResult] };
  }
}
