import { DatabaseSchema, SERVICE } from '@email-platform/config';
import { loadConfig } from '@email-platform/foundation';
import { defineConfig } from 'drizzle-kit';

const env = loadConfig(DatabaseSchema);

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/persistence/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  schemaFilter: [SERVICE.parser.id],
});
