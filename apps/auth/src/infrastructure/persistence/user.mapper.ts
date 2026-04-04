import { User } from '../../domain/entities/user.entity';
import type { users } from './schema/users.schema';

type UserRow = typeof users.$inferSelect;
type NewUserRow = typeof users.$inferInsert;

export const UserMapper = {
  toDomain(row: UserRow): User {
    return new User(
      row.id,
      row.email,
      row.role,
      row.organization,
      row.team,
    );
  },

  toPersistence(user: User, passwordHash: string): NewUserRow {
    return {
      id: user.id,
      email: user.email,
      passwordHash,
      role: user.role,
      organization: user.organization,
      team: user.team,
    };
  },
};
