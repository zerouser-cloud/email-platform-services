export const PUBLIC_STORAGE = Symbol('PUBLIC_STORAGE');
export const PUBLIC_STORAGE_HEALTH = Symbol('PUBLIC_STORAGE_HEALTH');

export const PUBLIC_BUCKET = 'public';
export const PUBLIC_HEALTH_KEY = 's3:public';

// Phase 22.4: shared namespaced bindings over the single `public` bucket.
export const SHARED_REPORTS = Symbol('SHARED_REPORTS');

export const PUBLIC_URL = {
  PATH_SEPARATOR: '/',
} as const;

export const UPLOAD_DEFAULTS = {
  QUEUE_SIZE: 4,
  PART_SIZE_BYTES: 5 * 1024 * 1024,
} as const;

export const CONTENT_TYPE = {
  PDF: 'application/pdf',
} as const;

export const FILENAME_SANITIZE = {
  UNSAFE_CHAR_PATTERN: /[\\/\x00-\x1f\x7f]/g,
  REPLACEMENT: '_',
  MAX_LENGTH: 255,
} as const;
