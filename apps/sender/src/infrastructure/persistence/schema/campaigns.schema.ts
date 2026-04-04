import { pgSchema, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const senderSchema = pgSchema('sender');

export const campaigns = senderSchema.table('campaigns', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
