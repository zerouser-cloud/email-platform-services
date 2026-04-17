import { Module, type DynamicModule } from '@nestjs/common';
import { SERVICE } from '@email-platform/config';
import { defineGrpcClient } from '@email-platform/foundation';
import { ParserClient } from './parser.client';
import { PARSER_CLIENT_GRPC, PARSER_GRPC_HEALTH } from './parser-client.constants';

const grpc = defineGrpcClient(
  {
    service: SERVICE.parser,
    clientToken: SERVICE.parser.diToken,
    healthToken: PARSER_GRPC_HEALTH,
    grpcToken: PARSER_CLIENT_GRPC,
  },
  (grpcClient, cls, deadlineMs) => new ParserClient(grpcClient, cls, deadlineMs),
);

@Module({})
export class ParserClientModule {
  static forRoot(): DynamicModule {
    return {
      module: ParserClientModule,
      imports: grpc.imports,
      providers: grpc.providers,
      exports: grpc.exports,
    };
  }
}
