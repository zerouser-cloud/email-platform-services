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

// Canonical Config Access Contract (Phase 999.11.1 D-10) — narrow config interface.
// Only fields consumed by S3CoreModule to build the S3Client. The public-URL slice
// (STORAGE_PUBLIC_URL + STORAGE_MAX_UPLOAD_BYTES) lives in PublicStorageConfig.
// The app-owned useFactory binds {SVC}_CONFIG → StorageCoreConfig shape for STORAGE_CORE_CONFIG_PORT.
export interface StorageCoreConfig {
  readonly STORAGE_PROTOCOL: string;
  readonly STORAGE_ENDPOINT: string;
  readonly STORAGE_PORT: number;
  readonly STORAGE_REGION: string;
  readonly STORAGE_ACCESS_KEY: string;
  readonly STORAGE_SECRET_KEY: string;
}
