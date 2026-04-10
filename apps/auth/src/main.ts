import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SERVICE, loadConfig } from '@email-platform/config';
import { AuthEnvSchema, type AuthEnv } from './infrastructure/config';
import { createGrpcServerOptions, SERVER, BOOTSTRAP } from '@email-platform/foundation';
import { AuthModule } from './auth.module';

async function bootstrap() {
  const config = loadConfig(AuthEnvSchema) as AuthEnv;
  const app = await NestFactory.create(AuthModule, { bufferLogs: true });

  app.useLogger(await app.resolve(Logger));
  app.enableShutdownHooks();

  app.connectMicroservice(createGrpcServerOptions(SERVICE.auth, config.PROTO_DIR));

  await app.startAllMicroservices();
  await app.listen(config.AUTH_PORT, SERVER.DEFAULT_HOST);
}
bootstrap().catch((err) => {
  console.error(BOOTSTRAP.FAILED_MESSAGE, err);
  process.exit(1);
});
