import type { HealthIndicatorResult } from '@nestjs/terminus';
import type { Readable } from 'node:stream';

export interface PrivateStoragePort {
  upload(key: string, body: Buffer | Readable, contentType: string): Promise<void>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export interface StorageHealthIndicator {
  isHealthy(key: string): Promise<HealthIndicatorResult>;
}

export interface BucketStorageOptions {
  readonly bucket: string;
  readonly token: symbol;
  readonly healthToken: symbol;
  readonly healthKey: string;
}
