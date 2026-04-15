export interface CallOpts {
  readonly deadlineMs?: number;
}

export interface GrpcClientLogFields {
  readonly service: string;
  readonly method: string;
  readonly duration_ms: number;
  readonly status: 'OK' | 'ERROR';
  readonly correlationId: string | undefined;
}
