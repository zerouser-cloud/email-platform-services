import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { LoggingModule, PersistenceModule } from '@email-platform/foundation';
import { ParserGrpcServer } from './infrastructure/grpc/parser.grpc-server';
import { StartParsingUseCase } from './application/use-cases/start-parsing.use-case';
import { PgParserTaskRepository } from './infrastructure/persistence/pg-parser-task.repository';
import { HealthController } from './health/health.controller';

export const PARSER_TASK_REPOSITORY_PORT = Symbol('ParserTaskRepositoryPort');
export const START_PARSING_PORT = Symbol('StartParsingPort');

@Module({
  imports: [
    AppConfigModule,
    PersistenceModule.forRootAsync(),
    LoggingModule.forGrpcAsync('parser'),
  ],
  controllers: [ParserGrpcServer, HealthController],
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
