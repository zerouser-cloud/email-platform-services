import { Module } from '@nestjs/common';
import { ParserClientModule, NotifierClientModule } from '@email-platform/foundation';
import { StorageSmokeController } from './storage-smoke.controller';
// TODO(remove-before-release): Phase 24 HTTP framework smoke endpoints.
import { HttpSmokeModule } from './http-smoke/http-smoke.module';

@Module({
  imports: [ParserClientModule.forRoot(), NotifierClientModule.forRoot(), HttpSmokeModule],
  controllers: [StorageSmokeController],
})
export class SmokeTestModule {}
