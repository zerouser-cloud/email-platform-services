import { join } from 'path';

export function resolveProtoPath(protoName: string, protoDir: string): string {
  return join(protoDir, `${protoName}.proto`);
}
