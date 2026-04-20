import { Module } from '@nestjs/common';
import { AudienceController } from './audience.controller';
import { AppPersistenceModule } from '../../outbound/persistence';
// Services (inbound port adapters)
import { ListGroupsService } from '../../../application/services/list-groups.service';
import { CreateGroupService } from '../../../application/services/create-group.service';
import { DeleteGroupService } from '../../../application/services/delete-group.service';
import { ListRecipientsService } from '../../../application/services/list-recipients.service';
import { GetRecipientsByGroupService } from '../../../application/services/get-recipients-by-group.service';
import { ImportRecipientsService } from '../../../application/services/import-recipients.service';
import { MarkAsSentService } from '../../../application/services/mark-as-sent.service';
import { ResetSendStatusService } from '../../../application/services/reset-send-status.service';
// Use cases (plain injectables, type-injected via constructor)
import { ListGroupsUseCase } from '../../../application/use-cases/list-groups.use-case';
import { CreateGroupUseCase } from '../../../application/use-cases/create-group.use-case';
import { DeleteGroupUseCase } from '../../../application/use-cases/delete-group.use-case';
import { ListRecipientsUseCase } from '../../../application/use-cases/list-recipients.use-case';
import { GetRecipientsByGroupUseCase } from '../../../application/use-cases/get-recipients-by-group.use-case';
import { ImportRecipientsUseCase } from '../../../application/use-cases/import-recipients.use-case';
import { TransitionRecipientsStatusUseCase } from '../../../application/use-cases/transition-recipients-status.use-case';
// DI tokens (inbound ports — D-11b: kept at root)
import {
  LIST_GROUPS_PORT,
  CREATE_GROUP_PORT,
  DELETE_GROUP_PORT,
  LIST_RECIPIENTS_PORT,
  GET_RECIPIENTS_BY_GROUP_PORT,
  IMPORT_RECIPIENTS_PORT,
  MARK_AS_SENT_PORT,
  RESET_SEND_STATUS_PORT,
} from '../../../audience.constants';

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
  controllers: [AudienceController],
  providers: [
    // Inbound ports → services (D-02 per-feature).
    { provide: LIST_GROUPS_PORT, useClass: ListGroupsService },
    { provide: CREATE_GROUP_PORT, useClass: CreateGroupService },
    { provide: DELETE_GROUP_PORT, useClass: DeleteGroupService },
    { provide: LIST_RECIPIENTS_PORT, useClass: ListRecipientsService },
    { provide: GET_RECIPIENTS_BY_GROUP_PORT, useClass: GetRecipientsByGroupService },
    { provide: IMPORT_RECIPIENTS_PORT, useClass: ImportRecipientsService },
    { provide: MARK_AS_SENT_PORT, useClass: MarkAsSentService },
    { provide: RESET_SEND_STATUS_PORT, useClass: ResetSendStatusService },

    // Use cases — plain @Injectable providers (no Symbol tokens — type-injected)
    ListGroupsUseCase,
    CreateGroupUseCase,
    DeleteGroupUseCase,
    ListRecipientsUseCase,
    GetRecipientsByGroupUseCase,
    ImportRecipientsUseCase,
    TransitionRecipientsStatusUseCase, // shared by MarkAsSent + ResetSendStatus
  ],
})
export class GrpcModule {}
