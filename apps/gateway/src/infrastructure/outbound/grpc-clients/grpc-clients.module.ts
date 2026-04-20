import { Module } from '@nestjs/common';
import { AuthClientModule } from './auth';
import { SenderClientModule } from './sender';
import { ParserClientModule } from './parser';
import { AudienceClientModule } from './audience';
import { NotifierClientModule } from './notifier';

@Module({
  imports: [
    AuthClientModule.forRoot(),
    SenderClientModule.forRoot(),
    ParserClientModule.forRoot(),
    AudienceClientModule.forRoot(),
    NotifierClientModule.forRoot(),
  ],
  exports: [
    AuthClientModule,
    SenderClientModule,
    ParserClientModule,
    AudienceClientModule,
    NotifierClientModule,
  ],
})
export class GrpcClientsModule {}
