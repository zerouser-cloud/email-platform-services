import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { resolveProtoPath } from '@email-platform/foundation';
import { SERVICE } from '@email-platform/config';
import { StorageSmokeController } from './storage-smoke.controller';
import { PARSER_SMOKE_CLIENT, NOTIFIER_SMOKE_CLIENT } from './smoke-test.tokens';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: PARSER_SMOKE_CLIENT,
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: SERVICE.parser.grpc.package,
            protoPath: resolveProtoPath(
              SERVICE.parser.grpc.package,
              config.get<string>('PROTO_DIR')!,
            ),
            url: config.get<string>('PARSER_GRPC_URL')!,
          },
        }),
        inject: [ConfigService],
      },
      {
        name: NOTIFIER_SMOKE_CLIENT,
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: SERVICE.notifier.grpc.package,
            protoPath: resolveProtoPath(
              SERVICE.notifier.grpc.package,
              config.get<string>('PROTO_DIR')!,
            ),
            url: config.get<string>('NOTIFIER_GRPC_URL')!,
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [StorageSmokeController],
})
export class SmokeTestModule {}
