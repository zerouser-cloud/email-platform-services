import { Injectable } from '@nestjs/common';
import type { ListRunnersCommand } from '../commands/list-runners.command';
import type { ListRunnersResult } from '../ports/inbound/list-runners.port';

@Injectable()
export class ListRunnersUseCase {
  async execute(_cmd: ListRunnersCommand): Promise<ListRunnersResult> {
    throw new Error('ListRunnersUseCase not yet implemented');
  }
}
