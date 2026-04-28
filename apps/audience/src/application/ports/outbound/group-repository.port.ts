import type { Group } from '../../../domain/entities/group.entity';

export interface GroupRepositoryPort {
  findAll(
    limit: number,
    offset: number,
    userId: string,
  ): Promise<{ readonly groups: ReadonlyArray<Group>; readonly total: number }>;
  findById(id: string): Promise<Group | null>;
  save(group: Group): Promise<void>;
  deleteById(id: string): Promise<void>;
}
