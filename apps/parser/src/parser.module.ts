import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { LoggingModule, PersistenceModule } from '@email-platform/foundation';
import { ParserEnvSchema } from './infrastructure/config';
import { ParserController } from './infrastructure/controllers/grpc/parser.controller';
import { HealthController } from './infrastructure/controllers/rest/health.controller';
import { PgParserTaskRepository } from './infrastructure/persistence/pg-parser-task.repository';
import { AppStoreSpyClientModule } from './infrastructure/clients/appstorespy';
import { NotifierClientModule } from './infrastructure/clients/notifier';
import { StorageModule } from './infrastructure/storage';
import { AppStoreSpySmokeController } from './test/appstorespy-smoke.controller';
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
} from './parser.constants';

@Module({
  imports: [
    AppConfigModule.forRoot(ParserEnvSchema),
    PersistenceModule.forRootAsync(),
    StorageModule,
    LoggingModule.forGrpcAsync('parser'),
    AppStoreSpyClientModule.forRoot(),
    NotifierClientModule.forRoot(),
  ],
  controllers: [ParserController, HealthController, AppStoreSpySmokeController],
  providers: [
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
