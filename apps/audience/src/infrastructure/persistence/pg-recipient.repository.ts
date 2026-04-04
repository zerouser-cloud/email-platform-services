import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@email-platform/foundation';
import type { RecipientRepositoryPort } from '../../application/ports/outbound/recipient-repository.port';
import type { Recipient } from '../../domain/entities/recipient.entity';
import { recipients } from './schema/recipients.schema';
import { RecipientMapper } from './recipient.mapper';

@Injectable()
export class PgRecipientRepository implements RecipientRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  async findById(id: string): Promise<Recipient | null> {
    const rows = await this.db.select().from(recipients).where(eq(recipients.id, id)).limit(1);

    const row = rows[0];
    if (!row) return null;

    return RecipientMapper.toDomain(row);
  }

  async save(recipient: Recipient): Promise<void> {
    await this.db
      .insert(recipients)
      .values(RecipientMapper.toPersistence(recipient))
      .onConflictDoUpdate({
        target: recipients.id,
        set: {
          email: recipient.email,
          groupId: recipient.groupId,
          updatedAt: new Date(),
        },
      });
  }
}
