import type { Readable } from 'node:stream';
import type { HealthIndicatorResult } from '@nestjs/terminus';

export interface StoragePort {
  upload(key: string, body: Buffer | Readable, contentType: string): Promise<void>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getSignedUrl(key: string, expiresInMs: number): Promise<string>;
}

export interface StorageHealthIndicator {
  isHealthy(key: string): Promise<HealthIndicatorResult>;
}

export interface StorageModuleOptions {
  bucket: string;
  token: symbol;
}
