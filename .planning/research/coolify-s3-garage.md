# Coolify S3 + Garage: Bucket & Key Management

**Researched:** 2026-04-07

## TL;DR

Coolify's "S3 Storages" is **only for backup destinations** -- it cannot create buckets or keys. Use Garage's **Admin API on port 3903** with curl to create keys, buckets, and permissions without `docker exec`.

---

## 1. Coolify "S3 Storages" -- Backup Only

Coolify's sidebar "S3 Storages" section is **exclusively for configuring database backup destinations**. [VERIFIED: coolify.io/docs/knowledge-base/s3/introduction]

What it does:
- Stores S3 connection credentials (endpoint, access key, secret key, bucket, region)
- Uses MinIO's `mc` client internally to upload database backups
- Validates connection with `ListObjectsV2` request
- Supports scheduled backups via cron expressions

What it does NOT do:
- Cannot create buckets
- Cannot generate access keys
- Cannot manage bucket permissions
- Cannot browse bucket contents

**You must create the bucket and keys externally before configuring Coolify S3 Storages.**

## 2. Coolify Garage Template -- What's Auto-Generated

Coolify's one-click Garage template (from `templates/compose/garage.yaml`) deploys Garage with these auto-generated values [VERIFIED: github.com/coollabsio/coolify Garage template]:

| Variable | Value Source | Purpose |
|----------|------------|---------|
| `GARAGE_ADMIN_TOKEN` | `$SERVICE_PASSWORD_GARAGE` (auto-generated) | Admin API bearer token |
| `GARAGE_RPC_SECRET` | Auto-generated | Inter-node communication |
| `GARAGE_METRICS_TOKEN` | Auto-generated | Prometheus metrics auth |
| `RUST_LOG` | `garage=info` | Logging |

Exposed ports:
| Port | Purpose |
|------|---------|
| 3900 | S3 API (main endpoint for apps) |
| 3901 | RPC (internal) |
| 3902 | Web/static site hosting |
| 3903 | **Admin API** (key/bucket management) |

**The template does NOT auto-create any buckets or access keys.** It only starts the Garage node. You must provision resources via the Admin API.

## 3. Garage Admin API -- Complete Provisioning Without docker exec

The Admin API runs on port 3903 and provides full CRUD for keys and buckets. [VERIFIED: garagehq.deuxfleurs.fr OpenAPI spec v2]

### Authentication

All requests require the admin token as bearer:
```
Authorization: Bearer <GARAGE_ADMIN_TOKEN>
```

The token value is visible in Coolify UI under the Garage service environment variables (`GARAGE_ADMIN_TOKEN`).

### Step-by-step: Create bucket + key + permissions

**Step 1: Create an access key**
```bash
curl -s -X POST \
  -H "Authorization: Bearer $GARAGE_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "email-platform-key"}' \
  http://<garage-host>:3903/v2/CreateKey | jq
```

Response includes:
```json
{
  "accessKeyId": "GK...",
  "secretAccessKey": "...",
  "name": "email-platform-key",
  "permissions": { "createBucket": false }
}
```

Save `accessKeyId` and `secretAccessKey` -- the secret is only shown at creation time.

**Step 2: Create a bucket**
```bash
curl -s -X POST \
  -H "Authorization: Bearer $GARAGE_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"globalAlias": "email-platform"}' \
  http://<garage-host>:3903/v2/CreateBucket | jq
```

Response includes the bucket `id` (hex string) and `globalAliases: ["email-platform"]`.

**Step 3: Grant key access to bucket**
```bash
curl -s -X POST \
  -H "Authorization: Bearer $GARAGE_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bucketId": "<bucket-id-from-step-2>",
    "accessKeyId": "<access-key-id-from-step-1>",
    "permissions": {"read": true, "write": true, "owner": true}
  }' \
  http://<garage-host>:3903/v2/AllowBucketKey | jq
```

### Verification commands

```bash
# List all keys
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://<host>:3903/v2/ListKeys | jq

# List all buckets
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://<host>:3903/v2/ListBuckets | jq

# Cluster health
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://<host>:3903/v2/GetClusterHealth | jq
```

## 4. Network Access to Port 3903

How to reach the Admin API depends on Coolify networking:

**Option A: Coolify exposes 3903 to host** -- If Garage service has port 3903 mapped in Coolify, call directly: `http://192.168.1.25:3903/...`

**Option B: Via Coolify's internal Docker network** -- If 3903 is not exposed externally, you can either:
1. Add port mapping in Coolify UI (Service > Garage > add port 3903)
2. Use `docker exec` once to call localhost:3903 inside the container
3. Temporarily expose 3903, provision, then remove the mapping

**Recommendation:** Expose 3903 only on LAN (not publicly). After initial provisioning, optionally close it.

## 5. App Configuration After Provisioning

Once bucket and key are created, configure the app's S3 env vars:

```env
S3_ENDPOINT=http://<garage-host>:3900
S3_REGION=garage
S3_BUCKET=email-platform
S3_ACCESS_KEY_ID=GK...        # from CreateKey response
S3_SECRET_ACCESS_KEY=...       # from CreateKey response
S3_FORCE_PATH_STYLE=true       # required for Garage
```

`S3_FORCE_PATH_STYLE=true` is required because Garage uses path-style URLs, not virtual-hosted-style.

## Sources

- [Coolify S3 Storage docs](https://coolify.io/docs/knowledge-base/s3/introduction) -- confirms backup-only purpose
- [Garage Admin API reference](https://garagehq.deuxfleurs.fr/documentation/reference-manual/admin-api/) -- endpoint overview
- [Garage Admin API v2 OpenAPI spec](https://garagehq.deuxfleurs.fr/api/garage-admin-v2.json) -- exact request/response schemas
- [Garage Quick Start](https://garagehq.deuxfleurs.fr/documentation/quick-start/) -- CLI equivalents
- [Coolify Garage template](https://github.com/coollabsio/coolify/blob/v4.x/templates/compose/garage.yaml) -- auto-generated env vars
