import { Injectable } from '@nestjs/common';

@Injectable()
export class RevokeRefreshTokenUseCase {
  async execute(_refreshToken: string): Promise<void> {
    throw new Error('RevokeRefreshTokenUseCase not yet implemented');
  }
}
