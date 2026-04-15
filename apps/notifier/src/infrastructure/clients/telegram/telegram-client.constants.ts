/**
 * Telegram HTTP adapter constants (Phase 24-03).
 * D-20: DI tokens use Symbol.for() for cross-module identity.
 * no-magic-values: every string literal lives in a named as-const binding.
 */
export const TELEGRAM_CLIENT = Symbol.for('TELEGRAM_CLIENT');

export const TELEGRAM_ENV = {
  BOT_TOKEN: 'TELEGRAM_BOT_TOKEN',
  BASE_URL: 'TELEGRAM_BASE_URL',
} as const;

export const TELEGRAM_LOG_CONTEXT = 'TelegramClient';

export const TELEGRAM_AUTH_HEADER_PREFIX = 'Bearer ';

export const TELEGRAM_PATH = {
  SEND_MESSAGE: '/sendMessage',
} as const;
