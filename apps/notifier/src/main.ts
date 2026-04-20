import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SERVICE, loadConfig } from '@email-platform/config';
import { NotifierEnvSchema, type NotifierEnv } from './infrastructure/bootstrap/config';
import { createGrpcServerOptions, SERVER, BOOTSTRAP } from '@email-platform/foundation';
import { NotifierModule } from './notifier.module';

async function bootstrap() {
  const config = loadConfig(NotifierEnvSchema) as NotifierEnv;
  const app = await NestFactory.create(NotifierModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  app.connectMicroservice(createGrpcServerOptions(SERVICE.notifier, config.PROTO_DIR));

  await app.startAllMicroservices();
  await app.listen(config.NOTIFIER_PORT, SERVER.DEFAULT_HOST);
}
bootstrap().catch((err) => {
  console.error(BOOTSTRAP.FAILED_MESSAGE, err);
  process.exit(1);
});
