import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService } from '@nestjs/terminus';
import { S3Client } from '@aws-sdk/client-s3';
import {
  S3_CLIENT,
  S3_DEFAULTS,
  S3_ENDPOINT,
  STORAGE_HEALTH,
} from './storage.constants';
import type { StorageModuleOptions } from './storage.interfaces';
import { S3HealthIndicator } from './s3.health';
import { S3ShutdownService } from './s3-shutdown.service';
import { S3StorageService } from './storage.service';

export function storageProviders(options: StorageModuleOptions): Provider[] {
  const s3ClientProvider: Provider = {
    provide: S3_CLIENT,
    inject: [ConfigService],
    useFactory: (config: ConfigService): S3Client => {
      const endpoint = config.get<string>('STORAGE_ENDPOINT')!;
      const port = config.get<number>('STORAGE_PORT')!;
      const region = config.get<string>('STORAGE_REGION')!;
      const accessKeyId = config.get<string>('STORAGE_ACCESS_KEY')!;
      const secretAccessKey = config.get<string>('STORAGE_SECRET_KEY')!;
      return new S3Client({
        endpoint: `${S3_ENDPOINT.PROTOCOL}${endpoint}${S3_ENDPOINT.PORT_SEPARATOR}${port}`,
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: S3_DEFAULTS.FORCE_PATH_STYLE,
        requestChecksumCalculation: S3_DEFAULTS.REQUEST_CHECKSUM,
        responseChecksumValidation: S3_DEFAULTS.RESPONSE_CHECKSUM,
        maxAttempts: S3_DEFAULTS.MAX_ATTEMPTS,
      });
    },
  };

  const storageServiceProvider: Provider = {
    provide: options.token,
    inject: [S3_CLIENT],
    useFactory: (client: S3Client): S3StorageService =>
      new S3StorageService(client, options.bucket),
  };

  const healthIndicatorProvider: Provider = {
    provide: S3HealthIndicator,
    inject: [HealthIndicatorService, S3_CLIENT],
    useFactory: (his: HealthIndicatorService, client: S3Client): S3HealthIndicator =>
      new S3HealthIndicator(his, client, options.bucket),
  };

  const storageHealthProvider: Provider = {
    provide: STORAGE_HEALTH,
    useExisting: S3HealthIndicator,
  };

  return [
    s3ClientProvider,
    storageServiceProvider,
    healthIndicatorProvider,
    storageHealthProvider,
    S3ShutdownService,
  ];
}
