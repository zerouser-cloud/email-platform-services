import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { LoggingModule, PersistenceModule } from '@email-platform/foundation';
import { AudienceGrpcServer } from './infrastructure/grpc/audience.grpc-server';
import { ImportRecipientsUseCase } from './application/use-cases/import-recipients.use-case';
import { PgRecipientRepository } from './infrastructure/persistence/pg-recipient.repository';
import { HealthController } from './health/health.controller';

export const RECIPIENT_REPOSITORY_PORT = Symbol('RecipientRepositoryPort');
export const IMPORT_RECIPIENTS_PORT = Symbol('ImportRecipientsPort');

@Module({
  imports: [
    AppConfigModule,
    PersistenceModule.forRootAsync(),
    LoggingModule.forGrpcAsync('audience'),
  ],
  controllers: [AudienceGrpcServer, HealthController],
  providers: [
    { provide: RECIPIENT_REPOSITORY_PORT, useClass: PgRecipientRepository },
    { provide: IMPORT_RECIPIENTS_PORT, useClass: ImportRecipientsUseCase },
  ],
})
export class AudienceModule implements OnModuleDestroy {
  private readonly logger = new Logger(AudienceModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down audience service...');
    // TODO: drain gRPC server connections
  }
}
