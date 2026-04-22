export interface RecipientInputDto {
  readonly email: string;
  readonly name: string;
  readonly company: string;
}

export class ImportRecipientsCommand {
  constructor(
    public readonly groupId: string,
    public readonly recipients: ReadonlyArray<RecipientInputDto>,
  ) {}
}
