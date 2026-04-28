import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { HealthIndicatorService, TerminusModule } from '@nestjs/terminus';
import type { S3Client } from '@aws-sdk/client-s3';
import { S3_CLIENT, S3CoreModule, S3HealthIndicator } from '../../../internal/storage';
import { PUBLIC_BUCKET, PUBLIC_STORAGE_CONFIG_PORT } from './public.constants';
import type { PublicStorageConfig } from './public.interfaces';
import { NamespacedStorageService } from './namespaced-storage.service';
import type { NamespaceOptions } from './namespaced-storage.interface';

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
 *     healthToken: PUBLIC_STORAGE_HEALTH, // optional
 *   })
 */
@Module({})
export class SharedNamespaceModule {
  static forNamespace(opts: NamespaceOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: opts.token,
        inject: [S3_CLIENT, PUBLIC_STORAGE_CONFIG_PORT],
        useFactory: (client: S3Client, config: PublicStorageConfig): NamespacedStorageService =>
          new NamespacedStorageService(
            client,
            PUBLIC_BUCKET,
            opts.namespace,
            opts.contentType,
            config.STORAGE_PUBLIC_URL,
            config.STORAGE_MAX_UPLOAD_BYTES,
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
      imports: [S3CoreModule, TerminusModule],
      providers,
      exports: exportsArr,
    };
  }
}
