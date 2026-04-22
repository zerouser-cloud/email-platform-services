/**
 * DI tokens for the HTTP foundation layer.
 *
 * Uses `Symbol.for()` (not `Symbol()`) for cross-module identity — matches the
 * per-vendor module convention (TELEGRAM_CLIENT, APPSTORESPY_CLIENT, etc.) and
 * CLAUDE.md § Code Style. Foundation `cache/cache.constants.ts` uses `Symbol()`
 * (same-module only); the HTTP layer intentionally deviates per CONTEXT.md D-20.
 *
 * Consumed by `httpClientProvider` (Plan 02); NOT re-exported from the public
 * foundation barrel — DI is an internal wiring concern.
 */

export const HTTP_REQUEST_EXECUTOR = Symbol.for('HTTP_REQUEST_EXECUTOR');
export const RETRY_EXECUTOR = Symbol.for('RETRY_EXECUTOR');
export const HTTP_CLIENT_LOGGER = Symbol.for('HTTP_CLIENT_LOGGER');
