/**
 * Log event name constants for the HTTP client layer.
 *
 * Consumer-facing (logger adapters and subclasses can re-use these names).
 * Source: lifted verbatim from the original `http-client.constants.ts` in Phase 24 —
 * Phase 24.1 splits by concern; event-name group stays under `client/`.
 */

export const HTTP_CLIENT_LOG = {
  EVENT_CALL: 'http.client.call',
  EVENT_CB_TRANSITION: 'http.client.cb.transition',
  STATUS_OK: 'OK',
  STATUS_ERROR: 'ERROR',
  CB_CLOSE: 'close',
} as const;
