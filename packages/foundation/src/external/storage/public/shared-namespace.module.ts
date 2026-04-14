import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HealthIndicatorService, TerminusModule } from '@nestjs/terminus';
import type { S3Client } from '@aws-sdk/client-s3';
import { S3_CLIENT, S3CoreModule, S3HealthIndicator } from '../../../internal/storage';
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
 * Optional `healthToken` (Plan 02 amendment): when provided, registers an
 * additional S3HealthIndicator bound to the `public` bucket under
 * `PUBLIC_HEALTH_KEY` ('s3:public'). Lets a single consumer (e.g. notifier)
 * own the public-bucket readiness probe without double-probing elsewhere.
 *
 * Usage:
 *   SharedNamespaceModule.forNamespace({
 *     namespace: 'reports',
 *     contentType: CONTENT_TYPE.PDF,
 *     token: SHARED_REPORTS,
 *     healthToken: PUBLIC_BUCKET_HEALTH, // optional
 *   })
 */
@Module({})
export class SharedNamespaceModule {
  static forNamespace(opts: NamespaceOptions): DynamicModule {
    const providers: Provider[] = [
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
    ];
    const exportsArr: symbol[] = [opts.token];

    if (opts.healthToken !== undefined) {
      const healthToken = opts.healthToken;
      providers.push({
        provide: healthToken,
        inject: [HealthIndicatorService, S3_CLIENT],
        useFactory: (his: HealthIndicatorService, client: S3Client): S3HealthIndicator =>
          new S3HealthIndicator(his, client, PUBLIC_BUCKET),
      });
      exportsArr.push(healthToken);
    }

    return {
      module: SharedNamespaceModule,
      imports: [ConfigModule, S3CoreModule, TerminusModule],
      providers,
      exports: exportsArr,
    };
  }
}
