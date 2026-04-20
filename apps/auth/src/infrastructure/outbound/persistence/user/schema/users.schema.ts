import { pgSchema, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { COLUMN_LENGTH } from '@email-platform/foundation';

export const authSchema = pgSchema('auth');

export const users = authSchema.table('users', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: COLUMN_LENGTH.DEFAULT }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: COLUMN_LENGTH.DEFAULT }).notNull(),
  role: varchar('role', { length: COLUMN_LENGTH.SHORT }).notNull(),
  organization: varchar('organization', { length: COLUMN_LENGTH.DEFAULT }).notNull(),
  team: varchar('team', { length: COLUMN_LENGTH.DEFAULT }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
