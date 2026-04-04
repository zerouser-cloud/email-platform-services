import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@email-platform/foundation';
import type { ParserTaskRepositoryPort } from '../../application/ports/outbound/parser-task-repository.port';
import type { ParserTask } from '../../domain/entities/parser-task.entity';
import { parserTasks } from './schema/parser-tasks.schema';
import { ParserTaskMapper } from './parser-task.mapper';

@Injectable()
export class PgParserTaskRepository implements ParserTaskRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  async findById(id: string): Promise<ParserTask | null> {
    const rows = await this.db.select().from(parserTasks).where(eq(parserTasks.id, id)).limit(1);

    const row = rows[0];
    if (!row) return null;

    return ParserTaskMapper.toDomain(row);
  }

  async save(task: ParserTask): Promise<void> {
    await this.db
      .insert(parserTasks)
      .values(ParserTaskMapper.toPersistence(task))
      .onConflictDoUpdate({
        target: parserTasks.id,
        set: {
          status: task.status,
          category: task.category,
          updatedAt: new Date(),
        },
      });
  }
}
