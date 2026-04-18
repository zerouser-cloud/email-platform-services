import { Controller, Get, Delete, Query, Inject } from '@nestjs/common';
import type { Promisified } from '@email-platform/foundation';
import { SERVICE } from '@email-platform/config';
import { ParserProto, NotifierProto } from '@email-platform/contracts';

const SMOKE_ROUTE_PREFIX = 'test';

@Controller(SMOKE_ROUTE_PREFIX)
export class StorageSmokeController {
  constructor(
    @Inject(SERVICE.parser.diToken)
    private readonly parser: Promisified<ParserProto.ParserServiceClient>,
    @Inject(SERVICE.notifier.diToken)
    private readonly notifier: Promisified<NotifierProto.NotifierServiceClient>,
  ) {}

  @Get('parser/storage-service')
  runParserSmoke(): Promise<ParserProto.StorageSmokeResponse> {
    return this.parser.runStorageSmoke({});
  }

  @Delete('parser/storage-service')
  cleanupParserSmoke(
    @Query('bucket') bucket: string,
    @Query('key') key: string,
  ): Promise<ParserProto.CleanupSmokeResponse> {
    return this.parser.cleanupStorageSmoke({ bucket, key });
  }

  @Get('notifier/storage-service')
  runNotifierSmoke(): Promise<NotifierProto.StorageSmokeResponse> {
    return this.notifier.runStorageSmoke({});
  }

  @Delete('notifier/storage-service')
  cleanupNotifierSmoke(
    @Query('bucket') bucket: string,
    @Query('key') key: string,
  ): Promise<NotifierProto.CleanupSmokeResponse> {
    return this.notifier.cleanupStorageSmoke({ bucket, key });
  }
}
