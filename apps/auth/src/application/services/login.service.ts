import { Injectable } from '@nestjs/common';
import type { LoginPort, LoginResult } from '../ports/inbound/login.port';
import type { LoginCommand } from '../commands/login.command';
import { VerifyCredentialsUseCase } from '../use-cases/verify-credentials.use-case';
import { IssueTokenPairUseCase } from '../use-cases/issue-token-pair.use-case';

@Injectable()
export class LoginService implements LoginPort {
  constructor(
    private readonly verifyCredentials: VerifyCredentialsUseCase,
    private readonly issueTokenPair: IssueTokenPairUseCase,
  ) {}

  async execute(cmd: LoginCommand): Promise<LoginResult> {
    const user = await this.verifyCredentials.execute(cmd.email, cmd.password);
    return this.issueTokenPair.execute(user);
  }
}
