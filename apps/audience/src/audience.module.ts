import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { LoggingModule } from '@email-platform/foundation';
import { AudienceConfigModule } from './infrastructure/bootstrap/config';
import { HealthModule } from './infrastructure/bootstrap/health';
import { GrpcModule } from './infrastructure/inbound/grpc';
import { AppPersistenceModule } from './infrastructure/outbound/persistence';
import { GrpcClientsModule } from './infrastructure/outbound/grpc-clients';
// Services (inbound port adapters)
import { ListGroupsService } from './application/services/list-groups.service';
import { CreateGroupService } from './application/services/create-group.service';
import { DeleteGroupService } from './application/services/delete-group.service';
import { ListRecipientsService } from './application/services/list-recipients.service';
import { GetRecipientsByGroupService } from './application/services/get-recipients-by-group.service';
import { ImportRecipientsService } from './application/services/import-recipients.service';
import { MarkAsSentService } from './application/services/mark-as-sent.service';
import { ResetSendStatusService } from './application/services/reset-send-status.service';
// Use cases (plain injectables, no tokens)
import { ListGroupsUseCase } from './application/use-cases/list-groups.use-case';
import { CreateGroupUseCase } from './application/use-cases/create-group.use-case';
import { DeleteGroupUseCase } from './application/use-cases/delete-group.use-case';
import { ListRecipientsUseCase } from './application/use-cases/list-recipients.use-case';
import { GetRecipientsByGroupUseCase } from './application/use-cases/get-recipients-by-group.use-case';
import { ImportRecipientsUseCase } from './application/use-cases/import-recipients.use-case';
import { TransitionRecipientsStatusUseCase } from './application/use-cases/transition-recipients-status.use-case';
// DI tokens (domain ports — D-11b: kept at root)
import {
  LIST_GROUPS_PORT,
  CREATE_GROUP_PORT,
  DELETE_GROUP_PORT,
  LIST_RECIPIENTS_PORT,
  GET_RECIPIENTS_BY_GROUP_PORT,
  IMPORT_RECIPIENTS_PORT,
  MARK_AS_SENT_PORT,
  RESET_SEND_STATUS_PORT,
} from './audience.constants';

@Module({
  imports: [
    // @Global() config module — MUST precede any foundation module that uses
    // nested `SomeExternalModule.forRootAsync({inject: [CONFIG_PORT]})` (Plan 10 Rule 3 fix).
    AudienceConfigModule.forRoot(),
    HealthModule,
    LoggingModule.forGrpcAsync('audience'),
    AppPersistenceModule,
    GrpcClientsModule,
    GrpcModule,
  ],
  controllers: [],
  providers: [
    // Zone 2: Inbound ports → services (D-02 per-feature).
    // Outbound RECIPIENT_REPOSITORY_PORT + GROUP_REPOSITORY_PORT bindings owned by
    // RecipientModule + GroupModule (outbound/persistence/{recipient,group}).
    { provide: LIST_GROUPS_PORT, useClass: ListGroupsService },
    { provide: CREATE_GROUP_PORT, useClass: CreateGroupService },
    { provide: DELETE_GROUP_PORT, useClass: DeleteGroupService },
    { provide: LIST_RECIPIENTS_PORT, useClass: ListRecipientsService },
    { provide: GET_RECIPIENTS_BY_GROUP_PORT, useClass: GetRecipientsByGroupService },
    { provide: IMPORT_RECIPIENTS_PORT, useClass: ImportRecipientsService },
    { provide: MARK_AS_SENT_PORT, useClass: MarkAsSentService },
    { provide: RESET_SEND_STATUS_PORT, useClass: ResetSendStatusService },

    // Zone 3: Use cases — plain @Injectable providers (no Symbol tokens — type-injected)
    ListGroupsUseCase,
    CreateGroupUseCase,
    DeleteGroupUseCase,
    ListRecipientsUseCase,
    GetRecipientsByGroupUseCase,
    ImportRecipientsUseCase,
    TransitionRecipientsStatusUseCase, // shared by MarkAsSent + ResetSendStatus
  ],
})
export class AudienceModule implements OnModuleDestroy {
  private readonly logger = new Logger(AudienceModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down audience service...');
  }
}
