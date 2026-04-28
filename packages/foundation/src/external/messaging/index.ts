export { MessagingModule } from './messaging.module';
export { MESSAGING_HEALTH, MESSAGING_CONFIG_PORT } from './messaging.constants';
export type { MessagingHealthIndicator } from './messaging.interfaces';
// Class is internal — consumers inject MESSAGING_HEALTH Symbol; the barrel
// re-exports the type-only contract from messaging.interfaces.ts (the
// implementation class lives in messaging.health.ts but is not re-exported
// as a value, only bound via Symbol DI inside MessagingModule).
