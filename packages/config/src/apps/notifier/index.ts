// Per-app config for notifier service — populated in Phase 999.1.9 W8.
// topology.schema seeded earlier in W6 (parser peer spread dependency).
// W8 completes D-21 fan-out: all 3 external-API schemas now split per-service.
export * from './identity.config';
export * from './topology.schema';
export * from './env.schema';
export * from './external-apis.schema';
