import type { ImportRecipientsCommand } from '../../commands/import-recipients.command';

export interface ImportRecipientsPort {
  execute(cmd: ImportRecipientsCommand): Promise<ImportRecipientsResult>;
}

export interface ImportRecipientsResult {
  readonly imported: number;
  readonly duplicates: number;
  readonly total: number;
}
