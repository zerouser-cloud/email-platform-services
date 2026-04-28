import { Injectable } from '@nestjs/common';
import type { ResetSendStatusPort } from '../ports/inbound/reset-send-status.port';
import type { ResetSendStatusCommand } from '../commands/reset-send-status.command';
import { TransitionRecipientsStatusUseCase } from '../use-cases/transition-recipients-status.use-case';

@Injectable()
export class ResetSendStatusService implements ResetSendStatusPort {
  constructor(private readonly transitionRecipientsStatus: TransitionRecipientsStatusUseCase) {}

  async execute(cmd: ResetSendStatusCommand): Promise<void> {
    await this.transitionRecipientsStatus.execute(
      { kind: 'by-group', groupId: cmd.groupId },
      'pending',
    );
  }
}
