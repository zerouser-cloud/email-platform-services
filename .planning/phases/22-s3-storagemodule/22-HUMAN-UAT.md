---
status: partial
phase: 22-s3-storagemodule
source: [22-VERIFICATION.md]
started: 2026-04-09T12:50:00Z
updated: 2026-04-09T12:50:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Parser readiness against local MinIO
expected: Boot parser service against local MinIO. Hit `GET /health/ready`. Response must show two independent S3 indicator keys: `s3:parser` AND `s3:reports`. Outage of either bucket must surface independently (not collapsed into a single indicator).
why_human: Nest DI graph correctness and per-bucket HeadBucket round-trip cannot be exercised by `tsc`/`nest build` alone — project has no tests. Only a runtime boot exposes provider-binding bugs like the original CR-01 (shared STORAGE_HEALTH Symbol collision).
result: [pending]

### 2. Notifier readiness against local MinIO
expected: Boot notifier service against local MinIO. Hit `GET /health/ready`. Response must show `rabbitmq` and `s3:reports` indicators. No references to the deleted `STORAGE_HEALTH` token in error logs. No `UndefinedDependencyException` on boot.
why_human: Same reason as above — runtime DI wiring is the only way to catch graph-level bugs in Nest modules. This specifically verifies CR-02 fix (ReportsStorageModule as real @Module entering the graph).
result: [pending]

### 3. MinIO → Garage provider swap without code change
expected: In a staging `.env`, change `STORAGE_PROTOCOL=https` and `STORAGE_ENDPOINT` to a Garage-fronted URL. Re-boot parser. Upload a file via the parser's storage path. Upload succeeds without any code change. Verify endpoint URL assembled as `https://<host>:<port>`, `forcePathStyle` + `WHEN_REQUIRED` checksums remain identical between MinIO (http) and Garage (https).
why_human: Goal truth "works identically with MinIO and Garage" is only provable by actually swapping providers at runtime — automated verification can only confirm the code path exists, not that it behaves identically against a real Garage server.
result: [pending]

### 4. SIGTERM graceful shutdown with single S3Client instance
expected: Start parser service. Trigger an in-flight download from the parser bucket. Send `SIGTERM` to the process. `S3ShutdownService.onApplicationShutdown` must fire exactly ONCE (not per-bucket — single instance because `S3CoreModule` is `@Global()`). `S3Client.destroy()` called once. Process exits cleanly with in-flight request properly aborted or completed.
why_human: WR-04 fix quality (singleton shutdown) is observable only at runtime — static analysis only confirms `S3CoreModule` is `@Global` and provides `S3ShutdownService` as a plain singleton. To prove one instance exists in practice, must inspect runtime logs during shutdown.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

[none — all tests pending runtime execution]
