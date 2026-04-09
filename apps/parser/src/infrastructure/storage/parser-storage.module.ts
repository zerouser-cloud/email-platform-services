import { Module, type DynamicModule } from '@nestjs/common';
import { StorageModule, ReportsStorageModule } from '@email-platform/foundation';
import { PARSER_STORAGE } from '../../parser.constants';

@Module({})
export class ParserStorageModule {
  static forRootAsync(): DynamicModule {
    return {
      module: ParserStorageModule,
      imports: [
        StorageModule.forRootAsync({ bucket: 'parser', token: PARSER_STORAGE }),
        ReportsStorageModule.forRootAsync(),
      ],
      exports: [StorageModule, ReportsStorageModule],
    };
  }
}
