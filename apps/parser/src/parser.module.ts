import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import {
  LoggingModule,
  PersistenceModule,
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
import { parserConfigProvider, type ParserEnv } from './infrastructure/config';
import { ParserController } from './infrastructure/controllers/grpc/parser.controller';
import { HealthController } from './infrastructure/controllers/rest/health.controller';
import { PgParserTaskRepository } from './infrastructure/persistence/pg-parser-task.repository';
import { AppStoreSpyClientModule } from './infrastructure/clients/appstorespy';
import { NotifierClientModule } from './infrastructure/clients/notifier';
import { StorageModule } from './infrastructure/storage';
// Services (inbound port adapters)
import { CreateTaskService } from './application/services/create-task.service';
import { ListTasksService } from './application/services/list-tasks.service';
import { GetTaskService } from './application/services/get-task.service';
import { GetSettingsService } from './application/services/get-settings.service';
import { UpdateSettingsService } from './application/services/update-settings.service';
// Use cases (plain injectables, no tokens)
import { CreateParserTaskUseCase } from './application/use-cases/create-parser-task.use-case';
import { ListParserTasksUseCase } from './application/use-cases/list-parser-tasks.use-case';
import { GetParserTaskUseCase } from './application/use-cases/get-parser-task.use-case';
import { GetParserSettingsUseCase } from './application/use-cases/get-parser-settings.use-case';
import { UpdateParserSettingsUseCase } from './application/use-cases/update-parser-settings.use-case';
// DI tokens
import {
  PARSER_TASK_REPOSITORY_PORT,
  CREATE_TASK_PORT,
  LIST_TASKS_PORT,
  GET_TASK_PORT,
  GET_SETTINGS_PORT,
  UPDATE_SETTINGS_PORT,
  PARSER_CONFIG,
} from './parser.constants';

@Module({
  imports: [
    PersistenceModule.forRootAsync(),
    StorageModule,
    LoggingModule.forGrpcAsync('parser'),
    AppStoreSpyClientModule.forRoot(),
    NotifierClientModule.forRoot(),
  ],
  controllers: [ParserController, HealthController],
  providers: [
    parserConfigProvider,

    // Canonical Config Access Contract (Phase 999.11.1 D-10) — narrow config slices.
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

    // Zone 1: Outbound port → adapter
    { provide: PARSER_TASK_REPOSITORY_PORT, useClass: PgParserTaskRepository },

    // Zone 2: Inbound ports → services (D-02 per-feature)
    { provide: CREATE_TASK_PORT, useClass: CreateTaskService },
    { provide: LIST_TASKS_PORT, useClass: ListTasksService },
    { provide: GET_TASK_PORT, useClass: GetTaskService },
    { provide: GET_SETTINGS_PORT, useClass: GetSettingsService },
    { provide: UPDATE_SETTINGS_PORT, useClass: UpdateSettingsService },

    // Zone 3: Use cases — plain @Injectable providers (no Symbol tokens — type-injected)
    CreateParserTaskUseCase,
    ListParserTasksUseCase,
    GetParserTaskUseCase,
    GetParserSettingsUseCase,
    UpdateParserSettingsUseCase,
  ],
})
export class ParserModule implements OnModuleDestroy {
  private readonly logger = new Logger(ParserModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down parser service...');
    // TODO: drain gRPC server connections
  }
}
