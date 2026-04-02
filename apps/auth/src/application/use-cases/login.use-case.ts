import { Inject, Injectable } from '@nestjs/common';
import { LoginPort, LoginResult } from '../ports/inbound/login.port';
import { UserRepositoryPort } from '../ports/outbound/user-repository.port';

@Injectable()
export class LoginUseCase implements LoginPort {
  constructor(
    @Inject('UserRepositoryPort')
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(email: string, password: string): Promise<LoginResult> {
    throw new Error('LoginUseCase not yet implemented');
  }
}
