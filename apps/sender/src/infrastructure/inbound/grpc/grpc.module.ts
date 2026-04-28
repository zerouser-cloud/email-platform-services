import { Module } from '@nestjs/common';
import { SenderController } from './sender.controller';
import { AppPersistenceModule } from '../../outbound/persistence';
// Services (inbound port adapters)
import { ListCampaignsService } from '../../../application/services/list-campaigns.service';
import { GetCampaignService } from '../../../application/services/get-campaign.service';
import { CreateCampaignService } from '../../../application/services/create-campaign.service';
import { PauseCampaignService } from '../../../application/services/pause-campaign.service';
import { ResumeCampaignService } from '../../../application/services/resume-campaign.service';
import { ListRunnersService } from '../../../application/services/list-runners.service';
import { CreateRunnerService } from '../../../application/services/create-runner.service';
import { ListMessagesService } from '../../../application/services/list-messages.service';
import { CreateMessageService } from '../../../application/services/create-message.service';
import { ListMacrosService } from '../../../application/services/list-macros.service';
// Use cases (plain injectables, type-injected via constructor)
import { ListCampaignsUseCase } from '../../../application/use-cases/list-campaigns.use-case';
import { GetCampaignUseCase } from '../../../application/use-cases/get-campaign.use-case';
import { CreateCampaignUseCase } from '../../../application/use-cases/create-campaign.use-case';
import { TransitionCampaignStatusUseCase } from '../../../application/use-cases/transition-campaign-status.use-case';
import { ListRunnersUseCase } from '../../../application/use-cases/list-runners.use-case';
import { CreateRunnerUseCase } from '../../../application/use-cases/create-runner.use-case';
import { ListMessagesUseCase } from '../../../application/use-cases/list-messages.use-case';
import { CreateMessageUseCase } from '../../../application/use-cases/create-message.use-case';
import { ListMacrosUseCase } from '../../../application/use-cases/list-macros.use-case';
// DI tokens (inbound ports — D-11b: kept at root)
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
} from '../../../sender.constants';

/**
 * Inbound gRPC composer (Phase 999.11.2 D-03, D-06).
 *
 * Owns the gRPC controller AND the port → service bindings the controller
 * consumes (Phase 999.11.2 Plan 10 DI-regression fix, Option A): cohesive with
 * hexagonal D-02 — the inbound adapter module owns the inbound port bindings it
 * drives. Use-case providers and outbound `AppPersistenceModule` are declared
 * here so the controller's transitive dependencies (Service → UseCase →
 * Repository) resolve inside this module's DI scope.
 */
@Module({
  imports: [AppPersistenceModule],
  controllers: [SenderController],
  providers: [
    // Inbound ports → services (D-02 per-feature).
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

    // Use cases — plain @Injectable providers (no Symbol tokens — type-injected)
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
export class GrpcModule {}
