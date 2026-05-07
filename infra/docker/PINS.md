# Image Digest Pin Registry

Audit-trail for content-addressable (`@sha256:…`) base-image pins in
`infra/docker/app.Dockerfile`. Every entry below corresponds to a `FROM <image>@sha256:<digest>`
directive in the Dockerfile. Reviewers MUST cross-check the digest in this
table against the matching `FROM` line at PR-review time — do not approve a PR
that bumps a digest in the Dockerfile without bumping the corresponding row here.

## Why digest pins (not tag pins)

Tag-form pins (`:v0.4.48`, `:1.37.0-musl`) are mutable. An attacker controlling
the registry, or a registry CDN compromise, or a network MITM, can replace the
bytes behind a tag without changing the tag string. Subsequent builds would
silently consume the substituted binary into the production runner image. With
`@sha256:<digest>` the bytes are content-addressable: any substitution would
yield a different digest, and BuildKit would error with a manifest-mismatch
error rather than building.

ASVS L1 §10.3 ("verify that all third-party software components are pinned to
specific versions") and §14.2.5 ("verify that the application uses only software
with verifiable supply chain") both call for content-addressable pins for
production builds.

Real-world precedents this pattern defends against: codecov bash uploader
(2021), SolarWinds Orion (2020), `ua-parser-js` npm hijack (2021), `event-stream`
npm hijack (2018), the persistent stream of compromised Docker Hub images
flagged by Sysdig/Aqua reports throughout 2023-2024.

## Pin Registry

| Image                                      | Tag-equivalent | Digest (manifest-list)                                                    | Harvested  | Verified by                | Mediatype                                 | Platforms                                                                                                     |
| ------------------------------------------ | -------------- | ------------------------------------------------------------------------- | ---------- | -------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `ghcr.io/grpc-ecosystem/grpc-health-probe` | `v0.4.48`      | `sha256:b615f8b80a6796490b91bfe0f7f4d59cf73767d4921968495cb8b4024090e151` | 2026-05-05 | zero_user (Plan 04 Task 1) | `application/vnd.oci.image.index.v1+json` | linux/amd64, linux/arm64/v8, linux/arm/v7, linux/s390x, linux/ppc64le                                         |
| `busybox`                                  | `1.37.0-musl`  | `sha256:19b646668802469d968a05342a601e78da4322a414a7c09b1c9ee25165042138` | 2026-05-05 | zero_user (Plan 04 Task 1) | `application/vnd.oci.image.index.v1+json` | linux/amd64, linux/arm64/v8, linux/arm/v6, linux/arm/v7, linux/386, linux/ppc64le, linux/riscv64, linux/s390x |

Both digests are **manifest-list (image-index)** digests, not single-arch image
manifest digests. BuildKit resolves `$TARGETPLATFORM` against the manifest list
to select a per-arch image at build time. Per-arch image-manifest digests (the
inner `Manifests:` entries with `application/vnd.oci.image.manifest.v1+json`)
are NOT pinned here — pinning those would silently break multi-arch builds for
all architectures except the one that was harvested.

## Harvest Procedure

To re-harvest a digest (e.g. when bumping the tag-equivalent of an image):

1. Run `docker buildx imagetools inspect <image>:<new-tag>` and capture the
   top-level `Digest: sha256:…` (NOT one of the per-platform `Manifests:`
   entries — the top-level one is the manifest list).

2. Cross-check via a second tool:
   - `docker manifest inspect <image>:<new-tag>` — confirm `mediaType` is
     `application/vnd.oci.image.index.v1+json` or
     `application/vnd.docker.distribution.manifest.list.v2+json`, and
     `manifests` array has ≥ 2 platform entries (at minimum amd64 + arm64
     for our CI multi-arch contract per Phase 999.18.2 D-09+D-11).
   - Optionally `crane manifest <image>:<new-tag>` (from
     `go-containerregistry`) for a third-party check.

3. Confirm both tools report the same digest. If they disagree:
   - The registry may have pushed a new build between calls (rare race);
     re-run.
   - One tool may be reading a per-arch digest by mistake; verify the
     mediaType is image-index, not image-manifest.

4. Update both this PINS.md table AND the corresponding `FROM` line in
   `infra/docker/app.Dockerfile` in the same atomic commit.

5. Run the dual-mode runtime smoke (`pnpm start:isolated && pnpm start:native`
   per `runtime-smoke-verification` skill) to confirm the new digest's image
   still works end-to-end.

## Rotation Policy

No fixed cadence. Re-harvest when:

- Bumping the tag-equivalent (e.g. v0.4.48 → v0.4.49). Plan 03 is the
  template for tag bumps; Plan 04 is the template for tag→digest
  conversion. After both have shipped, future bumps can be done in one atomic
  commit (bump tag-equivalent in PINS.md + harvest new digest + replace the
  `@sha256:` token in Dockerfile + re-run smoke).
- A security advisory is published against the upstream image — re-harvest
  to pick up the patched build.
- The `harvested-date` field is older than ~12 months — sanity rotation, even
  without a specific advisory, to ensure we're not running on a years-stale
  build.

## Audit Evidence

Initial harvest evidence is preserved verbatim in
`.planning/phases/999.18.4-dockerfile-build-infra-hardening-iterative-refactor/999.18.4-04-DISCOVERY.md`
(Plan 04 DISCOVERY). Future re-harvests should leave their evidence in the
matching plan's DISCOVERY.md.
