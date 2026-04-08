import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { SenderEnvSchema } from './infrastructure/config';
import { LoggingModule, PersistenceModule, RedisHealthIndicator } from '@email-platform/foundation';
import { SenderGrpcServer } from './infrastructure/grpc/sender.grpc-server';
import { CreateCampaignUseCase } from './application/use-cases/create-campaign.use-case';
import { PgCampaignRepository } from './infrastructure/persistence/pg-campaign.repository';
import { HealthController } from './health/health.controller';
import { CAMPAIGN_REPOSITORY_PORT, CREATE_CAMPAIGN_PORT } from './sender.constants';

@Module({
  imports: [
    AppConfigModule.forRoot(SenderEnvSchema),
    PersistenceModule.forRootAsync(),
    LoggingModule.forGrpcAsync('sender'),
  ],
  controllers: [SenderGrpcServer, HealthController],
  providers: [
    { provide: CAMPAIGN_REPOSITORY_PORT, useClass: PgCampaignRepository },
    { provide: CREATE_CAMPAIGN_PORT, useClass: CreateCampaignUseCase },
    RedisHealthIndicator,
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
