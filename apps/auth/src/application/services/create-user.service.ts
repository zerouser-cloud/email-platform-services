import { Injectable } from '@nestjs/common';
import type { CreateUserPort, CreateUserResult } from '../ports/inbound/create-user.port';
import type { CreateUserCommand } from '../commands/create-user.command';
import { HashPasswordUseCase } from '../use-cases/hash-password.use-case';
import { PersistUserUseCase } from '../use-cases/persist-user.use-case';

@Injectable()
export class CreateUserService implements CreateUserPort {
  constructor(
    private readonly hashPassword: HashPasswordUseCase,
    private readonly persistUser: PersistUserUseCase,
  ) {}

  async execute(cmd: CreateUserCommand): Promise<CreateUserResult> {
    const hash = await this.hashPassword.execute(cmd.password);
    const user = await this.persistUser.execute(
      cmd.email,
      hash,
      cmd.role,
      cmd.organization,
      cmd.team,
    );
    // Stub response shape until business logic implemented
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      organization: user.organization,
      team: user.team,
      createdAt: new Date().toISOString(),
    };
  }
}
