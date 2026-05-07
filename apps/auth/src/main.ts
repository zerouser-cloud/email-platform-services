import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SERVICE, type AuthEnv } from '@email-platform/config';
import { createGrpcServerOptions, BOOTSTRAP } from '@email-platform/foundation';
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
  // HTTP server dropped per Phase 999.18.1 ADR-001 §Decision (c.2) — gRPC service.
  // gRPC Health protocol registered via createGrpcServerOptions factory wiring (foundation, Path A).
}
bootstrap().catch((err) => {
  console.error(BOOTSTRAP.FAILED_MESSAGE, err);
  process.exit(1);
});
