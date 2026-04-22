import { Controller, Inject } from '@nestjs/common';
import { ParserProto, CommonProto } from '@email-platform/contracts';
import { HEALTH } from '@email-platform/foundation';
import type { CreateTaskPort } from '../../../application/ports/inbound/create-task.port';
import type { ListTasksPort } from '../../../application/ports/inbound/list-tasks.port';
import type { GetTaskPort } from '../../../application/ports/inbound/get-task.port';
import type { GetSettingsPort } from '../../../application/ports/inbound/get-settings.port';
import type { UpdateSettingsPort } from '../../../application/ports/inbound/update-settings.port';
import { CreateTaskCommand } from '../../../application/commands/create-task.command';
import { ListTasksCommand } from '../../../application/commands/list-tasks.command';
import { GetTaskCommand } from '../../../application/commands/get-task.command';
import { GetSettingsCommand } from '../../../application/commands/get-settings.command';
import { UpdateSettingsCommand } from '../../../application/commands/update-settings.command';
import {
  CREATE_TASK_PORT,
  LIST_TASKS_PORT,
  GET_TASK_PORT,
  GET_SETTINGS_PORT,
  UPDATE_SETTINGS_PORT,
  PAGINATION_DEFAULTS,
} from '../../../parser.constants';

@Controller()
@ParserProto.ParserServiceControllerMethods()
export class ParserController implements ParserProto.ParserServiceController {
  constructor(
    @Inject(CREATE_TASK_PORT) private readonly createTaskService: CreateTaskPort,
    @Inject(LIST_TASKS_PORT) private readonly listTasksService: ListTasksPort,
    @Inject(GET_TASK_PORT) private readonly getTaskService: GetTaskPort,
    @Inject(GET_SETTINGS_PORT) private readonly getSettingsService: GetSettingsPort,
    @Inject(UPDATE_SETTINGS_PORT) private readonly updateSettingsService: UpdateSettingsPort,
  ) {}

  async healthCheck(_request: CommonProto.Empty): Promise<CommonProto.HealthStatus> {
    // D-14: REST probe is the standard; gRPC health uses grpc-health-check protocol
    // registered in main.ts via createGrpcServerOptions. Stub here is acceptable.
    return { status: HEALTH.GRPC_STATUS_SERVING };
  }

  async createTask(req: ParserProto.CreateParserTaskRequest): Promise<ParserProto.ParserTask> {
    const cmd = new CreateTaskCommand(req.category, req.dateFrom, req.dateTo, req.userId);
    const result = await this.createTaskService.execute(cmd);
    return {
      id: result.id,
      category: result.category,
      status: result.status,
      dateFrom: result.dateFrom,
      dateTo: result.dateTo,
      totalFound: result.totalFound,
      totalParsed: result.totalParsed,
      csvUrl: result.csvUrl,
      userId: result.userId,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  async listTasks(req: ParserProto.ListParserTasksRequest): Promise<ParserProto.ParserTaskList> {
    const page = req.pagination?.page ?? PAGINATION_DEFAULTS.PAGE;
    const limit = req.pagination?.limit ?? PAGINATION_DEFAULTS.LIMIT;
    const cmd = new ListTasksCommand(page, limit, req.userId);
    const result = await this.listTasksService.execute(cmd);
    return {
      tasks: result.tasks.map((t) => ({
        id: t.id,
        category: t.category,
        status: t.status,
        dateFrom: t.dateFrom,
        dateTo: t.dateTo,
        totalFound: t.totalFound,
        totalParsed: t.totalParsed,
        csvUrl: t.csvUrl,
        userId: t.userId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    };
  }

  async getTask(req: ParserProto.ParserTaskIdRequest): Promise<ParserProto.ParserTask> {
    const cmd = new GetTaskCommand(req.id);
    const result = await this.getTaskService.execute(cmd);
    return {
      id: result.id,
      category: result.category,
      status: result.status,
      dateFrom: result.dateFrom,
      dateTo: result.dateTo,
      totalFound: result.totalFound,
      totalParsed: result.totalParsed,
      csvUrl: result.csvUrl,
      userId: result.userId,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  async getSettings(_request: CommonProto.Empty): Promise<ParserProto.ParserSettings> {
    const cmd = new GetSettingsCommand();
    const result = await this.getSettingsService.execute(cmd);
    return {
      maxPages: result.maxPages,
      batchSize: result.batchSize,
      autoImport: result.autoImport,
    };
  }

  async updateSettings(
    req: ParserProto.UpdateParserSettingsRequest,
  ): Promise<ParserProto.ParserSettings> {
    const cmd = new UpdateSettingsCommand(req.maxPages, req.batchSize, req.autoImport);
    const result = await this.updateSettingsService.execute(cmd);
    return {
      maxPages: result.maxPages,
      batchSize: result.batchSize,
      autoImport: result.autoImport,
    };
  }
}
