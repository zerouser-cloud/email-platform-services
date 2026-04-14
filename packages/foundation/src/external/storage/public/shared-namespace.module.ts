import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { S3Client } from '@aws-sdk/client-s3';
import { S3_CLIENT, S3CoreModule } from '../../../internal/storage';
import { PUBLIC_BUCKET } from './public.constants';
import { NamespacedStorageService } from './namespaced-storage.service';
import type { NamespaceOptions } from './namespaced-storage.interface';

const ENV_KEY = {
  PUBLIC_URL: 'STORAGE_PUBLIC_URL',
  MAX_UPLOAD_BYTES: 'STORAGE_MAX_UPLOAD_BYTES',
} as const;

/**
 * Factory producing a namespaced binding over the shared `public` bucket.
 *
 * One namespace == one contentType (D-12). Caller passes a Symbol `token`
 * and retrieves the service via `@Inject(token)`.
 *
 * Usage:
 *   SharedNamespaceModule.forNamespace({
 *     namespace: 'reports',
 *     contentType: CONTENT_TYPE.PDF,
 *     token: SHARED_REPORTS,
 *   })
 */
@Module({})
export class SharedNamespaceModule {
  static forNamespace(opts: NamespaceOptions): DynamicModule {
    return {
      module: SharedNamespaceModule,
      imports: [ConfigModule, S3CoreModule],
      providers: [
        {
          provide: opts.token,
          inject: [S3_CLIENT, ConfigService],
          useFactory: (client: S3Client, config: ConfigService): NamespacedStorageService =>
            new NamespacedStorageService(
              client,
              PUBLIC_BUCKET,
              opts.namespace,
              opts.contentType,
              config.get<string>(ENV_KEY.PUBLIC_URL)!,
              config.get<number>(ENV_KEY.MAX_UPLOAD_BYTES)!,
            ),
        },
      ],
      exports: [opts.token],
    };
  }
}
