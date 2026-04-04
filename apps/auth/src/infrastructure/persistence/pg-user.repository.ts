import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@email-platform/foundation';
import type { UserRepositoryPort } from '../../application/ports/outbound/user-repository.port';
import type { User } from '../../domain/entities/user.entity';
import { users } from './schema/users.schema';
import { UserMapper } from './user.mapper';

@Injectable()
export class PgUserRepository implements UserRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.email, email)).limit(1);

    const row = rows[0];
    if (!row) return null;

    return UserMapper.toDomain(row);
  }

  async save(user: User): Promise<void> {
    await this.db
      .insert(users)
      .values(UserMapper.toPersistence(user, ''))
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email,
          role: user.role,
          organization: user.organization,
          team: user.team,
          updatedAt: new Date(),
        },
      });
  }
}
