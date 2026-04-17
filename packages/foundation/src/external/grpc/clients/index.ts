export { AudienceClientModule } from './audience/audience-client.module';
export { AudienceClient } from './audience/audience.client';
export { AUDIENCE_GRPC_HEALTH } from './audience/audience-client.constants';

export { AuthClientModule } from './auth/auth-client.module';
export { AuthClient } from './auth/auth.client';
export { AUTH_GRPC_HEALTH } from './auth/auth-client.constants';

export { ParserClientModule } from './parser/parser-client.module';
export { ParserClient } from './parser/parser.client';
export { PARSER_GRPC_HEALTH } from './parser/parser-client.constants';

export { SenderClientModule } from './sender/sender-client.module';
export { SenderClient } from './sender/sender.client';
export { SENDER_GRPC_HEALTH } from './sender/sender-client.constants';

export { NotifierClientModule } from './notifier/notifier-client.module';
export { NotifierClient } from './notifier/notifier.client';
export { NOTIFIER_GRPC_HEALTH } from './notifier/notifier-client.constants';

// Shared primitives (type-only exposure for consumer typing of deadline opts):
export type { CallOpts } from './grpc-client-logging.types';

// Health indicator class — type-only export so consumers (e.g. gateway health controller)
// can declare injected fields; runtime providers are registered inside each *ClientModule.
export { GrpcClientHealthIndicator } from './grpc-client-health.indicator';

// Factory helper — encapsulates gRPC client module boilerplate for per-service composition:
export { defineGrpcClient } from './define-grpc-client';
export type { DefineGrpcClientOpts, GrpcClientBuildResult } from './define-grpc-client';

// Base class for typed gRPC client facades:
export { AbstractGrpcClient } from './abstract-grpc-client';
