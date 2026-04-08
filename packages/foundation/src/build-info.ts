import { readFileSync } from 'fs';
import { join } from 'path';

export interface BuildInfo {
  readonly commit: string;
  readonly branch: string;
  readonly built: string;
}

const LOCAL_BUILD_INFO: BuildInfo = {
  commit: 'local',
  branch: 'local',
  built: 'local',
} as const;

const BUILD_INFO_PATH = join(process.cwd(), 'build-info.json');

let cached: BuildInfo | null = null;

export function getBuildInfo(): BuildInfo {
  if (cached) return cached;

  try {
    const raw = readFileSync(BUILD_INFO_PATH, 'utf8');
    cached = JSON.parse(raw) as BuildInfo;
    return cached;
  } catch {
    cached = LOCAL_BUILD_INFO;
    return cached;
  }
}
