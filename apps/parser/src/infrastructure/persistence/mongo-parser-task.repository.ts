import { Injectable, NotImplementedException } from '@nestjs/common';
import { ParserTask } from '../../domain/entities/parser-task.entity';
import { ParserTaskRepositoryPort } from '../../application/ports/outbound/parser-task-repository.port';

@Injectable()
export class MongoParserTaskRepository implements ParserTaskRepositoryPort {
  async findById(_id: string): Promise<ParserTask | null> {
    throw new NotImplementedException(
      'MongoParserTaskRepository.findById not yet implemented',
    );
  }

  async save(_task: ParserTask): Promise<void> {
    throw new NotImplementedException(
      'MongoParserTaskRepository.save not yet implemented',
    );
  }
}
