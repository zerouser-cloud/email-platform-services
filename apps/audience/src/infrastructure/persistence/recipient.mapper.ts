import { Recipient } from '../../domain/entities/recipient.entity';
import type { recipients } from './schema/recipients.schema';

type RecipientRow = typeof recipients.$inferSelect;
type NewRecipientRow = typeof recipients.$inferInsert;

export const RecipientMapper = {
  toDomain(row: RecipientRow): Recipient {
    return new Recipient(row.id, row.email, row.groupId);
  },

  toPersistence(recipient: Recipient): NewRecipientRow {
    return {
      id: recipient.id,
      email: recipient.email,
      groupId: recipient.groupId,
    };
  },
};
