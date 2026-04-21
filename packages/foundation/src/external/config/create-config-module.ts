import { Global, Module, type DynamicModule, type Provider } from '@nestjs/common';
import type { z } from 'zod';
import { loadConfig } from './load-config';

/**
 * Options for assembling a per-service config module via the canonical factory.
 *
 * @typeParam TSchema - The Zod schema type (typically a `ZodObject<MergeShapes<...>>`
 *                      produced by `composeSchemas(...)` from `@email-platform/config`).
 * @typeParam TEnv    - Inferred env shape, defaults to `z.infer<TSchema>`. Override
 *                      explicitly when the Zod inference diverges from the aliased
 *                      service env type (e.g., intersection alias `AudienceEnv`).
 *
 * Note on the `TSchema extends z.ZodType` shape (RESEARCH §7.5 Option 1, applied in
 * Plan 05 Task 1 as a Rule 3 scope expansion): Zod 4's `z.ZodType<TEnv>` output-only
 * generic is too wide for `composeSchemas(...)`-produced `ZodObject<MergeShapes<...>>`
 * to assign into without a cast. Taking the raw `TSchema` on the signature and deriving
 * `TEnv` via `z.infer<TSchema>` mirrors the canonical `loadConfig<T extends z.ZodType>`
 * signature and removes the need for 6× app-side casts.
 */
export interface CreateConfigModuleOptions<TSchema extends z.ZodType, TEnv = z.infer<TSchema>> {
  /** Zod schema validating `process.env` and producing the TEnv shape. */
  readonly schema: TSchema;
  /** Service-local symbol that resolves to the full TEnv value via DI (e.g., `AUDIENCE_CONFIG`). */
  readonly token: symbol;
  /**
   * Optional narrow-port slice declarations. Each entry binds a foundation-owned
   * narrow-port symbol (e.g., `PERSISTENCE_CONFIG_PORT`) to a projection of TEnv.
   * Consumers inject the narrow port instead of the full TEnv — preserves
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
 * @typeParam TEnv    - Env shape; defaults to `z.infer<TSchema>`. Pass explicitly
 *                      (`createConfigModule<typeof Schema, AliasEnv>`) when the
 *                      consumer's aliased service env type diverges from raw Zod
 *                      inference (e.g., intersection-based `AudienceEnv`).
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
