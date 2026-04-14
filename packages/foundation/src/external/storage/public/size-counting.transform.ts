import { Transform, type TransformCallback } from 'node:stream';
import { StorageUploadTooLargeError } from './upload-too-large.error';

/**
 * Pass-through stream that fails with StorageUploadTooLargeError
 * once cumulative byte count exceeds `max`. Used to enforce
 * STORAGE_MAX_UPLOAD_BYTES on unknown-length streams (D-18).
 */
export class SizeCountingTransform extends Transform {
  private seen = 0;
  constructor(private readonly max: number) {
    super();
  }

  _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback): void {
    this.seen += chunk.length;
    if (this.seen > this.max) {
      cb(new StorageUploadTooLargeError(this.seen, this.max));
      return;
    }
    cb(null, chunk);
  }
}
