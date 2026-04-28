import type { ListTasksCommand } from '../../commands/list-tasks.command';
import type { CreateTaskResult } from './create-task.port';

export interface ListTasksPort {
  execute(cmd: ListTasksCommand): Promise<ListTasksResult>;
}

export interface ListTasksResult {
  readonly tasks: ReadonlyArray<CreateTaskResult>;
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly pages: number;
}
