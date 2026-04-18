import { Injectable } from '@nestjs/common';
import type { RefreshTokenPort, RefreshTokenResult } from '../ports/inbound/refresh-token.port';
import type { RefreshTokenCommand } from '../commands/refresh-token.command';
import { ValidateRefreshTokenUseCase } from '../use-cases/validate-refresh-token.use-case';
import { IssueTokenPairUseCase } from '../use-cases/issue-token-pair.use-case';

@Injectable()
export class RefreshTokenService implements RefreshTokenPort {
  constructor(
    private readonly validateRefreshToken: ValidateRefreshTokenUseCase,
    private readonly issueTokenPair: IssueTokenPairUseCase,
  ) {}

  async execute(cmd: RefreshTokenCommand): Promise<RefreshTokenResult> {
    const user = await this.validateRefreshToken.execute(cmd.refreshToken);
    return this.issueTokenPair.execute(user);
  }
}
