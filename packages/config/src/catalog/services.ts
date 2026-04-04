import { defineService } from './define-service';

export const SERVICE = {
  auth: defineService({
    id: 'auth',
    displayName: 'Auth',
    port: 3001,
    grpc: { port: 50051, serviceName: 'AuthService' },
  }),
  sender: defineService({
    id: 'sender',
    displayName: 'Sender',
    port: 3002,
    grpc: { port: 50052, serviceName: 'SenderService' },
  }),
  parser: defineService({
    id: 'parser',
    displayName: 'Parser',
    port: 3003,
    grpc: { port: 50053, serviceName: 'ParserService' },
  }),
  audience: defineService({
    id: 'audience',
    displayName: 'Audience',
    port: 3004,
    grpc: { port: 50054, serviceName: 'AudienceService' },
  }),
  gateway: defineService({
    id: 'gateway',
    displayName: 'Gateway',
    port: 3000,
  }),
  notifier: defineService({
    id: 'notifier',
    displayName: 'Notifier',
    port: 3005,
  }),
} as const;

export type ServiceId = keyof typeof SERVICE;

export type GrpcServiceId = {
  [K in ServiceId]: (typeof SERVICE)[K]['grpc'] extends undefined ? never : K;
}[ServiceId];
