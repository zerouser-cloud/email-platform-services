import { Module, type DynamicModule } from '@nestjs/common';
import { httpClientProvider } from '@email-platform/foundation';
import { AppStoreSpyClient } from './appstorespy.client';
import {
  APPSTORESPY_CLIENT,
  APPSTORESPY_ENV,
  APPSTORESPY_LOG_CONTEXT,
} from './appstorespy-client.constants';
import { PARSER_CONFIG } from '../../../parser.constants';
import type { ParserEnv } from '../../config';

/**
 * Phase 999.11.1 Plan 06: consumes narrow `ParserEnv` slice via
 * `envToken: PARSER_CONFIG` (D-10 cascade).
 */
@Module({})
export class AppStoreSpyClientModule {
  static forRoot(): DynamicModule {
    return {
      module: AppStoreSpyClientModule,
      providers: [
        httpClientProvider<AppStoreSpyClient, ParserEnv>(
          {
            token: APPSTORESPY_CLIENT,
            logContext: APPSTORESPY_LOG_CONTEXT,
            envToken: PARSER_CONFIG,
            baseUrlEnvKey: APPSTORESPY_ENV.BASE_URL,
          },
          (deps) => new AppStoreSpyClient(deps, deps.env[APPSTORESPY_ENV.API_KEY] as string),
        ),
      ],
      exports: [APPSTORESPY_CLIENT],
    };
  }
}
