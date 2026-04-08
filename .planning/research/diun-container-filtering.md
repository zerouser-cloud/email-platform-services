# Diun Container Filtering: Two Instances on Same Docker Socket

**Researched:** 2026-04-06
**Confidence:** HIGH (verified via official docs + source code)

## Critical Answer

**Diun has NO provider-level container filtering.** The Docker provider config has only 6 options: `endpoint`, `apiVersion`, `tlsCertsPath`, `tlsVerify`, `watchByDefault`, `watchStopped`. There are no `filter`, `include`, `exclude`, `labels`, or name-pattern options at the provider level.

The `diun.` label prefix is **hardcoded** in Go source (`internal/provider/common.go`). It cannot be changed or namespaced per instance.

## The Problem

With `watchByDefault=false`, both Diun instances use the same label `diun.enable=true` to decide what to watch. If both instances share the same Docker socket, they BOTH see ALL containers with `diun.enable=true`. There is no built-in way to scope instances.

## Solution: Combine watchByDefault=false with a Custom Gating Label

Since Diun checks `diun.enable` as a simple boolean, the solution is:

### Approach: Selective diun.enable per environment

1. **Diun-prod** (`watchByDefault=false`): only watches containers with `diun.enable=true`
2. **Diun-dev** (`watchByDefault=false`): only watches containers with `diun.enable=true`
3. **Prod containers**: set `diun.enable=true`
4. **Dev containers**: set `diun.enable=true`

This alone does NOT solve it -- both instances still see both sets.

### Actual Working Solution: Separate Docker Sockets via Docker Contexts or Proxy

**Option A: Docker Socket Proxy with label filtering (HAProxy/Tecnativa)**

Use `tecnativa/docker-socket-proxy` or a custom socat/HAProxy that exposes a filtered Docker API. Each Diun instance connects to a different proxy endpoint that only returns containers matching certain labels. This is complex and fragile.

**Option B (RECOMMENDED): Single Diun instance, use notification routing**

Run ONE Diun instance with `watchByDefault=false`. All monitored containers get `diun.enable=true`. Use `diun.notify_on` and different notification targets. However, this doesn't truly separate dev/prod monitoring.

**Option C (RECOMMENDED - SIMPLEST): Use the File provider for one instance**

- **Diun-prod**: uses Docker provider with `watchByDefault=false`, prod containers have `diun.enable=true`, dev containers do NOT have `diun.enable=true`
- **Diun-dev**: uses the **File provider** instead of Docker provider. List dev images explicitly in a YAML file.

Problem: File provider requires manually listing images, losing auto-discovery.

**Option D (ACTUALLY RECOMMENDED): Just use diun.enable selectively**

This is the simplest and correct approach:

1. **Diun-prod** config: `watchByDefault=false`, Docker provider
2. **Diun-dev** config: `watchByDefault=false`, Docker provider
3. **Prod containers**: labeled `diun.enable=true`
4. **Dev containers**: do NOT have `diun.enable=true` (or `diun.enable=false`)

Wait -- both Diun instances still see prod containers. The key insight:

**Each Diun instance has its own database (`db.path`).** Both will track the same containers, but you can configure different **notification targets** per instance. However, this means BOTH instances monitor everything with `diun.enable=true`.

### Option E (TRULY CORRECT): watchByDefault=true with diun.enable=false

Flip the logic:

- **Diun-prod** (`watchByDefault=true`): watches ALL containers by default
  - Dev containers: labeled `diun.enable=false` (excluded)
  - Result: only prod containers monitored

- **Diun-dev** (`watchByDefault=true`): watches ALL containers by default  
  - Prod containers: labeled `diun.enable=false` (excluded)
  - Result: only dev containers monitored

**Problem:** Each Diun instance needs to know about the OTHER environment's containers to exclude them. This creates a cross-dependency.

### Option F (BEST PRACTICAL SOLUTION): Two Docker Compose projects + label convention

Since `diun.enable` is the ONLY filter mechanism:

1. **Only prod containers** get `diun.enable=true`
2. **Dev containers** do NOT get `diun.enable=true`
3. **Diun-prod** runs with `watchByDefault=false` -- monitors only prod
4. **Diun-dev** runs with `watchByDefault=true` -- monitors everything
5. **Diun-dev** config: prod containers explicitly labeled `diun.enable=false`

This way:
- Diun-prod: `watchByDefault=false` -> only sees containers with `diun.enable=true` (= prod only)
- Diun-dev: `watchByDefault=true` BUT prod containers have `diun.enable=false` -> Diun-dev skips them -> only dev containers remain

### Final Recommended Configuration

```yaml
# Prod containers (docker-compose.prod.yml)
services:
  gateway:
    labels:
      - "diun.enable=true"          # Diun-prod picks this up
      # Diun-dev (watchByDefault=true) also sees it,
      # but diun.enable=true means "enable" for BOTH instances

# This approach STILL has the problem.
```

## ACTUAL DEFINITIVE ANSWER

**There is no clean built-in way to run two Diun instances watching different subsets of containers on the same Docker socket.**

The `diun.enable` label is a global toggle -- it cannot be scoped to a specific Diun instance. The label prefix `diun.` is hardcoded.

### Practical Solutions (ranked by simplicity):

#### 1. RECOMMENDED: Single Diun instance + webhook routing (simplest)

Run ONE Diun instance. Use `diun.metadata.*` labels to tag containers as `dev` or `prod`:

```yaml
# Prod container
labels:
  diun.enable: "true"
  diun.metadata.env: "prod"

# Dev container  
labels:
  diun.enable: "true"
  diun.metadata.env: "dev"
```

Configure a **webhook** notifier that receives all updates, then routes notifications based on `metadata.env` to the appropriate channel. Diun includes metadata in notification payloads.

#### 2. Two Diun instances with complementary watchByDefault + diun.enable

```
Diun-prod: watchByDefault=false
  -> Only monitors containers with diun.enable=true
  -> Set diun.enable=true ONLY on prod containers

Diun-dev: watchByDefault=true  
  -> Monitors ALL containers by default
  -> Set diun.enable=false on prod containers AND on Diun-prod's own container
  -> Result: Diun-dev monitors everything EXCEPT prod containers
```

**This works!** The logic:
- Prod containers: `diun.enable=true` (Diun-prod watches, Diun-dev watches too BUT...)
- Wait, `diun.enable=true` with `watchByDefault=true` means "yes watch" for Diun-dev too.

Correction -- with `watchByDefault=true`, `diun.enable` is only checked as an OVERRIDE:
- `watchByDefault=true` + no label = watched
- `watchByDefault=true` + `diun.enable=false` = NOT watched
- `watchByDefault=true` + `diun.enable=true` = watched
- `watchByDefault=false` + no label = NOT watched  
- `watchByDefault=false` + `diun.enable=true` = watched
- `watchByDefault=false` + `diun.enable=false` = NOT watched

So the correct setup:

```
Diun-prod (watchByDefault=false):
  - Prod containers: diun.enable=true     -> WATCHED
  - Dev containers:  (no diun.enable)     -> NOT watched
  
Diun-dev (watchByDefault=true):
  - Prod containers: diun.enable=false    -> NOT watched  
  - Dev containers:  (no diun.enable)     -> WATCHED (default=true)
```

**BUT** a container cannot have BOTH `diun.enable=true` AND `diun.enable=false`. It's one label.

#### 3. FINAL WORKING SOLUTION: Two labels trick

A single container has ONE value for `diun.enable`. But we can use the asymmetry of `watchByDefault`:

```
Diun-prod: watchByDefault=false
Diun-dev:  watchByDefault=true

Prod containers:  diun.enable=true
Dev containers:   (NO diun.enable label at all)
```

| Container | diun.enable | Diun-prod (wbd=false) | Diun-dev (wbd=true) |
|-----------|-------------|----------------------|---------------------|
| prod-gw   | true        | WATCHED              | WATCHED             |
| dev-gw    | (absent)    | not watched          | WATCHED             |

**Problem: Diun-dev still watches prod containers.** Prod has `diun.enable=true`, and with `watchByDefault=true`, `diun.enable=true` means "yes, watch".

We need prod containers to be invisible to Diun-dev. The only way is `diun.enable=false`:

```
Prod containers:  diun.enable=false   -> blocks Diun-dev
Dev containers:   (no label)          -> Diun-dev watches (wbd=true)
```

But then Diun-prod (wbd=false) won't watch prod either, because `diun.enable=false`.

**It's impossible with the built-in label mechanism alone.**

## DEFINITIVE CONCLUSION

**Two Diun instances cannot selectively monitor different container subsets on the same Docker socket using only built-in Diun configuration.** The `diun.enable` label is a single boolean shared by all instances.

### Recommended Solutions

| # | Solution | Complexity | Reliability |
|---|----------|-----------|-------------|
| 1 | **Single Diun + webhook router** | Low | High |
| 2 | **Separate Docker sockets** (Docker-in-Docker or socket proxy) | Medium | High |
| 3 | **Diun-prod=Docker provider, Diun-dev=File provider** | Low | Medium (manual image list) |
| 4 | **Single Diun + metadata labels + notification template filtering** | Low | High |

### Solution #4 Detail (Best for our case)

Single Diun instance. Use Diun's **notification template** system with `diun.metadata.env` labels:

```yaml
# All containers get:
labels:
  diun.enable: "true"
  diun.metadata.env: "prod"  # or "dev"
```

Diun notification templates support Go templating with access to `.Metadata`. Configure two notification targets (e.g., two Telegram chats or two webhook endpoints) and use template conditions to route based on env metadata.

Alternatively: one webhook endpoint that inspects the metadata and routes accordingly.

## Sources

- https://crazymax.dev/diun/providers/docker/ -- Docker provider config (6 options only)
- https://github.com/crazy-max/diun/blob/master/internal/provider/common.go -- hardcoded `diun.` label prefix
- https://github.com/crazy-max/diun/blob/master/internal/provider/docker/container.go -- container listing logic
- https://crazymax.dev/diun/config/ -- global config (no namespace/filter options)
