import { Injectable } from '@nestjs/common';
import type { UpdateSettingsCommand } from '../commands/update-settings.command';
import type { ParserSettingsResult } from '../ports/inbound/get-settings.port';

@Injectable()
export class UpdateParserSettingsUseCase {
  async execute(_cmd: UpdateSettingsCommand): Promise<ParserSettingsResult> {
    throw new Error('UpdateParserSettingsUseCase not yet implemented');
  }
}
