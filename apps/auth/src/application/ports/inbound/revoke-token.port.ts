import type { RevokeTokenCommand } from '../../commands/revoke-token.command';

export interface RevokeTokenPort {
  execute(cmd: RevokeTokenCommand): Promise<void>;
}
