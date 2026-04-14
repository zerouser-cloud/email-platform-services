import { PUBLIC_URL, FILENAME_SANITIZE } from './public.constants';

/**
 * Build public download URL.
 *
 * D-14 amended after OQ-1 resolution: bucket `public` больше не в path —
 * virtual-hosted через Garage native web endpoint (см. CONTEXT.md D-28/D-29).
 * STORAGE_PUBLIC_URL per-env уже содержит `public.<root_domain>` как hostname.
 *
 * URL shape: `${base}/${key}`. `bucket` остаётся в сигнатуре для совместимости
 * но в URL не участвует.
 */
export function buildPublicUrl(base: string, _bucket: string, key: string): string {
  const trimmed = base.endsWith(PUBLIC_URL.PATH_SEPARATOR) ? base.slice(0, -1) : base;
  return `${trimmed}${PUBLIC_URL.PATH_SEPARATOR}${key}`;
}

/**
 * Strip path separators, NUL, and control chars; cap length.
 * UUID segment in key guarantees uniqueness regardless of filename content.
 */
export function sanitizeFilename(raw: string): string {
  const stripped = raw.replace(
    FILENAME_SANITIZE.UNSAFE_CHAR_PATTERN,
    FILENAME_SANITIZE.REPLACEMENT,
  );
  return stripped.length > FILENAME_SANITIZE.MAX_LENGTH
    ? stripped.slice(0, FILENAME_SANITIZE.MAX_LENGTH)
    : stripped;
}
