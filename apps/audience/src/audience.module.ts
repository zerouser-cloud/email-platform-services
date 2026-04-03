import { Module } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { LoggingModule } from '@email-platform/foundation';
import { AudienceGrpcServer } from './infrastructure/grpc/audience.grpc-server';
import { MongoRecipientRepository } from './infrastructure/persistence/mongo-recipient.repository';
import { ImportRecipientsUseCase } from './application/use-cases/import-recipients.use-case';
import { HealthModule } from './health/health.module';

export const RECIPIENT_REPOSITORY_PORT = 'RecipientRepositoryPort';
export const IMPORT_RECIPIENTS_PORT = 'ImportRecipientsPort';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule.forGrpcAsync('audience'),
    HealthModule,
  ],
  controllers: [AudienceGrpcServer],
  providers: [
    { provide: RECIPIENT_REPOSITORY_PORT, useClass: MongoRecipientRepository },
    { provide: IMPORT_RECIPIENTS_PORT, useClass: ImportRecipientsUseCase },
  ],
})
export class AudienceModule {}
