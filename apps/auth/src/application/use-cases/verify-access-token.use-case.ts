import { Injectable } from '@nestjs/common';

export interface AccessTokenClaims {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
  readonly organization: string;
  readonly team: string;
}

@Injectable()
export class VerifyAccessTokenUseCase {
  async execute(_accessToken: string): Promise<AccessTokenClaims> {
    throw new Error('VerifyAccessTokenUseCase not yet implemented');
  }
}
