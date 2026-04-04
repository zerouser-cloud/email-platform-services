import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { LoggingModule } from '@email-platform/foundation';
import { SenderGrpcServer } from './infrastructure/grpc/sender.grpc-server';
import { CreateCampaignUseCase } from './application/use-cases/create-campaign.use-case';
import { HealthModule } from './health/health.module';

export const CAMPAIGN_REPOSITORY_PORT = 'CampaignRepositoryPort';
export const CREATE_CAMPAIGN_PORT = 'CreateCampaignPort';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule.forGrpcAsync('sender'),
    HealthModule,
  ],
  controllers: [SenderGrpcServer],
  providers: [
    { provide: CREATE_CAMPAIGN_PORT, useClass: CreateCampaignUseCase },
  ],
})
export class SenderModule implements OnModuleDestroy {
  private readonly logger = new Logger(SenderModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down sender service...');
    // TODO: drain gRPC server connections
    // TODO: close Redis connection
  }
}
