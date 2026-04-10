# Diun Webhook Template Research

**Date:** 2026-04-06
**Goal:** Can one Diun instance route webhook notifications to different Coolify deploy endpoints based on container metadata?

## Q1: Does webhook endpoint URL support Go templates?

**NO.** Confidence: HIGH (verified via source code).

The webhook `client.go` uses `c.cfg.Endpoint` directly in `http.NewRequestWithContext()` without any template processing. No `text/template` import exists. The endpoint is a **static string**.

```go
req, err := http.NewRequestWithContext(timeoutCtx, c.cfg.Method, c.cfg.Endpoint, bytes.NewBuffer(body))
```

**This means the webhook notifier CANNOT dynamically route to different URLs per notification.**

## Q2: Format of `diun.metadata.*` container labels

Custom metadata labels follow the pattern:
```yaml
labels:
  diun.metadata.coolify_uuid: "mcg0k0c4sg4sgcwkc080s08c"
  diun.metadata.environment: "production"
```

These appear in the notification payload under the `metadata` object alongside built-in `ctn_*` fields:
```json
{
  "metadata": {
    "ctn_names": "mycontainer",
    "ctn_state": "running",
    "coolify_uuid": "mcg0k0c4sg4sgcwkc080s08c",
    "environment": "production"
  }
}
```

The `NotifEntry` struct confirms `Metadata map[string]string` -- a flat string map that includes both built-in and custom keys.

Confidence: HIGH (source code struct + Docker provider docs).

## Q3: Does webhook support custom body templates?

**NO.** The webhook notifier renders the `NotifEntry` as fixed JSON via `message.RenderJSON()`. The docs explicitly state: "templateTitle and templateBody fields except for those rendering JSON or Env like Amqp, MQTT, Script and Webhook."

Webhook output is always the fixed JSON structure. No customization of body format.

Confidence: HIGH (official docs + source code).

## Q4: Fires once per image or once per batch?

**Once per image.** The `Send` method signature is:
```go
func (c *Client) Send(entry model.NotifEntry) error
```

It receives a single `NotifEntry` (one image). Each image update triggers a separate webhook call.

Confidence: HIGH (source code).

## Q5: Webhook endpoint string processing

Static string only. The endpoint from config is passed directly to `http.NewRequestWithContext`. No template engine, no variable substitution, no string interpolation.

Confidence: HIGH (verified in source code).

## Q6: Available fields in webhook payload

Top-level fields:
- `diun_version`, `hostname`, `status`, `provider`
- `image` (full image reference string)
- `hub_link`, `mime_type`, `digest`, `created`, `platform`
- `metadata` (map of string to string)

Metadata includes:
- Built-in: `ctn_command`, `ctn_createdat`, `ctn_id`, `ctn_names`, `ctn_size`, `ctn_state`, `ctn_status`
- Custom: any key set via `diun.metadata.*` labels on the container

## Solution: Use Script Notifier Instead of Webhook

Since webhook endpoint is static, the **script notifier** is the correct approach.

### How it works

Script notifier passes all notification data as environment variables:
- `DIUN_ENTRY_IMAGE` -- the image that changed
- `DIUN_ENTRY_STATUS` -- new/update
- `DIUN_ENTRY_METADATA_CTN_NAMES` -- container name
- `DIUN_ENTRY_METADATA_COOLIFY_UUID` -- custom metadata (key uppercased)

The naming pattern for custom metadata: `DIUN_ENTRY_METADATA_` + uppercase key name.

### Implementation

Container labels:
```yaml
services:
  my-app-dev:
    labels:
      diun.enable: "true"
      diun.metadata.coolify_uuid: "mcg0k0c4sg4sgcwkc080s08c"

  my-app-prod:
    labels:
      diun.enable: "true"
      diun.metadata.coolify_uuid: "a48ws40o00skkc8c0k8k848g"
```

Diun config:
```yaml
notif:
  script:
    cmd: "/path/to/deploy.sh"
```

Script (`deploy.sh`):
```bash
#!/bin/bash
# DIUN_ENTRY_METADATA_COOLIFY_UUID is set by Diun from diun.metadata.coolify_uuid label
if [ -n "$DIUN_ENTRY_METADATA_COOLIFY_UUID" ]; then
  curl -s -X GET \
    "http://192.168.1.25:8000/api/v1/deploy?uuid=${DIUN_ENTRY_METADATA_COOLIFY_UUID}&force=false" \
    -H "Authorization: Bearer ${COOLIFY_TOKEN}"
fi
```

### Caveat: Env var naming for custom metadata

The exact env var name for custom metadata keys needs validation. The pattern `DIUN_ENTRY_METADATA_` + UPPER(key) is inferred from the built-in keys pattern (`ctn_names` -> `DIUN_ENTRY_METADATA_CTN_NAMES`). Custom key `coolify_uuid` should become `DIUN_ENTRY_METADATA_COOLIFY_UUID` but this should be tested.

**Quick test:** Set `diun.metadata.test_key: "hello"` on a container, trigger a notification with a script that runs `env | grep DIUN > /tmp/diun-env.log`, and check the output.

## Sources

- https://crazymax.dev/diun/notif/webhook/ -- webhook config and payload format
- https://crazymax.dev/diun/notif/script/ -- script notifier env vars
- https://crazymax.dev/diun/providers/docker/ -- diun.metadata.* label format
- https://crazymax.dev/diun/config/defaults/ -- defaults metadata config
- https://github.com/crazy-max/diun (internal/notif/webhook/client.go) -- endpoint is static string
- https://github.com/crazy-max/diun (internal/model/notif.go) -- NotifEntry struct with Metadata map
