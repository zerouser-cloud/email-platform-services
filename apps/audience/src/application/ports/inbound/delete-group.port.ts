import type { DeleteGroupCommand } from '../../commands/delete-group.command';

export interface DeleteGroupPort {
  execute(cmd: DeleteGroupCommand): Promise<void>;
}
