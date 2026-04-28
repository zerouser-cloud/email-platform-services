import { Module, type DynamicModule } from '@nestjs/common';
import { httpClientProvider } from '@email-platform/foundation';
import { CloudFnClient } from './cloudfn.client';
import { CLOUDFN_CLIENT, CLOUDFN_ENV, CLOUDFN_LOG_CONTEXT } from './cloudfn-client.constants';
import { SENDER_CONFIG } from '../../../bootstrap/config/sender-config.constants';
import type { SenderEnv } from '@email-platform/config';

/**
 * Phase 999.11.1 Plan 06: consumes narrow `SenderEnv` slice via
 * `envToken: SENDER_CONFIG` (D-10 cascade).
 *
 * Phase 999.11.2 Pitfall 3 (2026-04-20): after the move from
 * `infrastructure/clients/cloud-functions/` to
 * `infrastructure/outbound/http-clients/cloud-functions/` AND the SENDER_CONFIG
 * relocation from root `sender.constants` → `bootstrap/config/sender-config.constants`
 * (D-10), the import depth changed from `../../../sender.constants` (3 ..) to
 * `../../../bootstrap/config/sender-config.constants` (still 3 .. because the
 * two moves net-cancel the depth shift).
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
