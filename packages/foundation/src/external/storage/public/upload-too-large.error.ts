export class StorageUploadTooLargeError extends Error {
  constructor(
    public readonly seen: number,
    public readonly max: number,
  ) {
    super(`Upload size exceeded: seen=${seen} max=${max}`);
    this.name = 'StorageUploadTooLargeError';
  }
}
