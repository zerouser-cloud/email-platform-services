import { Injectable } from '@nestjs/common';
import type {
  ImportRecipientsPort,
  ImportRecipientsResult,
} from '../ports/inbound/import-recipients.port';
import type { ImportRecipientsCommand } from '../commands/import-recipients.command';
import { ImportRecipientsUseCase } from '../use-cases/import-recipients.use-case';

@Injectable()
export class ImportRecipientsService implements ImportRecipientsPort {
  constructor(private readonly importRecipients: ImportRecipientsUseCase) {}

  async execute(cmd: ImportRecipientsCommand): Promise<ImportRecipientsResult> {
    return this.importRecipients.execute(cmd);
  }
}
