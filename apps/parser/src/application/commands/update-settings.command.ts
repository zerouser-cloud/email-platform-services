export class UpdateSettingsCommand {
  constructor(
    public readonly maxPages: number | undefined,
    public readonly batchSize: number | undefined,
    public readonly autoImport: boolean | undefined,
  ) {}
}
