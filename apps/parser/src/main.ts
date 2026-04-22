import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SERVICE, type ParserEnv } from '@email-platform/config';
import { createGrpcServerOptions, SERVER, BOOTSTRAP } from '@email-platform/foundation';
import { PARSER_CONFIG } from './infrastructure/bootstrap/config/parser-config.constants';
import { ParserModule } from './parser.module';

async function bootstrap() {
  const app = await NestFactory.create(ParserModule, { bufferLogs: true });
  const config = app.get<ParserEnv>(PARSER_CONFIG);

  app.useLogger(await app.resolve(Logger));
  app.enableShutdownHooks();

  app.connectMicroservice(
    createGrpcServerOptions(SERVICE.parser, config.PARSER_GRPC_PORT, config.PROTO_DIR),
  );

  await app.startAllMicroservices();
  await app.listen(config.PARSER_PORT, SERVER.DEFAULT_HOST);
}
bootstrap().catch((err) => {
  console.error(BOOTSTRAP.FAILED_MESSAGE, err);
  process.exit(1);
});
