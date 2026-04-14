import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, HeadObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { SizeCountingTransform } from './size-counting.transform';
import { buildPublicUrl, sanitizeFilename } from './public-url.builder';
import { UPLOAD_DEFAULTS, PUBLIC_URL } from './public.constants';
import { S3_ERROR_NAME } from '../../../internal/storage/storage.constants';
import type { NamespacedStoragePort } from './namespaced-storage.interface';

/**
 * NamespacedStoragePort implementation backed by the single `public` bucket.
 *
 * Key format (D-13): `{namespace}/{uuid-v4}/{sanitizedFilename}`.
 * URL format (D-14 amended): `${publicUrlBase}/${key}`.
 * Multipart upload via @aws-sdk/lib-storage Upload (D-17).
 * Size limit enforced via SizeCountingTransform (D-18).
 *
 * SECURITY: do not log the returned `url` field — log `key` only (T-22.4-06).
 */
export class NamespacedStorageService implements NamespacedStoragePort {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly namespace: string,
    private readonly contentType: string,
    private readonly publicUrlBase: string,
    private readonly maxBytes: number,
  ) {}

  async upload(filename: string, body: Readable): Promise<{ url: string; key: string }> {
    const safe = sanitizeFilename(filename);
    const key = `${this.namespace}${PUBLIC_URL.PATH_SEPARATOR}${randomUUID()}${PUBLIC_URL.PATH_SEPARATOR}${safe}`;
    const counter = new SizeCountingTransform(this.maxBytes);
    body.pipe(counter);
    const uploader = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: counter,
        ContentType: this.contentType,
      },
      queueSize: UPLOAD_DEFAULTS.QUEUE_SIZE,
      partSize: UPLOAD_DEFAULTS.PART_SIZE_BYTES,
      // leavePartsOnError defaults to false → Upload auto-aborts on stream error
    });
    await uploader.done();
    const url = buildPublicUrl(this.publicUrlBase, this.bucket, key);
    return { url, key };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err) {
      if (isNotFound(err)) return false;
      throw err;
    }
  }
}

function isNotFound(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  return (err as { name?: unknown }).name === S3_ERROR_NAME.NOT_FOUND;
}
