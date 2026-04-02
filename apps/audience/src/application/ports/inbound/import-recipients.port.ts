export interface ImportRecipientsPort {
  execute(groupId: string): Promise<ImportRecipientsResult>;
}

export interface ImportRecipientsResult {
  importedCount: number;
}
