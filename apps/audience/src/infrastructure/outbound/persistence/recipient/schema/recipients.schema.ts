import { pgSchema, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { COLUMN_LENGTH } from '@email-platform/foundation';

export const audienceSchema = pgSchema('audience');

export const recipients = audienceSchema.table('recipients', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: COLUMN_LENGTH.DEFAULT }).notNull(),
  groupId: uuid('group_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
