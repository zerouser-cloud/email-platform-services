import { Inject, Injectable } from '@nestjs/common';
import type { GetRecipientsByGroupCommand } from '../commands/get-recipients-by-group.command';
import type { GetRecipientsByGroupResult } from '../ports/inbound/get-recipients-by-group.port';
import type { RecipientRepositoryPort } from '../ports/outbound/recipient-repository.port';
import { RECIPIENT_REPOSITORY_PORT } from '../../audience.constants';

@Injectable()
export class GetRecipientsByGroupUseCase {
  constructor(
    @Inject(RECIPIENT_REPOSITORY_PORT)
    private readonly _recipients: RecipientRepositoryPort,
  ) {}

  async execute(_cmd: GetRecipientsByGroupCommand): Promise<GetRecipientsByGroupResult> {
    throw new Error('GetRecipientsByGroupUseCase not yet implemented');
  }
}
