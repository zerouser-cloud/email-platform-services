# Quick Task: Coolify v4 Cross-Stack Docker Networking - Research

**Researched:** 2026-04-10
**Domain:** Coolify v4 Docker networking / cross-stack DNS resolution
**Confidence:** HIGH

## Summary

Coolify v4 creates an **isolated Docker network per Service Stack**, named after the resource's UUID. Services within the same stack can resolve each other by service name, but services in different stacks are on different networks and cannot communicate by default. The "Connect To Predefined Network" checkbox is the intended mechanism for cross-stack communication, but it has **two critical issues**: (1) it is known-buggy for Service Stack and Docker-based deploys (GitHub issue #5597), and (2) even when working, it **breaks internal Docker DNS** within the stack (documented in official Coolify docs).

**Primary recommendation:** Do NOT rely on "Connect To Predefined Network" checkbox. Instead, declare the shared `coolify` network as `external: true` directly in docker-compose.prod.yml and attach all services to it. Use the Coolify-assigned container names (with UUID suffix) as hostnames for cross-stack references.

## How Coolify v4 Networking Works

### Default Behavior (per-stack isolation)
- Each Service Stack gets its own Docker bridge network named `<resource-uuid>` [CITED: coolify.io/docs/knowledge-base/docker/compose]
- Services within a stack resolve each other by compose service name (e.g., `auth`, `gateway`) [CITED: coolify.io/docs/knowledge-base/docker/compose]
- Services in different stacks are on different networks -- zero cross-stack visibility [CITED: coolify.io/docs/knowledge-base/destinations/manage]

### Container Naming
- Coolify renames containers to `<service-name>-<uuid>` format to prevent collisions [CITED: coolify.io/docs/knowledge-base/docker/compose]
- The UUID is visible in the Coolify URL bar when viewing the resource [CITED: github.com/coollabsio/coolify/discussions/3584]
- When on the `coolify` network, containers are reachable by their full Coolify-assigned name (e.g., `garage-abc123def`) [CITED: coolify.io/docs/knowledge-base/docker/compose]

### "Connect To Predefined Network" Feature
- Located in Service Stack settings (not per-service, but per-stack) [CITED: coolify.io/docs/knowledge-base/destinations/manage]
- Intended to add containers to the `coolify` network at runtime (does NOT modify the compose file) [CITED: github.com/coollabsio/coolify/issues/5597]
- **Known bug:** Does not work reliably for Service Stack or Docker-based deploys (issue #5597, confirmed in v4.0.0-beta.407+) [CITED: github.com/coollabsio/coolify/issues/5597]
- **Even when working:** Official docs warn it "will make the internal Docker DNS not work as expected" [CITED: coolify.io/docs/knowledge-base/docker/compose]
- This explains the observed behavior: enabling it on both stacks still yields NXDOMAIN

### Standalone Resources (PostgreSQL, Redis, etc.)
- Coolify one-click databases/resources are deployed differently from Service Stacks [ASSUMED]
- They appear to be placed on the `coolify` network by default, which is why PostgreSQL is reachable [ASSUMED]
- Redis hostname `uc084o00g8okkw00koc844k8` is a Coolify-generated UUID-based name -- if the app stack is NOT on the `coolify` network, it cannot resolve this hostname [VERIFIED: matches Coolify UUID naming pattern from docs]

## Solution: Manual Network Declaration in Compose

### Why This Works
Instead of relying on the buggy runtime network attachment, declare the `coolify` network directly in the compose file. Docker Compose will connect all services to both their default project network AND the external `coolify` network. This preserves internal DNS (services still resolve `auth`, `gateway`, etc. within the stack) while also enabling cross-stack communication via the `coolify` network. [CITED: github.com/coollabsio/coolify/issues/1874]

### Exact Change to docker-compose.prod.yml

```yaml
# Add at the TOP LEVEL of docker-compose.prod.yml
networks:
  coolify:
    external: true

services:
  gateway:
    # ... existing config ...
    networks:
      - default    # preserves intra-stack DNS resolution
      - coolify    # enables cross-stack communication

  auth:
    networks:
      - default
      - coolify

  # ... repeat for all 6 services ...
```

### Hostname Configuration

After joining the `coolify` network, services reference cross-stack resources by their **Coolify container name** (which includes UUID suffix):

| Resource | Current Env Var Value | Correct Value | How to Find |
|----------|----------------------|---------------|-------------|
| Garage S3 | `email-platform-s3-dev` | `garage-<uuid>` or check Coolify UI | Coolify UI -> S3 stack -> URL bar UUID |
| Redis | `uc084o00g8okkw00koc844k8` | Same (already UUID format) | Already correct format |
| RabbitMQ | `email-platform-rabbitmq-dev` | Check if this is the Coolify container name | Coolify UI -> RabbitMQ resource |
| PostgreSQL | (current value) | Check if this is the Coolify container name | Coolify UI -> PostgreSQL resource |

**To verify the actual container names:**
```bash
# SSH to 192.168.1.25 and run:
docker ps --format '{{.Names}}' | grep -E 'garage|redis|rabbit|postgres'
```

### Why "Connect To Predefined Network" Should Be DISABLED

1. It is buggy for Service Stacks (issue #5597) [CITED: github.com/coollabsio/coolify/issues/5597]
2. Even if it works, it breaks intra-stack DNS [CITED: coolify.io/docs/knowledge-base/docker/compose]
3. Manual declaration in compose gives both networks (default + coolify), preserving intra-stack DNS

**Action:** Disable "Connect To Predefined Network" on BOTH stacks after adding the network declaration to compose files.

## Why PostgreSQL Works But S3/Redis Don't

This is the key puzzle. Two likely explanations:

1. **PostgreSQL and RabbitMQ are "Standalone Resources"** in Coolify (one-click installs), which may be automatically placed on the `coolify` network. S3 (Garage) is deployed as a separate Service Stack, which gets its own isolated network. [ASSUMED -- needs verification via `docker network inspect coolify`]

2. **The app stack may already be partially on the coolify network** (from the checkbox attempt), and PostgreSQL/RabbitMQ containers are also on it, but the S3 Service Stack containers are not (because the checkbox is buggy for stacks). [ASSUMED]

**Verification command:**
```bash
# On 192.168.1.25:
docker network inspect coolify --format '{{range .Containers}}{{.Name}} {{end}}'
```
This will show exactly which containers are on the `coolify` network.

## Common Pitfalls

### Pitfall 1: Using Stack Name as Hostname
**What goes wrong:** Using `email-platform-s3-dev` (the Coolify resource name) as hostname instead of the actual Docker container name
**Why it happens:** Coolify resource names and container names are different things
**How to avoid:** Always check the actual container name via `docker ps` or Coolify UI URL bar UUID

### Pitfall 2: Only Adding coolify Network (Forgetting default)
**What goes wrong:** If you only specify `networks: [coolify]` without `default`, Docker Compose stops creating the default project network. Services within the stack can no longer resolve each other by simple name.
**How to avoid:** Always list BOTH `default` and `coolify` in each service's networks

### Pitfall 3: Restart vs Recreate
**What goes wrong:** Coolify "Restart" may not pick up network changes in compose file
**How to avoid:** Use "Redeploy" (or force deploy) to ensure containers are recreated with the new network configuration

### Pitfall 4: Defining networks in Compose When Using "Connect To Predefined Network"
**What goes wrong:** Coolify docs warn that defining network configurations in compose AND using the predefined network checkbox can cause Gateway Timeout errors [CITED: coolify.io/docs/knowledge-base/destinations/manage]
**How to avoid:** Use ONE approach -- either the compose declaration (recommended) OR the checkbox (buggy). Not both.

## Step-by-Step Fix

1. **Verify current state** (SSH to server):
   ```bash
   docker network inspect coolify --format '{{range .Containers}}{{.Name}} {{end}}'
   docker ps --format '{{.Names}}' | grep -E 'garage|redis|rabbit|postgres'
   ```

2. **Disable "Connect To Predefined Network"** on both stacks in Coolify UI

3. **Update docker-compose.prod.yml** -- add `networks` section (see exact YAML above)

4. **Update S3 stack compose file** -- same pattern (add `coolify` external network)

5. **Update env vars** with correct container hostnames (from step 1 output)

6. **Redeploy both stacks** (not restart -- must recreate containers)

7. **Verify DNS resolution**:
   ```bash
   docker exec <parser-container> nslookup <garage-container-name>
   docker exec <parser-container> wget -qO- http://localhost:3003/health/ready
   ```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Standalone resources (PostgreSQL, RabbitMQ) are automatically on `coolify` network | Why PostgreSQL Works | Fix approach is still correct; just need to also verify these hostnames |
| A2 | Adding both `default` and `coolify` networks preserves intra-stack DNS | Solution | If wrong, would break gRPC between services -- test after deploy |
| A3 | Coolify does not strip/override user-defined networks in compose files | Solution | If wrong, would need raw compose deployment mode |

## Open Questions

1. **What are the actual Coolify container names for Garage, Redis, RabbitMQ, PostgreSQL?**
   - Must be verified on the server via `docker ps`
   - Env vars must be updated to match

2. **Does the S3 Service Stack also need the coolify network in its compose?**
   - Yes, if it is also a Service Stack (not a standalone resource)
   - The Garage stack's compose file needs the same `networks` treatment

3. **Will Coolify preserve user-defined networks on redeploy?**
   - Should work since compose file is the source of truth for compose-based deployments [CITED: coolify.io/docs/knowledge-base/docker/compose]
   - But Coolify beta behavior may vary

## Sources

### Primary (HIGH confidence)
- [Coolify Docker Compose Docs](https://coolify.io/docs/knowledge-base/docker/compose) -- networking, predefined networks, DNS warning
- [Coolify Managing Destinations](https://coolify.io/docs/knowledge-base/destinations/manage) -- network architecture, predefined network behavior
- [Issue #5597](https://github.com/coollabsio/coolify/issues/5597) -- "Connect to predefined network doesn't work with services or docker based deploys"
- [Issue #1874](https://github.com/coollabsio/coolify/issues/1874) -- Docker Compose cannot join coolify network, includes workaround YAML

### Secondary (MEDIUM confidence)
- [Discussion #5059](https://github.com/coollabsio/coolify/discussions/5059) -- Communication within Coolify projects
- [Discussion #2925](https://github.com/coollabsio/coolify/discussions/2925) -- Accessing standalone resources from docker-compose
- [Discussion #3584](https://github.com/coollabsio/coolify/discussions/3584) -- Service stack UUID visibility in UI
