import { Injectable } from '@nestjs/common';
import type { RevokeTokenPort } from '../ports/inbound/revoke-token.port';
import type { RevokeTokenCommand } from '../commands/revoke-token.command';
import { RevokeRefreshTokenUseCase } from '../use-cases/revoke-refresh-token.use-case';

@Injectable()
export class RevokeTokenService implements RevokeTokenPort {
  constructor(private readonly revokeRefreshToken: RevokeRefreshTokenUseCase) {}

  async execute(cmd: RevokeTokenCommand): Promise<void> {
    await this.revokeRefreshToken.execute(cmd.refreshToken);
  }
}
