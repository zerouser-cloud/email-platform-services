import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import {
  S3_CLIENT,
  S3_DEFAULTS,
  STORAGE_ENDPOINT_SEPARATOR,
} from './storage.constants';
import { S3ShutdownService } from './s3-shutdown.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): S3Client => {
        const protocol = config.get<string>('STORAGE_PROTOCOL')!;
        const endpoint = config.get<string>('STORAGE_ENDPOINT')!;
        const port = config.get<number>('STORAGE_PORT')!;
        const region = config.get<string>('STORAGE_REGION')!;
        const accessKeyId = config.get<string>('STORAGE_ACCESS_KEY')!;
        const secretAccessKey = config.get<string>('STORAGE_SECRET_KEY')!;
        return new S3Client({
          endpoint: `${protocol}${STORAGE_ENDPOINT_SEPARATOR.SCHEME}${endpoint}${STORAGE_ENDPOINT_SEPARATOR.PORT}${port}`,
          region,
          credentials: { accessKeyId, secretAccessKey },
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
