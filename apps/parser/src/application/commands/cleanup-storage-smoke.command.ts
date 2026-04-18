export class CleanupStorageSmokeCommand {
  constructor(
    public readonly bucket: string,
    public readonly key: string,
  ) {}
}
