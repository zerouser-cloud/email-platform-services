import type { CreateTaskCommand } from '../../commands/create-task.command';

export interface CreateTaskPort {
  execute(cmd: CreateTaskCommand): Promise<CreateTaskResult>;
}

export interface CreateTaskResult {
  readonly id: string;
  readonly category: string;
  readonly status: string;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly totalFound: number;
  readonly totalParsed: number;
  readonly csvUrl: string;
  readonly userId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
