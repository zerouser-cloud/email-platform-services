import type { ResetSendStatusCommand } from '../../commands/reset-send-status.command';

export interface ResetSendStatusPort {
  execute(cmd: ResetSendStatusCommand): Promise<void>;
}
