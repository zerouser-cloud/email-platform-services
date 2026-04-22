import { Inject, Injectable } from '@nestjs/common';
import type { UserRepositoryPort } from '../ports/outbound/user-repository.port';
import type { User } from '../../domain/entities/user.entity';
import { USER_REPOSITORY_PORT } from '../../auth.constants';

@Injectable()
export class VerifyCredentialsUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(_email: string, _password: string): Promise<User> {
    throw new Error('VerifyCredentialsUseCase not yet implemented');
  }
}
