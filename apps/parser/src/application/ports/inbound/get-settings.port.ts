import type { GetSettingsCommand } from '../../commands/get-settings.command';

export interface GetSettingsPort {
  execute(cmd: GetSettingsCommand): Promise<ParserSettingsResult>;
}

export interface ParserSettingsResult {
  readonly maxPages: number;
  readonly batchSize: number;
  readonly autoImport: boolean;
}
