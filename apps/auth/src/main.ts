import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SERVICE, type AuthEnv } from '@email-platform/config';
import { createGrpcServerOptions, SERVER, BOOTSTRAP } from '@email-platform/foundation';
import { AUTH_CONFIG } from './infrastructure/bootstrap/config/auth-config.constants';
import { AuthModule } from './auth.module';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule, { bufferLogs: true });
  const config = app.get<AuthEnv>(AUTH_CONFIG);

  app.useLogger(await app.resolve(Logger));
  app.enableShutdownHooks();

  app.connectMicroservice(
    createGrpcServerOptions(SERVICE.auth, config.AUTH_GRPC_PORT, config.PROTO_DIR),
  );

  await app.startAllMicroservices();
  await app.listen(config.AUTH_PORT, SERVER.DEFAULT_HOST);
}
bootstrap().catch((err) => {
  console.error(BOOTSTRAP.FAILED_MESSAGE, err);
  process.exit(1);
});
