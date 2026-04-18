import { Inject, Injectable } from '@nestjs/common';
import type { ListRecipientsCommand } from '../commands/list-recipients.command';
import type { ListRecipientsResult } from '../ports/inbound/list-recipients.port';
import type { RecipientRepositoryPort } from '../ports/outbound/recipient-repository.port';
import { RECIPIENT_REPOSITORY_PORT } from '../../audience.constants';

@Injectable()
export class ListRecipientsUseCase {
  constructor(
    @Inject(RECIPIENT_REPOSITORY_PORT)
    private readonly _recipients: RecipientRepositoryPort,
  ) {}

  async execute(_cmd: ListRecipientsCommand): Promise<ListRecipientsResult> {
    throw new Error('ListRecipientsUseCase not yet implemented');
  }
}
