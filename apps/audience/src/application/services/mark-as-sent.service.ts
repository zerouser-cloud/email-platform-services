import { Injectable } from '@nestjs/common';
import type { MarkAsSentPort } from '../ports/inbound/mark-as-sent.port';
import type { MarkAsSentCommand } from '../commands/mark-as-sent.command';
import { TransitionRecipientsStatusUseCase } from '../use-cases/transition-recipients-status.use-case';

@Injectable()
export class MarkAsSentService implements MarkAsSentPort {
  constructor(private readonly transition: TransitionRecipientsStatusUseCase) {}

  async execute(cmd: MarkAsSentCommand): Promise<void> {
    await this.transition.execute({ kind: 'by-ids', recipientIds: cmd.recipientIds }, 'sent');
  }
}
