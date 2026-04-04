import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/persistence/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ['sender'],
  migrations: {
    table: '__drizzle_migrations',
    schema: 'sender',
  },
});
