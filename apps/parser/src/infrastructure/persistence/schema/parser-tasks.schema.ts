import { pgSchema, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const parserSchema = pgSchema('parser');

export const parserTasks = parserSchema.table('parser_tasks', {
  id: uuid('id').primaryKey(),
  status: varchar('status', { length: 50 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
