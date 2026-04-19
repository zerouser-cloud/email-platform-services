import { Inject, Injectable } from '@nestjs/common';
import type { ImportRecipientsCommand } from '../commands/import-recipients.command';
import type { ImportRecipientsResult } from '../ports/inbound/import-recipients.port';
import type { RecipientRepositoryPort } from '../ports/outbound/recipient-repository.port';
import { RECIPIENT_REPOSITORY_PORT } from '../../audience.constants';

@Injectable()
export class ImportRecipientsUseCase {
  constructor(
    @Inject(RECIPIENT_REPOSITORY_PORT)
    private readonly recipientRepository: RecipientRepositoryPort,
  ) {}

  async execute(_cmd: ImportRecipientsCommand): Promise<ImportRecipientsResult> {
    throw new Error('ImportRecipientsUseCase not yet implemented');
  }
}
