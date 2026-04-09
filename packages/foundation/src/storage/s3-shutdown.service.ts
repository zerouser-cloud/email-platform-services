import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { S3Client } from '@aws-sdk/client-s3';
import { S3_CLIENT } from './storage.constants';

@Injectable()
export class S3ShutdownService implements OnApplicationShutdown {
  constructor(@Inject(S3_CLIENT) private readonly client: S3Client) {}

  async onApplicationShutdown(_signal?: string): Promise<void> {
    this.client.destroy();
  }
}
