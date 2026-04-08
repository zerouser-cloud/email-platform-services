# Coolify + Garage: Complete Onboarding Research

**Researched:** 2026-04-07
**Confidence:** HIGH (verified against Coolify source, Garage official docs, GitHub discussions)

## TL;DR

Coolify's one-click Garage deploys a bare Garage node with auto-generated admin credentials but **zero buckets, zero S3 keys, zero layout**. There is no UI for managing Garage -- you MUST run post-deploy CLI or API commands to make it usable. Coolify's "S3 Storages" sidebar is backup-only and cannot manage Garage.

---

## 1. What Coolify Auto-Creates When Deploying Garage

Coolify's Garage template (`templates/compose/garage.yaml`) uses image `dxflrs/garage:v2.1.0` and auto-generates these variables via Coolify's `SERVICE_*` mechanism [VERIFIED: github.com/coollabsio/coolify Garage template]:

| Coolify Variable | Maps To | Purpose |
|------------------|---------|---------|
| `SERVICE_PASSWORD_GARAGE` | `GARAGE_ADMIN_TOKEN` | Admin API bearer token (port 3903) |
| `SERVICE_PASSWORD_GARAGEMETRICS` | `GARAGE_METRICS_TOKEN` | Prometheus metrics auth |
| `SERVICE_HEX_32_RPCSECRET` | `GARAGE_RPC_SECRET` | Inter-node RPC communication |

### What IS created automatically
- A running Garage daemon with LMDB storage engine
- Configuration file (`garage.toml`) with replication_factor=1
- Admin API on port 3903 with the auto-generated token
- S3 API on port 3900
- RPC on port 3901
- Web endpoint on port 3902

### What is NOT created automatically
- **No cluster layout** -- Garage won't serve S3 requests until layout is assigned
- **No S3 access keys** -- the admin token is NOT an S3 credential
- **No buckets** -- nothing to store objects in
- **No Web UI** -- Garage has no built-in UI; the community WebUI (`khairul169/garage-webui`) is unofficial

**Critical: GARAGE_ADMIN_TOKEN cannot be used as S3 credentials.** Admin tokens authenticate against the Admin API (port 3903) only. S3 credentials (accessKeyId + secretAccessKey) must be created separately via `garage key create` or the Admin API. These are completely separate authentication domains. [VERIFIED: garagehq.deuxfleurs.fr/documentation/reference-manual/admin-api/]

---

## 2. Post-Deploy Setup: The Missing Steps

After Coolify deploys Garage, you must complete these steps before any app can use S3:

### Step 0: Find the Garage container name

In Coolify UI: go to the Garage service, note the container name (visible in the service details or via `docker ps | grep garage`).

### Step 1: Assign cluster layout

Garage refuses to serve S3 requests until at least one node has a layout role assigned.

```bash
# Find the container name
CONTAINER=$(docker ps --format '{{.Names}}' | grep -i garage)

# Get the node ID
docker exec $CONTAINER /garage status
# Output shows node ID like: 57cea5a6f9b6b453... NO ROLE ASSIGNED

# Assign layout (1G = capacity, adjust as needed)
NODE_ID=$(docker exec $CONTAINER /garage status 2>&1 | grep -oP '^[a-f0-9]+')
docker exec $CONTAINER /garage layout assign -z dc1 -c 10G $NODE_ID
docker exec $CONTAINER /garage layout apply --version 1
```

### Step 2: Create an S3 access key

```bash
docker exec $CONTAINER /garage key create email-platform-key
# Output:
# Key name: email-platform-key
# Key ID: GKxxxxxxxxxxxx
# Secret key: xxxxxxxxxxxxxxxxxxxxxxxxxxxx
# SAVE THESE -- the secret is shown ONLY ONCE
```

### Step 3: Create a bucket

```bash
docker exec $CONTAINER /garage bucket create email-platform
```

### Step 4: Grant permissions

```bash
docker exec $CONTAINER /garage bucket allow \
  --read --write --owner \
  email-platform \
  --key email-platform-key
```

### Step 5: Verify

```bash
docker exec $CONTAINER /garage bucket info email-platform
docker exec $CONTAINER /garage key info email-platform-key
```

---

## 3. Alternative: Admin API (No docker exec)

If port 3903 is exposed, all operations can be done via curl. The admin token is in Coolify UI under the Garage service environment variables.

```bash
ADMIN_TOKEN="<from Coolify UI: GARAGE_ADMIN_TOKEN or SERVICE_PASSWORD_GARAGE>"
GARAGE_HOST="192.168.1.25"  # or internal Docker hostname

# Check cluster health first
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://$GARAGE_HOST:3903/v2/GetClusterHealth | jq

# Create key
curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "email-platform-key"}' \
  http://$GARAGE_HOST:3903/v2/CreateKey | jq
# Response: {"accessKeyId":"GK...","secretAccessKey":"...","name":"email-platform-key",...}

# Create bucket
curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"globalAlias": "email-platform"}' \
  http://$GARAGE_HOST:3903/v2/CreateBucket | jq
# Response: {"id":"<hex-bucket-id>","globalAliases":["email-platform"],...}

# Grant key access to bucket
curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bucketId": "<bucket-id-from-above>",
    "accessKeyId": "<key-id-from-above>",
    "permissions": {"read": true, "write": true, "owner": true}
  }' \
  http://$GARAGE_HOST:3903/v2/AllowBucketKey | jq

# List keys (verify)
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://$GARAGE_HOST:3903/v2/ListKeys | jq

# List buckets (verify)
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://$GARAGE_HOST:3903/v2/ListBuckets | jq
```

---

## 4. Coolify's "S3 Storages" Sidebar -- What It Actually Does

Coolify's sidebar section "S3 Storages" is **exclusively for Coolify's own database backup destinations**. [VERIFIED: coolify.io/docs/knowledge-base/s3/introduction]

- It stores S3 connection credentials (endpoint, access key, secret key, bucket, region)
- It uses MinIO's `mc` client internally to upload database backups
- It validates connection with `ListObjectsV2` request
- It supports AWS, DigitalOcean Spaces, MinIO, Cloudflare R2, Backblaze B2, Scaleway, Hetzner, Wasabi, Vultr, CloudPe

**Can it connect to your Coolify-hosted Garage?** YES -- but only for **backup purposes**. You would:
1. First create a bucket and key in Garage (steps above)
2. Then configure S3 Storages with:
   - Endpoint: `http://<garage-host>:3900`
   - Region: `garage`
   - Bucket: `coolify-backups` (or whatever you created)
   - Access Key / Secret Key: from the Garage key you created
3. Coolify will verify with `ListObjectsV2` and use it for DB backups

**It does NOT:** create buckets, manage keys, browse files, or provide any S3 management UI.

---

## 5. Community Experience with Coolify + Garage

From GitHub discussion #6549 [VERIFIED: github.com/coollabsio/coolify/discussions/6549]:

- Users successfully deploy Garage via Coolify's one-click template
- The community uses `garage-webui` (unofficial, image `khcr.io/garage-webui:latest`) for a basic management UI
- Users describe Garage as "amazing so far" but note the lack of official GUI
- For the WebUI, users add a second container in the Coolify service pointing to `khcr.io/garage-webui:latest` with port 3909 and a domain configured for access
- The WebUI needs the admin API URL and token to function

**No tutorials or guides exist specifically for "Coolify + Garage onboarding."** All knowledge is scattered across the GitHub discussion and generic Garage docs.

---

## 6. App Configuration After Provisioning

Once bucket and key are created, configure the application:

```env
STORAGE_ENDPOINT=http://<garage-host>:3900
STORAGE_REGION=garage
STORAGE_BUCKET=email-platform
STORAGE_ACCESS_KEY=GK...              # from key creation
STORAGE_SECRET_KEY=...                 # from key creation
STORAGE_FORCE_PATH_STYLE=true          # REQUIRED for Garage
```

**`STORAGE_FORCE_PATH_STYLE=true` is mandatory** -- Garage uses path-style URLs (`http://host:3900/bucket/key`), not virtual-hosted-style (`http://bucket.host:3900/key`). Omitting this causes `NoSuchBucket` errors. [VERIFIED: garagehq.deuxfleurs.fr/documentation/quick-start/]

**S3 region must be `garage`** (or whatever is set in `garage.toml` under `[s3_api] s3_region`). Using `us-east-1` or other regions causes `AuthorizationHeaderMalformed` errors. [VERIFIED: garagehq.deuxfleurs.fr/documentation/quick-start/]

---

## 7. Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| No layout assigned | All S3 requests return 500 | Run `garage layout assign` + `garage layout apply` |
| Using admin token as S3 key | `InvalidAccessKeyId` | Create a separate key with `garage key create` |
| Wrong S3 region | `AuthorizationHeaderMalformed` | Set region to `garage` (matches `garage.toml`) |
| Missing `force_path_style` | `NoSuchBucket` / DNS resolution failure | Set `force_path_style: true` in S3 client config |
| Port 3903 not exposed | Cannot reach Admin API from host | Add port mapping in Coolify or use `docker exec` |
| Key secret not saved | Cannot recover the secret | Create a new key; old secret is shown only at creation |

---

## Sources

### Primary (HIGH confidence)
- [Coolify Garage template source](https://github.com/coollabsio/coolify/blob/v4.x/templates/compose/garage.yaml) -- auto-generated env vars, image version
- [Garage Quick Start](https://garagehq.deuxfleurs.fr/documentation/quick-start/) -- CLI workflow, layout, keys, buckets
- [Garage Admin API reference](https://garagehq.deuxfleurs.fr/documentation/reference-manual/admin-api/) -- HTTP API endpoints, auth model
- [Coolify S3 Storage docs](https://coolify.io/docs/knowledge-base/s3/introduction) -- backup-only purpose confirmed
- [Coolify Environment Variables docs](https://coolify.io/docs/knowledge-base/environment-variables) -- SERVICE_* auto-generation mechanism

### Secondary (MEDIUM confidence)
- [GitHub Discussion #6549](https://github.com/coollabsio/coolify/discussions/6549) -- community Garage deployment experience
- [Glukhov Garage Quickstart](https://www.glukhov.org/data-infrastructure/object-storage/garage-quickstart/) -- verified Docker setup flow
- [Garage WebUI](https://github.com/khairul169/garage-webui) -- unofficial management UI

### Tertiary (LOW confidence)
- [Jan Wildeboer Garage blog](https://jan.wildeboer.net/2026/01/1-Local-S3-With-Garage/) -- personal setup guide (could not fetch, connection timeout)
