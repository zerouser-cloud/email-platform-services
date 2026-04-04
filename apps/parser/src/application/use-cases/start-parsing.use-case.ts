import { Inject, Injectable } from '@nestjs/common';
import { StartParsingPort, StartParsingResult } from '../ports/inbound/start-parsing.port';
import { ParserTaskRepositoryPort } from '../ports/outbound/parser-task-repository.port';

@Injectable()
export class StartParsingUseCase implements StartParsingPort {
  constructor(
    @Inject('ParserTaskRepositoryPort')
    private readonly parserTaskRepository: ParserTaskRepositoryPort,
  ) {}

  async execute(_category: string): Promise<StartParsingResult> {
    throw new Error('StartParsingUseCase not yet implemented');
  }
}
