import { ParserTask } from '../../domain/entities/parser-task.entity';
import type { parserTasks } from './schema/parser-tasks.schema';

type ParserTaskRow = typeof parserTasks.$inferSelect;
type NewParserTaskRow = typeof parserTasks.$inferInsert;

export const ParserTaskMapper = {
  toDomain(row: ParserTaskRow): ParserTask {
    return new ParserTask(row.id, row.status, row.category);
  },

  toPersistence(task: ParserTask): NewParserTaskRow {
    return {
      id: task.id,
      status: task.status,
      category: task.category,
    };
  },
};
