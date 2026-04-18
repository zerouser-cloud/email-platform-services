import { Injectable } from '@nestjs/common';
import type { ListMacrosCommand } from '../commands/list-macros.command';
import type { ListMacrosResult } from '../ports/inbound/list-macros.port';

@Injectable()
export class ListMacrosUseCase {
  async execute(_cmd: ListMacrosCommand): Promise<ListMacrosResult> {
    throw new Error('ListMacrosUseCase not yet implemented');
  }
}
