import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/persistence/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ['auth'],
  migrations: {
    table: '__drizzle_migrations',
    schema: 'auth',
  },
});
