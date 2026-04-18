import { Injectable } from '@nestjs/common';
import type {
  GetRecipientsByGroupPort,
  GetRecipientsByGroupResult,
} from '../ports/inbound/get-recipients-by-group.port';
import type { GetRecipientsByGroupCommand } from '../commands/get-recipients-by-group.command';
import { GetRecipientsByGroupUseCase } from '../use-cases/get-recipients-by-group.use-case';

@Injectable()
export class GetRecipientsByGroupService implements GetRecipientsByGroupPort {
  constructor(private readonly useCase: GetRecipientsByGroupUseCase) {}

  async execute(cmd: GetRecipientsByGroupCommand): Promise<GetRecipientsByGroupResult> {
    return this.useCase.execute(cmd);
  }
}
