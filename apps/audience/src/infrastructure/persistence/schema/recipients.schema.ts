import { pgSchema, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const audienceSchema = pgSchema('audience');

export const recipients = audienceSchema.table('recipients', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  groupId: uuid('group_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
