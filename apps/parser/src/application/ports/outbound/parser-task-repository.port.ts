import { ParserTask } from '../../../domain/entities/parser-task.entity';

export interface ParserTaskRepositoryPort {
  findById(id: string): Promise<ParserTask | null>;
  save(task: ParserTask): Promise<void>;
}
