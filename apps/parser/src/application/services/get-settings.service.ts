import { Injectable } from '@nestjs/common';
import type { GetSettingsPort, ParserSettingsResult } from '../ports/inbound/get-settings.port';
import type { GetSettingsCommand } from '../commands/get-settings.command';
import { GetParserSettingsUseCase } from '../use-cases/get-parser-settings.use-case';

@Injectable()
export class GetSettingsService implements GetSettingsPort {
  constructor(private readonly getParserSettings: GetParserSettingsUseCase) {}

  async execute(cmd: GetSettingsCommand): Promise<ParserSettingsResult> {
    return this.getParserSettings.execute(cmd);
  }
}
