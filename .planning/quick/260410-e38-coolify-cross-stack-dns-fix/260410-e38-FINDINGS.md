# Coolify Cross-Stack Networking — Findings

**Date:** 2026-04-10
**Status:** Resolved (dev environment)

## Root Cause

Coolify v4.0.0-beta.442 Docker Compose Applications are isolated on their own Docker network by default. Standalone databases and Service Stacks live on separate networks. No automatic cross-stack DNS resolution.

## Solution (verified working)

### 1. Enable "Connect To Predefined Network" on Application

Coolify → email-platform-services → Advanced → Network → ✅ Connect To Predefined Network

This adds the application containers to the `coolify` predefined network alongside managed resources.

### 2. Enable "Connect To Predefined Network" on Service Stacks

Same checkbox on each Service Stack (RabbitMQ, S3/Garage).

### 3. Hostname format: `<hostname>.coolify`

On the predefined network, all hostnames require `.coolify` DNS suffix:

| Resource | Original hostname | Working hostname |
|----------|------------------|-----------------|
| PostgreSQL | `g00cw80skc08k0s8484cgwwc` | `g00cw80skc08k0s8484cgwwc.coolify` |
| Redis | `uc084o00g8okkw00koc844k8` | `uc084o00g8okkw00koc844k8.coolify` |
| RabbitMQ | `email-platform-rabbitmq-dev` | `rabbitmq.coolify` (compose service name) |
| Garage S3 | `email-platform-s3-dev` | `garage-qc0oo448sock4kcs4wko0o8s.coolify` (container name) |

**How to find hostnames:**
- Standalone databases: reverse DNS lookup `nslookup <IP>` from app container
- Service Stacks: container name from Coolify Terminal dropdown + `.coolify`

### 4. Garage S3 compose needs services network

Added `networks: mcg0k0c4sg4sgcwkc080s08c` (external) to Garage compose in Coolify "Edit Compose File".

## Dev Environment Variables (working)

```
DATABASE_URL=postgres://postgres:<password>@g00cw80skc08k0s8484cgwwc.coolify:5432/email_platform
REDIS_URL=redis://default:<password>@uc084o00g8okkw00koc844k8.coolify:6379/0
RABBITMQ_URL=amqp://<user>:<password>@rabbitmq.coolify:5672
STORAGE_ENDPOINT=garage-qc0oo448sock4kcs4wko0o8s.coolify
STORAGE_PORT=3900
STORAGE_PROTOCOL=http
```

## Prod TODO

Same changes needed for prod environment:
1. Enable "Connect To Predefined Network" on prod services Application
2. Enable on prod RabbitMQ and S3 stacks  
3. Find prod hostnames (different UUIDs)
4. Add `.coolify` suffix to all env var hostnames
5. Add prod services network to Garage compose

## Other Discoveries

- `SERVICE_FQDN_GATEWAY` and `SERVICE_URL_GATEWAY` are Coolify-managed — don't add manually
- Coolify UI has a bug: env vars duplicate on each save (cosmetic, doesn't affect runtime)
- `localhost` doesn't resolve in Alpine containers — use `0.0.0.0` for wget
- `wget -qO-` needs `2>&1` to see errors in Coolify Terminal
- Coolify "Postgres URL (internal)" doesn't include `.coolify` suffix — this is a Coolify oversight
