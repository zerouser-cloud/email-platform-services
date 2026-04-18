import { Inject, Injectable } from '@nestjs/common';
import type { UserRepositoryPort } from '../ports/outbound/user-repository.port';
import type { User } from '../../domain/entities/user.entity';
import { USER_REPOSITORY_PORT } from '../../auth.constants';

@Injectable()
export class ValidateRefreshTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(_refreshToken: string): Promise<User> {
    throw new Error('ValidateRefreshTokenUseCase not yet implemented');
  }
}
