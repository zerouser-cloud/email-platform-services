import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SERVICE, type AudienceEnv } from '@email-platform/config';
import { createGrpcServerOptions, SERVER, BOOTSTRAP } from '@email-platform/foundation';
import { AUDIENCE_CONFIG } from './infrastructure/bootstrap/config/audience-config.constants';
import { AudienceModule } from './audience.module';

async function bootstrap() {
  const app = await NestFactory.create(AudienceModule, { bufferLogs: true });
  const config = app.get<AudienceEnv>(AUDIENCE_CONFIG);

  app.useLogger(await app.resolve(Logger));
  app.enableShutdownHooks();

  app.connectMicroservice(
    createGrpcServerOptions(SERVICE.audience, config.AUDIENCE_GRPC_PORT, config.PROTO_DIR),
  );

  await app.startAllMicroservices();
  await app.listen(config.AUDIENCE_PORT, SERVER.DEFAULT_HOST);
}
bootstrap().catch((err) => {
  console.error(BOOTSTRAP.FAILED_MESSAGE, err);
  process.exit(1);
});
