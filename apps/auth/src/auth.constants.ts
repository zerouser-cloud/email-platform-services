// Outbound ports (adapters — one per aggregate)
export const USER_REPOSITORY_PORT = Symbol('UserRepositoryPort');

// Inbound ports (one per proto RPC method; healthCheck stays stubbed in controller — no port)
export const LOGIN_PORT = Symbol('LoginPort');
export const REFRESH_TOKEN_PORT = Symbol('RefreshTokenPort');
export const VALIDATE_TOKEN_PORT = Symbol('ValidateTokenPort');
export const REVOKE_TOKEN_PORT = Symbol('RevokeTokenPort');
export const CREATE_USER_PORT = Symbol('CreateUserPort');
export const LIST_USERS_PORT = Symbol('ListUsersPort');
