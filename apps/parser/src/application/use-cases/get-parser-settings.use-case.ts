import { Injectable } from '@nestjs/common';
import type { GetSettingsCommand } from '../commands/get-settings.command';
import type { ParserSettingsResult } from '../ports/inbound/get-settings.port';

@Injectable()
export class GetParserSettingsUseCase {
  async execute(_cmd: GetSettingsCommand): Promise<ParserSettingsResult> {
    throw new Error('GetParserSettingsUseCase not yet implemented');
  }
}
