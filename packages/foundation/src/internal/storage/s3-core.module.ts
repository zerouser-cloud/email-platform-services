import { Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import {
  S3_CLIENT,
  S3_DEFAULTS,
  STORAGE_ENDPOINT_SEPARATOR,
  STORAGE_CORE_CONFIG_PORT,
} from './storage.constants';
import type { StorageCoreConfig } from './storage.interfaces';
import { S3ShutdownService } from './s3-shutdown.service';

@Module({
  providers: [
    {
      provide: S3_CLIENT,
      inject: [STORAGE_CORE_CONFIG_PORT],
      useFactory: (config: StorageCoreConfig): S3Client => {
        return new S3Client({
          endpoint: `${config.STORAGE_PROTOCOL}${STORAGE_ENDPOINT_SEPARATOR.SCHEME}${config.STORAGE_ENDPOINT}${STORAGE_ENDPOINT_SEPARATOR.PORT}${config.STORAGE_PORT}`,
          region: config.STORAGE_REGION,
          credentials: {
            accessKeyId: config.STORAGE_ACCESS_KEY,
            secretAccessKey: config.STORAGE_SECRET_KEY,
          },
          forcePathStyle: S3_DEFAULTS.FORCE_PATH_STYLE,
          requestChecksumCalculation: S3_DEFAULTS.REQUEST_CHECKSUM,
          responseChecksumValidation: S3_DEFAULTS.RESPONSE_CHECKSUM,
          maxAttempts: S3_DEFAULTS.MAX_ATTEMPTS,
        });
      },
    },
    S3ShutdownService,
  ],
  exports: [S3_CLIENT],
})
export class S3CoreModule {}
