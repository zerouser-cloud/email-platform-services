import { Injectable } from '@nestjs/common';
import type {
  ListRecipientsPort,
  ListRecipientsResult,
} from '../ports/inbound/list-recipients.port';
import type { ListRecipientsCommand } from '../commands/list-recipients.command';
import { ListRecipientsUseCase } from '../use-cases/list-recipients.use-case';

@Injectable()
export class ListRecipientsService implements ListRecipientsPort {
  constructor(private readonly listRecipients: ListRecipientsUseCase) {}

  async execute(cmd: ListRecipientsCommand): Promise<ListRecipientsResult> {
    return this.listRecipients.execute(cmd);
  }
}
