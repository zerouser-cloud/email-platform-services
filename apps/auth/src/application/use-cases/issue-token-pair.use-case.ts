import { Injectable } from '@nestjs/common';
import type { User } from '../../domain/entities/user.entity';

export interface TokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
}

@Injectable()
export class IssueTokenPairUseCase {
  async execute(_user: User): Promise<TokenPair> {
    throw new Error('IssueTokenPairUseCase not yet implemented');
  }
}
