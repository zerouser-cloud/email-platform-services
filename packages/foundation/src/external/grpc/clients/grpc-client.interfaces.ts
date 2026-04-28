/**
 * Narrow gRPC client config — Phase 999.11.1 D-10 Canonical Config Access Contract
 * between foundation (Mechanism) and apps (Assembly).
 *
 * Foundation reads only the fields it needs; apps own the slice projection from
 * their {Svc}Env. Unlike single-instance modules (cache/persistence/logging), gRPC
 * clients have a per-upstream URL keyed by the `{SVC}_GRPC_URL` env var (e.g.
 * `AUTH_GRPC_URL`, `AUDIENCE_GRPC_URL`) declared on each upstream's
 * `{Svc}TopologyShape` (packages/config/src/apps/{svc}/topology.schema.ts). The
 * shape carries a `grpcUrls` lookup keyed by env-var name.
 */
export interface GrpcClientConfig {
  readonly PROTO_DIR: string;
  readonly GRPC_DEADLINE_MS: number;
  /**
   * Resolves the URL for a specific upstream service. Keyed by env-var name
   * (e.g. 'AUTH_GRPC_URL', 'AUDIENCE_GRPC_URL'). Apps include only the
   * upstreams they actually consume.
   */
  readonly grpcUrls: Readonly<Record<string, string>>;
}
