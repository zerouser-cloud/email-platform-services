import type { ListMacrosCommand } from '../../commands/list-macros.command';

export interface ListMacrosPort {
  execute(cmd: ListMacrosCommand): Promise<ListMacrosResult>;
}

export interface ListMacrosResult {
  readonly macros: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly template: string;
    readonly createdAt: string;
  }>;
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly pages: number;
}
