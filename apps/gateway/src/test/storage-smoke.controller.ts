import { Controller, Get, Delete, Query, Inject, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { ParserProto, NotifierProto } from '@email-platform/contracts';
import { PARSER_SMOKE_CLIENT, NOTIFIER_SMOKE_CLIENT } from './smoke-test.tokens';
import { firstValueFrom } from 'rxjs';

const SMOKE_ROUTE_PREFIX = 'test';

@Controller(SMOKE_ROUTE_PREFIX)
export class StorageSmokeController implements OnModuleInit {
  private parserService!: ParserProto.ParserServiceClient;
  private notifierService!: NotifierProto.NotifierServiceClient;

  constructor(
    @Inject(PARSER_SMOKE_CLIENT) private readonly parserClient: ClientGrpc,
    @Inject(NOTIFIER_SMOKE_CLIENT) private readonly notifierClient: ClientGrpc,
  ) {}

  onModuleInit(): void {
    this.parserService =
      this.parserClient.getService<ParserProto.ParserServiceClient>('ParserService');
    this.notifierService =
      this.notifierClient.getService<NotifierProto.NotifierServiceClient>('NotifierService');
  }

  @Get('parser/storage-service')
  async runParserSmoke(): Promise<ParserProto.StorageSmokeResponse> {
    return firstValueFrom(this.parserService.runStorageSmoke({}));
  }

  @Delete('parser/storage-service')
  async cleanupParserSmoke(
    @Query('bucket') bucket: string,
    @Query('key') key: string,
  ): Promise<ParserProto.CleanupSmokeResponse> {
    return firstValueFrom(this.parserService.cleanupStorageSmoke({ bucket, key }));
  }

  @Get('notifier/storage-service')
  async runNotifierSmoke(): Promise<NotifierProto.StorageSmokeResponse> {
    return firstValueFrom(this.notifierService.runStorageSmoke({}));
  }

  @Delete('notifier/storage-service')
  async cleanupNotifierSmoke(
    @Query('bucket') bucket: string,
    @Query('key') key: string,
  ): Promise<NotifierProto.CleanupSmokeResponse> {
    return firstValueFrom(this.notifierService.cleanupStorageSmoke({ bucket, key }));
  }
}
