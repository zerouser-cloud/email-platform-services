import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { loadGlobalConfig } from '@email-platform/config';
import { SERVER } from '@email-platform/foundation';
import { NotifierModule } from './notifier.module';

async function bootstrap() {
  const config = loadGlobalConfig();
  const app = await NestFactory.create(NotifierModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  await app.listen(config.NOTIFIER_PORT, SERVER.DEFAULT_HOST);
}
bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
