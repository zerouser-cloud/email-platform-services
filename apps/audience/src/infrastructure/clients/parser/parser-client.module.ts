import { Module, type DynamicModule } from '@nestjs/common';
import { SERVICE } from '@email-platform/config';
import { defineGrpcClient } from '@email-platform/foundation';
import { ParserProto } from '@email-platform/contracts';

const grpc = defineGrpcClient<ParserProto.ParserServiceClient>({
  service: SERVICE.parser,
  clientToken: SERVICE.parser.diToken,
});

// Named re-exports for local consumers (health.controller.ts via barrel — D-10).
// Do NOT export `grpc` directly — that leaks imports/providers/exports and lets consumers bypass forRoot().
export const PARSER_CLIENT_GRPC = grpc.grpcToken;
export const PARSER_GRPC_HEALTH = grpc.healthToken;

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
