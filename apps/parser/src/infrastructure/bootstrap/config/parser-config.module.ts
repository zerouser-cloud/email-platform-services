import { Global, Module, type DynamicModule } from '@nestjs/common';
import {
  LOGGING_CONFIG_PORT,
  PERSISTENCE_CONFIG_PORT,
  STORAGE_CORE_CONFIG_PORT,
  PUBLIC_STORAGE_CONFIG_PORT,
  GRPC_CLIENT_CONFIG_PORT,
  type LoggingConfig,
  type PersistenceConfig,
  type StorageCoreConfig,
  type PublicStorageConfig,
  type GrpcClientConfig,
} from '@email-platform/foundation';
import { PARSER_CONFIG } from './parser-config.constants';
import { parserConfigProvider } from './parser-config.provider';
import type { ParserEnv } from './parser-env.schema';

/**
 * Parser config module (Phase 999.11.1 D-10 fix, 2026-04-20) — @Global() so the
 * PARSER_CONFIG + narrow `*_CONFIG_PORT` slice providers are visible to third-party
 * dynamic modules inside foundation. See Plan 10 SUMMARY "Rule 3 — NestJS DI scope
 * fix" for the root cause analysis.
 *
 * Phase 999.11.2 D-10: extracted into its own file (sibling of provider) per
 * one-file-per-export convention established by Plan 01.
 */
@Global()
@Module({})
export class ParserConfigModule {
  static forRoot(): DynamicModule {
    return {
      module: ParserConfigModule,
      providers: [
        parserConfigProvider,
        {
          provide: PERSISTENCE_CONFIG_PORT,
          useFactory: (c: ParserEnv): PersistenceConfig => ({ DATABASE_URL: c.DATABASE_URL }),
          inject: [PARSER_CONFIG],
        },
        {
          provide: LOGGING_CONFIG_PORT,
          useFactory: (c: ParserEnv): LoggingConfig => ({
            LOG_LEVEL: c.LOG_LEVEL,
            LOG_FORMAT: c.LOG_FORMAT,
          }),
          inject: [PARSER_CONFIG],
        },
        {
          provide: STORAGE_CORE_CONFIG_PORT,
          useFactory: (c: ParserEnv): StorageCoreConfig => ({
            STORAGE_PROTOCOL: c.STORAGE_PROTOCOL,
            STORAGE_ENDPOINT: c.STORAGE_ENDPOINT,
            STORAGE_PORT: c.STORAGE_PORT,
            STORAGE_REGION: c.STORAGE_REGION,
            STORAGE_ACCESS_KEY: c.STORAGE_ACCESS_KEY,
            STORAGE_SECRET_KEY: c.STORAGE_SECRET_KEY,
          }),
          inject: [PARSER_CONFIG],
        },
        {
          provide: PUBLIC_STORAGE_CONFIG_PORT,
          useFactory: (c: ParserEnv): PublicStorageConfig => ({
            STORAGE_PUBLIC_URL: c.STORAGE_PUBLIC_URL,
            STORAGE_MAX_UPLOAD_BYTES: c.STORAGE_MAX_UPLOAD_BYTES,
          }),
          inject: [PARSER_CONFIG],
        },
        {
          provide: GRPC_CLIENT_CONFIG_PORT,
          useFactory: (c: ParserEnv): GrpcClientConfig => ({
            PROTO_DIR: c.PROTO_DIR,
            GRPC_DEADLINE_MS: c.GRPC_DEADLINE_MS,
            grpcUrls: { NOTIFIER_GRPC_URL: c.NOTIFIER_GRPC_URL },
          }),
          inject: [PARSER_CONFIG],
        },
      ],
      exports: [
        PARSER_CONFIG,
        PERSISTENCE_CONFIG_PORT,
        LOGGING_CONFIG_PORT,
        STORAGE_CORE_CONFIG_PORT,
        PUBLIC_STORAGE_CONFIG_PORT,
        GRPC_CLIENT_CONFIG_PORT,
      ],
    };
  }
}
