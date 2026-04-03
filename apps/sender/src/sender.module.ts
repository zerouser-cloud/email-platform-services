import { Module } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { LoggingModule } from '@email-platform/foundation';
import { SenderGrpcServer } from './infrastructure/grpc/sender.grpc-server';
import { MongoCampaignRepository } from './infrastructure/persistence/mongo-campaign.repository';
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
    { provide: CAMPAIGN_REPOSITORY_PORT, useClass: MongoCampaignRepository },
    { provide: CREATE_CAMPAIGN_PORT, useClass: CreateCampaignUseCase },
  ],
})
export class SenderModule {}
