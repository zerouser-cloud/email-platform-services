import type { RefreshTokenCommand } from '../../commands/refresh-token.command';

export interface RefreshTokenPort {
  execute(cmd: RefreshTokenCommand): Promise<RefreshTokenResult>;
}

export interface RefreshTokenResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
}
