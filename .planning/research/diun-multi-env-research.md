# Diun Multi-Environment Notification Research

**Researched:** 2026-04-06
**Domain:** Diun container image monitoring, multi-environment deployment triggers
**Confidence:** HIGH (verified against official docs + GitHub source code)

## Summary

Diun supports exactly ONE instance of each notifier type. The `Notif` struct in source code (`internal/model/notif.go`) defines `Webhook *NotifWebhook` as a single pointer, not a slice. There is no way to configure multiple webhook endpoints in a single Diun instance. This is a confirmed architectural limitation, not a documentation gap.

GitHub issues [#1168](https://github.com/crazy-max/diun/issues/1168) (multiple notifications) and [#1208](https://github.com/crazy-max/diun/issues/1208) (custom webhook per container) are both open and unresolved as of 2026-04-06. The maintainer has labeled #1208 as "needs-investigation" but provided no implementation timeline.

**Primary recommendation:** Use the `script` notifier as a routing layer. The script receives `DIUN_ENTRY_IMAGE` (full image reference including tag), which allows conditional logic to call different Coolify deploy endpoints based on whether the tag is `:dev` or `:prod`.

## All Diun Notification Mechanisms

| Notifier | Type | Can Route Conditionally? |
|----------|------|--------------------------|
| AMQP | Message queue | No (single exchange) |
| Apprise | Meta-notifier | No |
| Discord | Chat | No |
| Elasticsearch | Index | No |
| Gotify | Push | No |
| Mail | Email | No |
| Matrix | Chat | No |
| MQTT | Message queue | No |
| Ntfy | Push | No |
| Pushover | Push | No |
| Rocket.Chat | Chat | No |
| **Script** | **Custom command** | **YES - full shell logic** |
| Signal REST | Chat | No |
| Slack | Chat | No |
| Teams | Chat | No |
| Telegram | Chat | No |
| Webhook | HTTP call | No (single endpoint) |

**Key finding:** Only `script` notifier supports conditional logic. All others are single-target.

## Can Diun Have Multiple Webhooks?

**No.** Confirmed at three levels:

1. **Go source code** (`internal/model/notif.go`): `Webhook *NotifWebhook` is a single pointer, not `[]*NotifWebhook`
2. **YAML config structure**: `notif.webhook` is an object, not an array
3. **Environment variables**: `DIUN_NOTIF_WEBHOOK_ENDPOINT` is singular (no indexed variants like `DIUN_NOTIF_WEBHOOK_0_ENDPOINT`)

Multiple notifiers of *different* types can be active simultaneously (e.g., webhook + script + telegram all at once). But only one webhook endpoint.

## Script Notifier Details

### Configuration

```yaml
notif:
  script:
    cmd: "/path/to/deploy-router.sh"
    args: []
    dir: "/scripts"
```

Or via environment variables:
```
DIUN_NOTIF_SCRIPT_CMD=/scripts/deploy-router.sh
```

### Environment Variables Passed to Script

| Variable | Content | Useful For |
|----------|---------|------------|
| `DIUN_ENTRY_IMAGE` | Full image ref (e.g., `ghcr.io/zerouser-cloud/email-platform-services/gateway:dev`) | **Tag-based routing** |
| `DIUN_ENTRY_STATUS` | `new`, `update`, `unchange`, `skip` | Filter only updates |
| `DIUN_ENTRY_PROVIDER` | `docker`, `file`, etc. | Provider filtering |
| `DIUN_ENTRY_DIGEST` | Image digest hash | Verification |
| `DIUN_ENTRY_PLATFORM` | e.g., `linux/amd64` | Platform filtering |
| `DIUN_ENTRY_HUBLINK` | Registry link | Logging |
| `DIUN_VERSION` | Diun version | Debugging |
| `DIUN_HOSTNAME` | Host name | Debugging |

### Critical Detail: DIUN_ENTRY_IMAGE Includes Tag

The image reference includes the full tag, so `ghcr.io/zerouser-cloud/email-platform-services/gateway:dev` gives us the `:dev` or `:prod` suffix to route on.

## Docker Provider Label Configuration

| Label | Purpose | Values |
|-------|---------|--------|
| `diun.enable` | Enable monitoring for container | `"true"` / `"false"` |
| `diun.watch_repo` | Watch all tags (not just running) | `"true"` / `"false"` |
| `diun.include_tags` | Regex filter for tags to watch | Semicolon-separated regexes |
| `diun.exclude_tags` | Regex filter for tags to exclude | Semicolon-separated regexes |
| `diun.notify_on` | When to notify | `new;update` (semicolon-separated) |
| `diun.sort_tags` | Tag sorting method | `default`, `reverse`, `lexicographical`, `semver` |
| `diun.max_tags` | Max tags to watch | Integer (0 = unlimited) |
| `diun.metadata.*` | Custom metadata for notifications | Arbitrary key-value pairs |
| `diun.platform` | Platform to watch | e.g., `linux/amd64` |

### Key insight for our use case

With `diun.watch_repo: "false"` (default), Diun watches only the tag of the running container. So if `gateway:dev` is running, it monitors `:dev` tag. If `gateway:prod` is running, it monitors `:prod` tag. This means **no special tag filtering is needed** -- Diun naturally watches only the tag each container is running.

However, if both dev and prod containers are visible to the same Diun instance (same Docker socket), then both `:dev` and `:prod` updates will trigger the same notifier. This is where the script router becomes essential.

## Recommended Approach: Script Notifier as Router

### Architecture

```
Diun (single instance)
  |
  | monitors all labeled containers (dev + prod)
  | detects image update
  |
  v
deploy-router.sh (script notifier)
  |
  | reads DIUN_ENTRY_IMAGE
  | extracts tag (:dev or :prod)
  |
  +---> :dev tag  --> curl Coolify dev deploy endpoint
  +---> :prod tag --> curl Coolify prod deploy endpoint
```

### deploy-router.sh

```bash
#!/bin/sh
set -e

# Only act on updates (not new/unchange/skip)
if [ "$DIUN_ENTRY_STATUS" != "update" ]; then
  exit 0
fi

IMAGE="$DIUN_ENTRY_IMAGE"

# Coolify credentials
AUTH_HEADER="Authorization: Bearer 2|2b2RRtzOuHZhovd5QFwkDm6NsEa90qLPNAg3Zv2wd54a2b63"
COOLIFY_BASE="http://192.168.1.25:8000/api/v1/deploy"

# Dev environment UUID
DEV_UUID="mcg0k0c4sg4sgcwkc080s08c"
# Prod environment UUID (replace with actual)
PROD_UUID="REPLACE_WITH_PROD_UUID"

case "$IMAGE" in
  *:dev)
    echo "Dev image updated: $IMAGE"
    curl -sf -H "$AUTH_HEADER" "${COOLIFY_BASE}?uuid=${DEV_UUID}&force=false"
    ;;
  *:prod)
    echo "Prod image updated: $IMAGE"
    curl -sf -H "$AUTH_HEADER" "${COOLIFY_BASE}?uuid=${PROD_UUID}&force=false"
    ;;
  *)
    echo "Unknown tag in image: $IMAGE -- skipping"
    ;;
esac
```

### Diun Configuration Change

Replace webhook with script notifier:

**Remove:**
```
DIUN_NOTIF_WEBHOOK_ENDPOINT=...
DIUN_NOTIF_WEBHOOK_METHOD=...
DIUN_NOTIF_WEBHOOK_HEADERS_AUTHORIZATION=...
```

**Add:**
```
DIUN_NOTIF_SCRIPT_CMD=/scripts/deploy-router.sh
```

### Docker Compose for Diun

The script must be mounted into the Diun container and `curl` must be available. Diun uses `crazymax/diun` image which is Alpine-based and includes `wget` but may not include `curl`. Verify and use `wget` as fallback:

```bash
# wget alternative (Alpine built-in)
wget -q --header="$AUTH_HEADER" -O /dev/null "${COOLIFY_BASE}?uuid=${DEV_UUID}&force=false"
```

Or install curl in a wrapper image / use `apk add curl` in entrypoint.

### Volume Mount

```yaml
services:
  diun:
    image: crazymax/diun:latest
    volumes:
      - ./scripts/deploy-router.sh:/scripts/deploy-router.sh:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

## Alternative: Two Diun Instances

If the script approach feels fragile, running two Diun instances is a valid alternative:

| Aspect | Single Diun + Script | Two Diun Instances |
|--------|---------------------|--------------------|
| Complexity | Medium (script routing) | Low (each has own webhook) |
| Container filtering | Must see both envs | Each sees only its env |
| Registry requests | Single set of pulls | Double registry pulls |
| Maintenance | One config + one script | Two configs |
| Failure mode | Script bug = no deploys | Independent failures |

**Two-Diun approach works if:** Dev and prod run on separate Docker hosts or separate Docker Compose stacks with separate sockets. Each Diun sees only its own environment's containers.

**Two-Diun challenge:** If both envs share the same Docker socket (likely in Coolify on one host), separating visibility requires `watchByDefault: false` + careful `diun.enable` labeling per environment, which is essentially the same filtering problem.

## Important Considerations

### watch_repo Label Interaction

Current setup has `diun.watch_repo: "true"` on gateway. This means Diun monitors ALL tags of that image, not just the running tag. With both `:dev` and `:prod` tags existing in the registry:

- Diun will detect updates to BOTH tags
- Script router correctly handles this by routing based on tag
- **But:** Diun fires one notification per tag update, so a single push of `:dev` triggers exactly one script call with the `:dev` image

**Recommendation:** Set `diun.watch_repo: "false"` on all containers. Let each container's running tag be the watched tag. This way:
- Dev containers running `:dev` images trigger on `:dev` updates only
- Prod containers running `:prod` images trigger on `:prod` updates only
- No cross-contamination

### Single Notification per Cycle with watch_repo

The current setup uses `diun.watch_repo: "true"` on gateway to get one webhook call per cycle instead of six (one per service). With the script approach, this optimization still works -- but the script receives the gateway image reference. The Coolify deploy endpoint deploys all services in the stack, so triggering on gateway alone is sufficient.

### Deduplication with Multiple Services

If `diun.watch_repo: "false"` and all 6 services have `diun.enable: "true"`, Diun will call the script 6 times per update cycle (once per service image). The Coolify deploy endpoint is idempotent (same UUID, force=false), but 6 calls are wasteful.

**Solutions:**
1. Keep `diun.enable: "true"` on only ONE service (gateway) per environment -- simplest
2. Add deduplication logic to the script (track last-deployed digest)
3. Use `diun.watch_repo: "true"` on gateway only (current approach)

**Recommended:** Option 1 -- enable Diun only on gateway container for each environment.

### Script Error Handling

If the script fails (non-zero exit), Diun logs the error but continues monitoring. No retry mechanism built-in. Consider adding retry logic in the script:

```bash
for i in 1 2 3; do
  wget -q --header="$AUTH_HEADER" -O /dev/null "${COOLIFY_BASE}?uuid=${UUID}&force=false" && break
  sleep 5
done
```

## Open Questions

1. **Coolify prod deploy UUID** -- need the actual UUID for prod environment
2. **curl vs wget** -- need to verify which HTTP client is available in `crazymax/diun:latest` image
3. **Docker socket visibility** -- confirm that the single Diun instance can see containers from both dev and prod Coolify environments through the same Docker socket
4. **Script permissions** -- ensure the mounted script is executable inside the container

## Sources

### Primary (HIGH confidence)
- [Diun webhook notifier docs](https://crazymax.dev/diun/notif/webhook/) -- single endpoint configuration
- [Diun script notifier docs](https://crazymax.dev/diun/notif/script/) -- environment variables passed to script
- [Diun Docker provider docs](https://crazymax.dev/diun/providers/docker/) -- label configuration
- [Diun source: model/notif.go](https://github.com/crazy-max/diun/blob/master/internal/model/notif.go) -- confirms single webhook struct
- [Diun config page](https://crazymax.dev/diun/config/) -- full YAML structure

### Secondary (MEDIUM confidence)
- [GitHub Issue #1168: Support multiple notifications](https://github.com/crazy-max/diun/issues/1168) -- open, unresolved
- [GitHub Issue #1208: Custom webhook per container](https://github.com/crazy-max/diun/issues/1208) -- open, needs-investigation

### Tertiary (LOW confidence)
- curl/wget availability in crazymax/diun image -- not verified, needs testing
