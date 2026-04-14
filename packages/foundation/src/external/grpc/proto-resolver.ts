import { join, isAbsolute } from 'path';
import { existsSync } from 'fs';

function findMonorepoRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== '/') {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = join(dir, '..');
  }
  return startDir;
}

export function resolveProtoPath(protoName: string, protoDir: string): string {
  if (isAbsolute(protoDir)) return join(protoDir, `${protoName}.proto`);
  const root = findMonorepoRoot(process.cwd());
  return join(root, protoDir, `${protoName}.proto`);
}
