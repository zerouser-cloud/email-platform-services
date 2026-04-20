import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { LoggingModule } from '@email-platform/foundation';
import { ParserConfigModule } from './infrastructure/bootstrap/config';
import { HealthModule } from './infrastructure/bootstrap/health';
import { GrpcModule } from './infrastructure/inbound/grpc';
import { AppPersistenceModule } from './infrastructure/outbound/persistence';
import { GrpcClientsModule } from './infrastructure/outbound/grpc-clients';
import { HttpClientsModule } from './infrastructure/outbound/http-clients';
import { AppStorageModule } from './infrastructure/outbound/storage';
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
// DI tokens (inbound ports — outbound PARSER_TASK_REPOSITORY_PORT owned by ParserTaskModule per D-02)
import {
  CREATE_TASK_PORT,
  LIST_TASKS_PORT,
  GET_TASK_PORT,
  GET_SETTINGS_PORT,
  UPDATE_SETTINGS_PORT,
} from './parser.constants';

@Module({
  imports: [
    // @Global() config module — MUST precede any foundation module that uses
    // nested `SomeExternalModule.forRootAsync({inject: [CONFIG_PORT]})` (Plan 10 Rule 3 fix).
    ParserConfigModule.forRoot(),
    HealthModule,
    LoggingModule.forGrpcAsync('parser'),
    AppPersistenceModule,
    GrpcClientsModule,
    HttpClientsModule,
    AppStorageModule,
    GrpcModule,
  ],
  controllers: [],
  providers: [
    // Zone 2: Inbound ports → services (D-02 per-feature).
    // Zone 1 (PARSER_TASK_REPOSITORY_PORT → PgParserTaskRepository) moved into
    // ParserTaskModule per D-02 (per-aggregate sub-module ownership).
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
