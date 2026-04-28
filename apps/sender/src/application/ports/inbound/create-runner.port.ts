import type { CreateRunnerCommand } from '../../commands/create-runner.command';

export interface CreateRunnerPort {
  execute(cmd: CreateRunnerCommand): Promise<CreateRunnerResult>;
}

export interface CreateRunnerResult {
  readonly id: string;
  readonly name: string;
  readonly proxyUrl: string;
  readonly senderEmail: string;
  readonly senderName: string;
  readonly intervalSeconds: number;
  readonly cooldownSeconds: number;
  readonly createdAt: string;
}
