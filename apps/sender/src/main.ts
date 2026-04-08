import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SERVICE, loadConfig } from '@email-platform/config';
import { SenderEnvSchema, type SenderEnv } from './infrastructure/config';
import { createGrpcServerOptions, SERVER, BOOTSTRAP } from '@email-platform/foundation';
import { SenderModule } from './sender.module';

async function bootstrap() {
  const config = loadConfig(SenderEnvSchema) as SenderEnv;
  const app = await NestFactory.create(SenderModule, { bufferLogs: true });

  app.useLogger(await app.resolve(Logger));
  app.enableShutdownHooks();

  app.connectMicroservice(createGrpcServerOptions(SERVICE.sender, config.PROTO_DIR));

  await app.startAllMicroservices();
  await app.listen(config.SENDER_PORT, SERVER.DEFAULT_HOST);
}
bootstrap().catch((err) => {
  console.error(BOOTSTRAP.FAILED_MESSAGE, err);
  process.exit(1);
});
