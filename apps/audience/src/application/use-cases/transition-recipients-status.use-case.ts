import { Inject, Injectable } from '@nestjs/common';
import type { RecipientRepositoryPort } from '../ports/outbound/recipient-repository.port';
import { RECIPIENT_REPOSITORY_PORT } from '../../audience.constants';

/**
 * Shared atomic use case (D-03 + D-23) — invoked by both MarkAsSentService
 * (newStatus='sent', by recipient IDs) and ResetSendStatusService
 * (newStatus='pending', by group ID). Demonstrates use case reuse across
 * services within the same bounded context.
 *
 * The audience proto gives the two RPCs distinct selectors:
 *   - markAsSent     → recipientIds: string[]
 *   - resetSendStatus → groupId: string
 * so the use case accepts a tagged selector, same target-status lifecycle.
 */
export type RecipientLifecycleStatus = 'sent' | 'pending';

export type RecipientSelector =
  | { readonly kind: 'by-ids'; readonly recipientIds: ReadonlyArray<string> }
  | { readonly kind: 'by-group'; readonly groupId: string };

@Injectable()
export class TransitionRecipientsStatusUseCase {
  constructor(
    @Inject(RECIPIENT_REPOSITORY_PORT)
    private readonly _recipients: RecipientRepositoryPort,
  ) {}

  async execute(_selector: RecipientSelector, _newStatus: RecipientLifecycleStatus): Promise<void> {
    throw new Error('TransitionRecipientsStatusUseCase not yet implemented');
  }
}
