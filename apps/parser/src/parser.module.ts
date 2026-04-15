import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { ParserEnvSchema } from './infrastructure/config';
import { LoggingModule, PersistenceModule } from '@email-platform/foundation';
import { ParserGrpcServer } from './infrastructure/grpc/parser.grpc-server';
import { StartParsingUseCase } from './application/use-cases/start-parsing.use-case';
import { PgParserTaskRepository } from './infrastructure/persistence/pg-parser-task.repository';
import { AppStoreSpyClientModule } from './infrastructure/clients/appstorespy';
import { StorageModule } from './infrastructure/storage';
import { HealthController } from './health/health.controller';
import { StorageSmokeController } from './test/storage-smoke.controller';
import { AppStoreSpySmokeController } from './test/appstorespy-smoke.controller';
import { PARSER_TASK_REPOSITORY_PORT, START_PARSING_PORT } from './parser.constants';

@Module({
  imports: [
    AppConfigModule.forRoot(ParserEnvSchema),
    PersistenceModule.forRootAsync(),
    StorageModule,
    LoggingModule.forGrpcAsync('parser'),
    AppStoreSpyClientModule.forRoot(),
  ],
  controllers: [
    ParserGrpcServer,
    HealthController,
    StorageSmokeController,
    AppStoreSpySmokeController,
  ],
  providers: [
    { provide: PARSER_TASK_REPOSITORY_PORT, useClass: PgParserTaskRepository },
    { provide: START_PARSING_PORT, useClass: StartParsingUseCase },
  ],
})
export class ParserModule implements OnModuleDestroy {
  private readonly logger = new Logger(ParserModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down parser service...');
    // TODO: drain gRPC server connections
  }
}
