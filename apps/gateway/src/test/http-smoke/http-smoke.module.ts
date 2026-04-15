// TODO(remove-before-release): diagnostic module — Phase 24 framework smoke only.

import { Module, type Provider } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { HTTP_CLIENT_DEFAULTS } from '@email-platform/foundation';
import { HttpSmokeClient } from './http-smoke.client';
import {
  HTTP_SMOKE_CLIENT,
  HTTP_SMOKE_LOG_CONTEXT,
  HTTP_SMOKE_TARGET_URL,
} from './http-smoke.constants';
import { HttpSmokeController } from './http-smoke.controller';

const clientProvider: Provider = {
  provide: HTTP_SMOKE_CLIENT,
  inject: [ClsService],
  useFactory: (cls: ClsService): HttpSmokeClient =>
    new HttpSmokeClient(
      cls,
      HTTP_SMOKE_TARGET_URL,
      HTTP_CLIENT_DEFAULTS.TIMEOUT_MS,
      {
        consecutiveThreshold: HTTP_CLIENT_DEFAULTS.CB_CONSECUTIVE_THRESHOLD,
        halfOpenAfterMs: HTTP_CLIENT_DEFAULTS.CB_HALF_OPEN_AFTER_MS,
      },
      HTTP_SMOKE_LOG_CONTEXT,
    ),
};

@Module({
  providers: [clientProvider],
  controllers: [HttpSmokeController],
  exports: [HTTP_SMOKE_CLIENT],
})
export class HttpSmokeModule {}
