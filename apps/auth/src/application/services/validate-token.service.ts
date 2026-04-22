import { Injectable } from '@nestjs/common';
import type { ValidateTokenPort, ValidateTokenResult } from '../ports/inbound/validate-token.port';
import type { ValidateTokenCommand } from '../commands/validate-token.command';
import { VerifyAccessTokenUseCase } from '../use-cases/verify-access-token.use-case';

@Injectable()
export class ValidateTokenService implements ValidateTokenPort {
  constructor(private readonly verifyAccessToken: VerifyAccessTokenUseCase) {}

  async execute(cmd: ValidateTokenCommand): Promise<ValidateTokenResult> {
    return this.verifyAccessToken.execute(cmd.accessToken);
  }
}
