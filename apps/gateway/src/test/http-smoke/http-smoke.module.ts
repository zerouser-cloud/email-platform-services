// TODO(remove-before-release): diagnostic module — Phase 24 framework smoke only.
// D-25: controller + module scaffolding stays here; HttpSmokeClient itself and
// its construction constants live in apps/gateway/src/infrastructure/clients/http-smoke/.

import { Module } from '@nestjs/common';
import { httpClientProvider } from '@email-platform/foundation';
import {
  HttpSmokeClient,
  HTTP_SMOKE_CLIENT,
  HTTP_SMOKE_LOG_CONTEXT,
  HTTP_SMOKE_TARGET_URL,
} from '../../infrastructure/clients/http-smoke';
import { HttpSmokeController } from './http-smoke.controller';

@Module({
  providers: [
    httpClientProvider(
      {
        token: HTTP_SMOKE_CLIENT,
        logContext: HTTP_SMOKE_LOG_CONTEXT,
        baseUrlLiteral: HTTP_SMOKE_TARGET_URL,
      },
      (deps) => new HttpSmokeClient(deps),
    ),
  ],
  controllers: [HttpSmokeController],
  exports: [HTTP_SMOKE_CLIENT],
})
export class HttpSmokeModule {}
