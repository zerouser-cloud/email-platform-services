import type { GetTaskCommand } from '../../commands/get-task.command';
import type { CreateTaskResult } from './create-task.port';

export interface GetTaskPort {
  execute(cmd: GetTaskCommand): Promise<CreateTaskResult>;
}
