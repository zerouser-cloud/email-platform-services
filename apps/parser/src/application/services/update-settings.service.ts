import { Injectable } from '@nestjs/common';
import type { UpdateSettingsPort } from '../ports/inbound/update-settings.port';
import type { ParserSettingsResult } from '../ports/inbound/get-settings.port';
import type { UpdateSettingsCommand } from '../commands/update-settings.command';
import { UpdateParserSettingsUseCase } from '../use-cases/update-parser-settings.use-case';

@Injectable()
export class UpdateSettingsService implements UpdateSettingsPort {
  constructor(private readonly useCase: UpdateParserSettingsUseCase) {}

  async execute(cmd: UpdateSettingsCommand): Promise<ParserSettingsResult> {
    return this.useCase.execute(cmd);
  }
}
