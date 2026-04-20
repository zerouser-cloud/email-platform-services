import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import {
  LoggingModule,
  PersistenceModule,
  LOGGING_CONFIG_PORT,
  PERSISTENCE_CONFIG_PORT,
  GRPC_CLIENT_CONFIG_PORT,
  type LoggingConfig,
  type PersistenceConfig,
  type GrpcClientConfig,
} from '@email-platform/foundation';
import { audienceConfigProvider, type AudienceEnv } from './infrastructure/config';
import { AudienceController } from './infrastructure/controllers/grpc/audience.controller';
import { HealthController } from './infrastructure/controllers/rest/health.controller';
import { PgRecipientRepository } from './infrastructure/persistence/pg-recipient.repository';
import { PgGroupRepository } from './infrastructure/persistence/pg-group.repository';
import { ParserClientModule } from './infrastructure/clients/parser';
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
// DI tokens
import {
  RECIPIENT_REPOSITORY_PORT,
  GROUP_REPOSITORY_PORT,
  LIST_GROUPS_PORT,
  CREATE_GROUP_PORT,
  DELETE_GROUP_PORT,
  LIST_RECIPIENTS_PORT,
  GET_RECIPIENTS_BY_GROUP_PORT,
  IMPORT_RECIPIENTS_PORT,
  MARK_AS_SENT_PORT,
  RESET_SEND_STATUS_PORT,
  AUDIENCE_CONFIG,
} from './audience.constants';

@Module({
  imports: [
    PersistenceModule.forRootAsync(),
    LoggingModule.forGrpcAsync('audience'),
    ParserClientModule.forRoot(),
  ],
  controllers: [AudienceController, HealthController],
  providers: [
    audienceConfigProvider,

    // Canonical Config Access Contract (Phase 999.11.1 D-10) — narrow config slices.
    {
      provide: PERSISTENCE_CONFIG_PORT,
      useFactory: (c: AudienceEnv): PersistenceConfig => ({ DATABASE_URL: c.DATABASE_URL }),
      inject: [AUDIENCE_CONFIG],
    },
    {
      provide: LOGGING_CONFIG_PORT,
      useFactory: (c: AudienceEnv): LoggingConfig => ({
        LOG_LEVEL: c.LOG_LEVEL,
        LOG_FORMAT: c.LOG_FORMAT,
      }),
      inject: [AUDIENCE_CONFIG],
    },
    {
      provide: GRPC_CLIENT_CONFIG_PORT,
      useFactory: (c: AudienceEnv): GrpcClientConfig => ({
        PROTO_DIR: c.PROTO_DIR,
        GRPC_DEADLINE_MS: c.GRPC_DEADLINE_MS,
        grpcUrls: { PARSER_GRPC_URL: c.PARSER_GRPC_URL },
      }),
      inject: [AUDIENCE_CONFIG],
    },

    // Zone 1: Outbound ports → adapters (2 aggregates: Recipient + Group)
    { provide: RECIPIENT_REPOSITORY_PORT, useClass: PgRecipientRepository },
    { provide: GROUP_REPOSITORY_PORT, useClass: PgGroupRepository },

    // Zone 2: Inbound ports → services (D-02 per-feature)
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
