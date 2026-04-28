import type { ValidateTokenCommand } from '../../commands/validate-token.command';

export interface ValidateTokenPort {
  execute(cmd: ValidateTokenCommand): Promise<ValidateTokenResult>;
}

export interface ValidateTokenResult {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
  readonly organization: string;
  readonly team: string;
}
