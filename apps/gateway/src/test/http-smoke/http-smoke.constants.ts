// TODO(remove-before-release): diagnostic endpoints for HTTP client framework
// verification. Hits httpbin.org for predictable HTTP responses (status codes,
// delays). Remove this whole http-smoke/ directory + module/controller refs
// once Phase 24 is signed off and we no longer need framework smoke routes.
//
// D-25: route/path/defaults constants live here alongside the controller and
// module. Client-construction constants moved to
// apps/gateway/src/infrastructure/clients/http-smoke/ so the client itself
// survives removal of this test/ subtree before release.

export const HTTP_SMOKE_ROUTE = 'test/http-client';

export const HTTP_SMOKE_PATH = {
  GET: '/get',
  // D-26: status is a function builder, not a string prefix. Consumers call
  //       HTTP_SMOKE_PATH.status('500') -> '/status/500'
  status: (code: string): string => `/status/${code}`,
} as const;

export const HTTP_SMOKE_DEFAULTS = {
  BURST_COUNT: 5,
  // 1ms guarantees AbortSignal.timeout fires before any real network roundtrip
  BURST_TIMEOUT_MS: 1,
  // D-27: previously inline magic values in http-smoke.controller.ts.
  ERROR_PREVIEW_CHARS: 200,
  DEFAULT_PROBE_STATUS: '500',
} as const;
