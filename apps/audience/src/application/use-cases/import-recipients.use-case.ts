import { Inject, Injectable } from '@nestjs/common';
import {
  ImportRecipientsPort,
  ImportRecipientsResult,
} from '../ports/inbound/import-recipients.port';
import { RecipientRepositoryPort } from '../ports/outbound/recipient-repository.port';

@Injectable()
export class ImportRecipientsUseCase implements ImportRecipientsPort {
  constructor(
    @Inject('RecipientRepositoryPort')
    private readonly recipientRepository: RecipientRepositoryPort,
  ) {}

  async execute(_groupId: string): Promise<ImportRecipientsResult> {
    throw new Error('ImportRecipientsUseCase not yet implemented');
  }
}
