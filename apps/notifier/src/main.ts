import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SERVICE, type NotifierEnv } from '@email-platform/config';
import { createGrpcServerOptions, BOOTSTRAP } from '@email-platform/foundation';
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
  // HTTP server dropped per Phase 999.18.1 ADR-001 §Decision (c.3) — gRPC Health-only service.
  // gRPC Health protocol registered via createGrpcServerOptions factory wiring (foundation, Path A).
}
bootstrap().catch((err) => {
  console.error(BOOTSTRAP.FAILED_MESSAGE, err);
  process.exit(1);
});
