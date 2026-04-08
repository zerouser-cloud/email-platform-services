import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadConfig, loadGlobalConfig } from './config-loader';
import type { z } from 'zod';

/**
 * Config module with two usage modes:
 * - `AppConfigModule` (plain import) -- validates GlobalEnvSchema, backward compatible
 * - `AppConfigModule.forRoot(schema)` -- validates a custom composed schema
 *
 * Services will migrate to forRoot() in Plan 02.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadGlobalConfig],
      ignoreEnvFile: true,
      cache: true,
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {
  static forRoot(schema: z.ZodType): DynamicModule {
    return {
      module: AppConfigModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => loadConfig(schema) as Record<string, unknown>],
          ignoreEnvFile: true,
          cache: true,
        }),
      ],
      exports: [ConfigModule],
    };
  }
}
