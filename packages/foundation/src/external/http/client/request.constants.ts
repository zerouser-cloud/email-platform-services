/**
 * HTTP request header constants — kills the two string literals that previously
 * lived at `abstract-http.client.ts:205` (Phase 24 magic-values issue, D-34).
 *
 * Used by `AbstractHttpClient.buildJsonInit` in Plan 02.
 */

export const HTTP_CLIENT_HEADERS = {
  CONTENT_TYPE: 'Content-Type',
  APPLICATION_JSON: 'application/json',
} as const;
