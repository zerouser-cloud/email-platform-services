import { Module } from '@nestjs/common';
import { ParserController } from './parser.controller';
import { AppPersistenceModule } from '../../outbound/persistence';
// Services (inbound port adapters)
import { CreateTaskService } from '../../../application/services/create-task.service';
import { ListTasksService } from '../../../application/services/list-tasks.service';
import { GetTaskService } from '../../../application/services/get-task.service';
import { GetSettingsService } from '../../../application/services/get-settings.service';
import { UpdateSettingsService } from '../../../application/services/update-settings.service';
// Use cases (plain injectables, type-injected via constructor)
import { CreateParserTaskUseCase } from '../../../application/use-cases/create-parser-task.use-case';
import { ListParserTasksUseCase } from '../../../application/use-cases/list-parser-tasks.use-case';
import { GetParserTaskUseCase } from '../../../application/use-cases/get-parser-task.use-case';
import { GetParserSettingsUseCase } from '../../../application/use-cases/get-parser-settings.use-case';
import { UpdateParserSettingsUseCase } from '../../../application/use-cases/update-parser-settings.use-case';
// DI tokens (inbound ports — D-11b: kept at root)
import {
  CREATE_TASK_PORT,
  LIST_TASKS_PORT,
  GET_TASK_PORT,
  GET_SETTINGS_PORT,
  UPDATE_SETTINGS_PORT,
} from '../../../parser.constants';

/**
 * Inbound gRPC composer (Phase 999.11.2 D-03, D-06).
 *
 * Owns the gRPC controller AND the port → service bindings the controller
 * consumes (Phase 999.11.2 Plan 10 DI-regression fix, Option A): cohesive with
 * hexagonal D-02 — the inbound adapter module owns the inbound port bindings it
 * drives. Use-case providers and outbound `AppPersistenceModule` are declared
 * here so the controller's transitive dependencies (Service → UseCase →
 * Repository) resolve inside this module's DI scope.
 */
@Module({
  imports: [AppPersistenceModule],
  controllers: [ParserController],
  providers: [
    // Inbound ports → services (D-02 per-feature).
    { provide: CREATE_TASK_PORT, useClass: CreateTaskService },
    { provide: LIST_TASKS_PORT, useClass: ListTasksService },
    { provide: GET_TASK_PORT, useClass: GetTaskService },
    { provide: GET_SETTINGS_PORT, useClass: GetSettingsService },
    { provide: UPDATE_SETTINGS_PORT, useClass: UpdateSettingsService },

    // Use cases — plain @Injectable providers (no Symbol tokens — type-injected)
    CreateParserTaskUseCase,
    ListParserTasksUseCase,
    GetParserTaskUseCase,
    GetParserSettingsUseCase,
    UpdateParserSettingsUseCase,
  ],
})
export class GrpcModule {}
