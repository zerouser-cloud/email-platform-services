export const MESSAGING_HEALTH = Symbol('MESSAGING_HEALTH');

// Canonical Config Access Contract (Phase 999.11.1 D-10) — narrow config port.
// App-owned useFactory projects {SVC}_CONFIG into MessagingConfig shape.
// Reserved for Phase 999.13 RabbitMQ adapter — currently unused but pre-declared
// to lock D-09 zero-drift entry for the next phase.
export const MESSAGING_CONFIG_PORT = Symbol('MESSAGING_CONFIG_PORT');

// Tier-2 raw lib instance (AMQP_CLIENT) and Tier-3 defaults (AMQP_DEFAULTS,
// RMQ_HEALTH_CHECK) — to be added in Phase 999.13 plan-phase per D-09.
