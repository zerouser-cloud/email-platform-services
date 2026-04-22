// Canonical Config Access Contract (Phase 999.11.1 D-10) — narrow config interface.
// Only fields consumed by SharedNamespaceModule when constructing public-URL
// upload facades. Lives alongside PUBLIC_STORAGE_CONFIG_PORT in the public subpath
// because it is the public-bucket-specific slice of the broader StorageConfig schema.
// The app-owned useFactory binds {SVC}_CONFIG → PublicStorageConfig shape for PUBLIC_STORAGE_CONFIG_PORT.
export interface PublicStorageConfig {
  readonly STORAGE_PUBLIC_URL: string;
  readonly STORAGE_MAX_UPLOAD_BYTES: number;
}
