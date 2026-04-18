import type { MarkAsSentCommand } from '../../commands/mark-as-sent.command';

export interface MarkAsSentPort {
  execute(cmd: MarkAsSentCommand): Promise<void>;
}
