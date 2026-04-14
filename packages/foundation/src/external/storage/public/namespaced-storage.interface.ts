import type { Readable } from 'node:stream';

export interface NamespacedStoragePort {
  upload(filename: string, body: Readable): Promise<{ url: string; key: string }>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export interface NamespaceOptions {
  readonly namespace: string;
  readonly contentType: string;
  readonly token: symbol;
  readonly healthToken?: symbol;
}
