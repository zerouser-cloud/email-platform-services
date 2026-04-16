import { Module, type DynamicModule } from '@nestjs/common';
import { httpClientProvider } from '@email-platform/foundation';
import { CloudFnClient } from './cloudfn.client';
import { CLOUDFN_CLIENT, CLOUDFN_ENV, CLOUDFN_LOG_CONTEXT } from './cloudfn-client.constants';

@Module({})
export class CloudFnClientModule {
  static forRoot(): DynamicModule {
    return {
      module: CloudFnClientModule,
      providers: [
        httpClientProvider(
          {
            token: CLOUDFN_CLIENT,
            logContext: CLOUDFN_LOG_CONTEXT,
            baseUrlEnvKey: CLOUDFN_ENV.BASE_URL,
          },
          (deps) => new CloudFnClient(deps, deps.config.getOrThrow<string>(CLOUDFN_ENV.API_KEY)),
        ),
      ],
      exports: [CLOUDFN_CLIENT],
    };
  }
}
