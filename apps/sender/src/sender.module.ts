import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { LoggingModule } from '@email-platform/foundation';
import { SenderConfigModule } from './infrastructure/bootstrap/config';
import { HealthModule } from './infrastructure/bootstrap/health';
import { GrpcModule } from './infrastructure/inbound/grpc';
import { AppPersistenceModule } from './infrastructure/outbound/persistence';
import { GrpcClientsModule } from './infrastructure/outbound/grpc-clients';
import { HttpClientsModule } from './infrastructure/outbound/http-clients';
// Services (inbound port adapters)
import { ListCampaignsService } from './application/services/list-campaigns.service';
import { GetCampaignService } from './application/services/get-campaign.service';
import { CreateCampaignService } from './application/services/create-campaign.service';
import { PauseCampaignService } from './application/services/pause-campaign.service';
import { ResumeCampaignService } from './application/services/resume-campaign.service';
import { ListRunnersService } from './application/services/list-runners.service';
import { CreateRunnerService } from './application/services/create-runner.service';
import { ListMessagesService } from './application/services/list-messages.service';
import { CreateMessageService } from './application/services/create-message.service';
import { ListMacrosService } from './application/services/list-macros.service';
// Use cases (plain injectables, no tokens)
import { ListCampaignsUseCase } from './application/use-cases/list-campaigns.use-case';
import { GetCampaignUseCase } from './application/use-cases/get-campaign.use-case';
import { CreateCampaignUseCase } from './application/use-cases/create-campaign.use-case';
import { TransitionCampaignStatusUseCase } from './application/use-cases/transition-campaign-status.use-case';
import { ListRunnersUseCase } from './application/use-cases/list-runners.use-case';
import { CreateRunnerUseCase } from './application/use-cases/create-runner.use-case';
import { ListMessagesUseCase } from './application/use-cases/list-messages.use-case';
import { CreateMessageUseCase } from './application/use-cases/create-message.use-case';
import { ListMacrosUseCase } from './application/use-cases/list-macros.use-case';
// DI tokens (inbound ports — outbound CAMPAIGN_REPOSITORY_PORT owned by CampaignModule per D-02)
import {
  LIST_CAMPAIGNS_PORT,
  GET_CAMPAIGN_PORT,
  CREATE_CAMPAIGN_PORT,
  PAUSE_CAMPAIGN_PORT,
  RESUME_CAMPAIGN_PORT,
  LIST_RUNNERS_PORT,
  CREATE_RUNNER_PORT,
  LIST_MESSAGES_PORT,
  CREATE_MESSAGE_PORT,
  LIST_MACROS_PORT,
} from './sender.constants';

@Module({
  imports: [
    // @Global() config module — MUST precede any foundation module that uses
    // nested `SomeExternalModule.forRootAsync({inject: [CONFIG_PORT]})` (Plan 10 Rule 3 fix).
    SenderConfigModule.forRoot(),
    HealthModule,
    LoggingModule.forGrpcAsync('sender'),
    AppPersistenceModule,
    GrpcClientsModule,
    HttpClientsModule,
    GrpcModule,
  ],
  controllers: [],
  providers: [
    // Zone 2: Inbound ports → services (D-02 per-feature).
    // Zone 1 (CAMPAIGN_REPOSITORY_PORT → PgCampaignRepository) moved into
    // CampaignModule per D-02 (per-aggregate sub-module ownership).
    { provide: LIST_CAMPAIGNS_PORT, useClass: ListCampaignsService },
    { provide: GET_CAMPAIGN_PORT, useClass: GetCampaignService },
    { provide: CREATE_CAMPAIGN_PORT, useClass: CreateCampaignService },
    { provide: PAUSE_CAMPAIGN_PORT, useClass: PauseCampaignService },
    { provide: RESUME_CAMPAIGN_PORT, useClass: ResumeCampaignService },
    { provide: LIST_RUNNERS_PORT, useClass: ListRunnersService },
    { provide: CREATE_RUNNER_PORT, useClass: CreateRunnerService },
    { provide: LIST_MESSAGES_PORT, useClass: ListMessagesService },
    { provide: CREATE_MESSAGE_PORT, useClass: CreateMessageService },
    { provide: LIST_MACROS_PORT, useClass: ListMacrosService },

    // Zone 3: Use cases — plain @Injectable providers (no Symbol tokens — type-injected)
    ListCampaignsUseCase,
    GetCampaignUseCase,
    CreateCampaignUseCase,
    TransitionCampaignStatusUseCase, // shared by Pause + Resume services
    ListRunnersUseCase,
    CreateRunnerUseCase,
    ListMessagesUseCase,
    CreateMessageUseCase,
    ListMacrosUseCase,
  ],
})
export class SenderModule implements OnModuleDestroy {
  private readonly logger = new Logger(SenderModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down sender service...');
  }
}
