import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SERVICE, type NotifierEnv } from '@email-platform/config';
import { createGrpcServerOptions, SERVER, BOOTSTRAP } from '@email-platform/foundation';
import { NOTIFIER_CONFIG } from './infrastructure/bootstrap/config/notifier-config.constants';
import { NotifierModule } from './notifier.module';

async function bootstrap() {
  const app = await NestFactory.create(NotifierModule, { bufferLogs: true });
  const config = app.get<NotifierEnv>(NOTIFIER_CONFIG);

  app.useLogger(await app.resolve(Logger));
  app.enableShutdownHooks();

  app.connectMicroservice(
    createGrpcServerOptions(SERVICE.notifier, config.NOTIFIER_GRPC_PORT, config.PROTO_DIR),
  );

  await app.startAllMicroservices();
  await app.listen(config.NOTIFIER_PORT, SERVER.DEFAULT_HOST);
}
bootstrap().catch((err) => {
  console.error(BOOTSTRAP.FAILED_MESSAGE, err);
  process.exit(1);
});
