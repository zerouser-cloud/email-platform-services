import { Module } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { LoggingModule } from '@email-platform/foundation';
import { ParserGrpcServer } from './infrastructure/grpc/parser.grpc-server';
import { MongoParserTaskRepository } from './infrastructure/persistence/mongo-parser-task.repository';
import { StartParsingUseCase } from './application/use-cases/start-parsing.use-case';
import { HealthModule } from './health/health.module';

export const PARSER_TASK_REPOSITORY_PORT = 'ParserTaskRepositoryPort';
export const START_PARSING_PORT = 'StartParsingPort';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule.forGrpcAsync('parser'),
    HealthModule,
  ],
  controllers: [ParserGrpcServer],
  providers: [
    { provide: PARSER_TASK_REPOSITORY_PORT, useClass: MongoParserTaskRepository },
    { provide: START_PARSING_PORT, useClass: StartParsingUseCase },
  ],
})
export class ParserModule {}
