import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadConfig } from './config-loader';
import type { z } from 'zod';

@Module({})
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
