import { pgSchema, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { COLUMN_LENGTH } from '@email-platform/foundation';

export const senderSchema = pgSchema('sender');

export const campaigns = senderSchema.table('campaigns', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: COLUMN_LENGTH.DEFAULT }).notNull(),
  status: varchar('status', { length: COLUMN_LENGTH.SHORT }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
