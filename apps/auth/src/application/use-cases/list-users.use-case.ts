import { Inject, Injectable } from '@nestjs/common';
import type { UserRepositoryPort } from '../ports/outbound/user-repository.port';
import type { User } from '../../domain/entities/user.entity';
import { USER_REPOSITORY_PORT } from '../../auth.constants';

@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(
    _page: number,
    _limit: number,
  ): Promise<{ readonly users: ReadonlyArray<User>; readonly total: number }> {
    throw new Error('ListUsersUseCase not yet implemented');
  }
}
