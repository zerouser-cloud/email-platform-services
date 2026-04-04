import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SERVICE, loadGlobalConfig } from '@email-platform/config';
import { createGrpcServerOptions, SERVER } from '@email-platform/foundation';
import { SenderModule } from './sender.module';

async function bootstrap() {
  const config = loadGlobalConfig();
  const app = await NestFactory.create(SenderModule, { bufferLogs: true });

  app.useLogger(await app.resolve(Logger));
  app.enableShutdownHooks();

  app.connectMicroservice(createGrpcServerOptions(SERVICE.sender, config.PROTO_DIR));

  await app.startAllMicroservices();
  await app.listen(config.SENDER_PORT, SERVER.DEFAULT_HOST);
}
bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
