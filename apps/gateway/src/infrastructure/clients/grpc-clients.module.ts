import { Module } from '@nestjs/common';
import {
  AudienceClientModule,
  AuthClientModule,
  ParserClientModule,
  SenderClientModule,
  NotifierClientModule,
} from '@email-platform/foundation';

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
