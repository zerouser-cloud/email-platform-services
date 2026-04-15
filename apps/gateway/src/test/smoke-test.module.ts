import { Module } from '@nestjs/common';
import { ParserClientModule, NotifierClientModule } from '@email-platform/foundation';
import { StorageSmokeController } from './storage-smoke.controller';

@Module({
  imports: [ParserClientModule.forRoot(), NotifierClientModule.forRoot()],
  controllers: [StorageSmokeController],
})
export class SmokeTestModule {}
