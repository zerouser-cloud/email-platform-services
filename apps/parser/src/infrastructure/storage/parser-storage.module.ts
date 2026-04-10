import { Module } from '@nestjs/common';
import { BucketStorageModule } from '@email-platform/foundation/internal';
import {
  PARSER_STORAGE,
  PARSER_STORAGE_HEALTH,
  PARSER_STORAGE_BUCKET,
  PARSER_STORAGE_HEALTH_KEY,
} from '../../parser.constants';

@Module({
  imports: [
    BucketStorageModule.forBucket({
      bucket: PARSER_STORAGE_BUCKET,
      token: PARSER_STORAGE,
      healthToken: PARSER_STORAGE_HEALTH,
      healthKey: PARSER_STORAGE_HEALTH_KEY,
    }),
  ],
  exports: [BucketStorageModule],
})
export class ParserStorageModule {}
