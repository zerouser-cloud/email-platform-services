import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SERVICE, loadConfig } from '@email-platform/config';
import { ParserEnvSchema, type ParserEnv } from './infrastructure/config';
import { createGrpcServerOptions, SERVER, BOOTSTRAP } from '@email-platform/foundation';
import { ParserModule } from './parser.module';

async function bootstrap() {
  const config = loadConfig(ParserEnvSchema) as ParserEnv;
  const app = await NestFactory.create(ParserModule, { bufferLogs: true });

  app.useLogger(await app.resolve(Logger));
  app.enableShutdownHooks();

  app.connectMicroservice(createGrpcServerOptions(SERVICE.parser, config.PROTO_DIR));

  await app.startAllMicroservices();
  await app.listen(config.PARSER_PORT, SERVER.DEFAULT_HOST);
}
bootstrap().catch((err) => {
  console.error(BOOTSTRAP.FAILED_MESSAGE, err);
  process.exit(1);
});
