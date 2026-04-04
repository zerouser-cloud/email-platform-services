import { Inject, Injectable } from '@nestjs/common';
import { LoginPort, LoginResult } from '../ports/inbound/login.port';
import { UserRepositoryPort } from '../ports/outbound/user-repository.port';
import { USER_REPOSITORY_PORT } from '../../auth.module';

@Injectable()
export class LoginUseCase implements LoginPort {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(email: string, password: string): Promise<LoginResult> {
    throw new Error('LoginUseCase not yet implemented');
  }
}
