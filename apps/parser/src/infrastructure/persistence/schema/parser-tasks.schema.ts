import { pgSchema, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { COLUMN_LENGTH } from '@email-platform/foundation';

export const parserSchema = pgSchema('parser');

export const parserTasks = parserSchema.table('parser_tasks', {
  id: uuid('id').primaryKey(),
  status: varchar('status', { length: COLUMN_LENGTH.SHORT }).notNull(),
  category: varchar('category', { length: COLUMN_LENGTH.MEDIUM }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
