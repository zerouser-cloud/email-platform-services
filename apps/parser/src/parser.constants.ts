// Outbound ports / adapter tokens
export const PARSER_TASK_REPOSITORY_PORT = Symbol('ParserTaskRepositoryPort');

// Storage tokens (bound by ParserStorageModule / StorageModule)
export const PARSER_STORAGE = Symbol('ParserStorage');
export const PARSER_STORAGE_HEALTH = Symbol('ParserStorageHealth');
export const PARSER_STORAGE_BUCKET = 'parser';
export const PARSER_STORAGE_HEALTH_KEY = 's3:parser';

// Inbound ports (one per proto RPC; healthCheck stays stubbed in controller — no port)
export const CREATE_TASK_PORT = Symbol('CreateTaskPort');
export const LIST_TASKS_PORT = Symbol('ListTasksPort');
export const GET_TASK_PORT = Symbol('GetTaskPort');
export const GET_SETTINGS_PORT = Symbol('GetSettingsPort');
export const UPDATE_SETTINGS_PORT = Symbol('UpdateSettingsPort');

// Canonical Config Access Contract (Phase 999.11.1 D-08) — per-service {SVC}_CONFIG Symbol.
export const PARSER_CONFIG = Symbol('PARSER_CONFIG');

// Pagination defaults applied at the proto->Command boundary when the client omits pagination.
// Real pagination policy is deferred until business logic lands; these are conservative stubs.
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
} as const;
