import type { UpdateSettingsCommand } from '../../commands/update-settings.command';
import type { ParserSettingsResult } from './get-settings.port';

export interface UpdateSettingsPort {
  execute(cmd: UpdateSettingsCommand): Promise<ParserSettingsResult>;
}
