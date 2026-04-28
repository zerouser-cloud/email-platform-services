import type { LoginCommand } from '../../commands/login.command';

export interface LoginPort {
  execute(cmd: LoginCommand): Promise<LoginResult>;
}

export interface LoginResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
}
