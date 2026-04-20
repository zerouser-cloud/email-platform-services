import { Module, type DynamicModule } from '@nestjs/common';
import { httpClientProvider } from '@email-platform/foundation';
import { CloudFnClient } from './cloudfn.client';
import { CLOUDFN_CLIENT, CLOUDFN_ENV, CLOUDFN_LOG_CONTEXT } from './cloudfn-client.constants';
import { SENDER_CONFIG } from '../../../sender.constants';
import type { SenderEnv } from '../../config';

/**
 * Phase 999.11.1 Plan 06: consumes narrow `SenderEnv` slice via
 * `envToken: SENDER_CONFIG` (D-10 cascade).
 */
@Module({})
export class CloudFnClientModule {
  static forRoot(): DynamicModule {
    return {
      module: CloudFnClientModule,
      providers: [
        httpClientProvider<CloudFnClient, SenderEnv>(
          {
            token: CLOUDFN_CLIENT,
            logContext: CLOUDFN_LOG_CONTEXT,
            envToken: SENDER_CONFIG,
            baseUrlEnvKey: CLOUDFN_ENV.BASE_URL,
          },
          (deps) => new CloudFnClient(deps, deps.env[CLOUDFN_ENV.API_KEY] as string),
        ),
      ],
      exports: [CLOUDFN_CLIENT],
    };
  }
}
