import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SERVICE, loadConfig } from '@email-platform/config';
import { AudienceEnvSchema, type AudienceEnv } from './infrastructure/config';
import { createGrpcServerOptions, SERVER, BOOTSTRAP } from '@email-platform/foundation';
import { AudienceModule } from './audience.module';

async function bootstrap() {
  const config = loadConfig(AudienceEnvSchema) as AudienceEnv;
  const app = await NestFactory.create(AudienceModule, { bufferLogs: true });

  app.useLogger(await app.resolve(Logger));
  app.enableShutdownHooks();

  app.connectMicroservice(createGrpcServerOptions(SERVICE.audience, config.PROTO_DIR));

  await app.startAllMicroservices();
  await app.listen(config.AUDIENCE_PORT, SERVER.DEFAULT_HOST);
}
bootstrap().catch((err) => {
  console.error(BOOTSTRAP.FAILED_MESSAGE, err);
  process.exit(1);
});
