import { Inject, Injectable } from '@nestjs/common';
import type { UserRepositoryPort } from '../ports/outbound/user-repository.port';
import { User } from '../../domain/entities/user.entity';
import { USER_REPOSITORY_PORT } from '../../auth.constants';

@Injectable()
export class PersistUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(
    _email: string,
    _passwordHash: string,
    _role: string,
    _organization: string,
    _team: string,
  ): Promise<User> {
    throw new Error('PersistUserUseCase not yet implemented');
  }
}
