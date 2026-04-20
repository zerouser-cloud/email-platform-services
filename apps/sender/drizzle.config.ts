import { DatabaseSchema } from '@email-platform/config';
import { defineConfig } from 'drizzle-kit';

const env = DatabaseSchema.parse(process.env);

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/persistence/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  schemaFilter: ['sender'],
});
