export * from './gateway-config.constants';
export * from './gateway-config.module';
// Phase 999.1.9 W7: `gateway-env.schema` re-export removed — schema relocated to
// `packages/config/src/apps/gateway/env.schema.ts` and consumed via
// `@email-platform/config`. Type `GatewayEnv` + value `GatewayEnvSchema` are
// re-exported through the package root barrel; consumers (main.ts,
// throttle.module.ts, gateway-config.module.ts) import directly from
// `@email-platform/config`.
