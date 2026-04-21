import 'reflect-metadata';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { type GatewayEnv } from '@email-platform/config';
import { GrpcToHttpExceptionFilter, SERVER, CORS, BOOTSTRAP } from '@email-platform/foundation';
import { GATEWAY_CONFIG } from './infrastructure/bootstrap/config/gateway-config.constants';
import { GatewayModule } from './gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule, { bufferLogs: true });
  const config = app.get<GatewayEnv>(GATEWAY_CONFIG);

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  app.use(helmet());

  app.enableCors({
    origin:
      config.CORS_ORIGINS === CORS.WILDCARD
        ? CORS.WILDCARD
        : config.CORS_ORIGINS.split(',').map((s) => s.trim()),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(app.get(GrpcToHttpExceptionFilter));

  await app.listen(config.GATEWAY_PORT, SERVER.DEFAULT_HOST);
}
bootstrap().catch((err) => {
  console.error(BOOTSTRAP.FAILED_MESSAGE, err);
  process.exit(1);
});
