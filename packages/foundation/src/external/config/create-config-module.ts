import { Global, Module, type DynamicModule, type Provider } from '@nestjs/common';
import type { z } from 'zod';
import { loadConfig } from './load-config';

/**
 * Options for assembling a per-service config module via the canonical factory.
 *
 * @typeParam TSchema - The Zod schema type (typically a native `z.object({...})` spread
 *                      composed from per-app topology + peer topologies + infra blocks
 *                      per `@email-platform/config/apps/{name}/env.schema`).
 *
 * Phase 999.1.9 D-10: primary call pattern is single-generic
 * `createConfigModule<typeof XxxEnvSchema>({...})` — slice `env` is inferred
 * inline as `z.infer<TSchema>`. Call sites drop the legacy 2-generic form
 * `<typeof Schema, XxxEnv>`.
 *
 * A default-valued second type param `TEnv = z.infer<TSchema>` is retained as an
 * escape hatch for Pitfall 2 edge cases where TS struggles to resolve
 * `z.infer<TSchema>` through the generic boundary (observed for Zod 4 on
 * `composeSchemas`-produced `ZodObject<MergeShapes<T>>` schemas — the 5 legacy
 * per-service env.schemas awaiting W4-W8 migration). Consumers never pass it
 * explicitly post-migration; it defaults correctly for native `z.object({...})`
 * schemas (the target state per D-07). Scheduled for removal in W9 once all
 * env.schemas are the native-spread form.
 */
export interface CreateConfigModuleOptions<TSchema extends z.ZodType, TEnv = z.infer<TSchema>> {
  /** Zod schema validating `process.env` and producing the env shape. */
  readonly schema: TSchema;
  /** Service-local symbol that resolves to the full env value via DI (e.g., `AUDIENCE_CONFIG`). */
  readonly token: symbol;
  /**
   * Optional narrow-port slice declarations. Each entry binds a foundation-owned
   * narrow-port symbol (e.g., `PERSISTENCE_CONFIG_PORT`) to a projection of the env.
   * Consumers inject the narrow port instead of the full env — preserves
   * least-privilege per 999.11.1 D-09.
   */
  readonly narrowPorts?: ReadonlyArray<{
    readonly port: symbol;
    readonly slice: (env: TEnv) => unknown;
  }>;
}

/**
 * Anchor module for the DynamicModule return object. Nest requires a class
 * reference in `module:` — this one carries no logic, only identity.
 * Marked `@Global()` AND returned with `global: true` — belt-and-suspenders
 * for the 999.11.1 Plan 10 Rule 3 fix ensuring nested
 * `forRootAsync({inject: [*_CONFIG_PORT]})` can resolve narrow ports.
 */
@Global()
@Module({})
class ConfigModuleHolder {}

/**
 * Canonical foundation-owned factory for per-service config DI assembly.
 *
 * Replaces the hand-rolled `@Global() {Svc}ConfigModule { static forRoot() {...} }`
 * class pattern (~60 LOC per service) with a single factory call (~15-25 LOC).
 * Symmetric to `defineGrpcClient` in `../grpc/clients/`.
 *
 * Returned `DynamicModule` has `global: true` so that narrow-port providers
 * (exported via `exports: [token, ...narrowPortTokens]`) are visible to nested
 * `forRootAsync({inject: [...]})` dynamic modules (LoggingModule, ClientsModule,
 * TerminusModule) that cannot walk up to root providers otherwise.
 *
 * @typeParam TSchema - Zod schema type, inferred from the `schema` option.
 * @param opts - schema + token + optional narrowPorts.
 * @returns DynamicModule ready to be imported from the service's root composition.
 *
 * @example
 * ```typescript
 * export const AudienceConfigModule = createConfigModule({
 *   schema: AudienceEnvSchema,
 *   token: AUDIENCE_CONFIG,
 *   narrowPorts: [
 *     { port: PERSISTENCE_CONFIG_PORT, slice: (c): PersistenceConfig => ({ DATABASE_URL: c.DATABASE_URL }) },
 *   ],
 * });
 * ```
 */
export function createConfigModule<TSchema extends z.ZodType, TEnv = z.infer<TSchema>>(
  opts: CreateConfigModuleOptions<TSchema, TEnv>,
): DynamicModule {
  const configProvider: Provider = {
    provide: opts.token,
    useValue: loadConfig(opts.schema),
  };

  const narrowPortProviders: Provider[] = (opts.narrowPorts ?? []).map(({ port, slice }) => ({
    provide: port,
    inject: [opts.token],
    useFactory: (env: TEnv) => slice(env),
  }));

  const exportedTokens: symbol[] = [opts.token, ...(opts.narrowPorts ?? []).map((p) => p.port)];

  return {
    module: ConfigModuleHolder,
    global: true,
    providers: [configProvider, ...narrowPortProviders],
    exports: exportedTokens,
  };
}
