/**
 * Narrow gRPC client config — Phase 999.11.1 D-10 Canonical Config Access Contract
 * between foundation (Mechanism) and apps (Assembly).
 *
 * Foundation reads only the fields it needs; apps own the slice projection from
 * their {Svc}Env. Unlike single-instance modules (cache/persistence/logging), gRPC
 * clients have a per-upstream URL key resolved via SERVICE.{svc}.envKeys.GRPC_URL,
 * so the shape carries a `grpcUrls` lookup keyed by env-var name.
 */
export interface GrpcClientConfig {
  readonly PROTO_DIR: string;
  readonly GRPC_DEADLINE_MS: number;
  /**
   * Resolves the URL for a specific upstream service. Keyed by env-var name
   * derived from SERVICE.{svc}.envKeys.GRPC_URL (e.g. 'AUTH_GRPC_URL',
   * 'AUDIENCE_GRPC_URL'). Apps include only the upstreams they actually consume.
   */
  readonly grpcUrls: Readonly<Record<string, string>>;
}
