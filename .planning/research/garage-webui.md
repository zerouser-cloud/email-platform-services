# Garage WebUI - Research

**Date:** 2026-04-07
**Purpose:** Deploy web admin panel for existing Garage S3 instance in Coolify

## Project

- **Repo:** https://github.com/khairul169/garage-webui
- **Docker image:** `khairul169/garage-webui`
- **Latest version:** v1.1.0 (Sep 2025) [VERIFIED: GitHub releases]
- **Stack:** TypeScript/React frontend + Go backend, single binary/container
- **Port:** 3909 (default, configurable via `PORT` env var)
- **License:** MIT

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_BASE_URL` | Yes* | Garage admin API URL (e.g. `http://garage:3903`) |
| `API_ADMIN_KEY` | Yes* | Garage admin token |
| `S3_ENDPOINT_URL` | No | S3 API endpoint (e.g. `http://garage:3900`) — needed for object browser |
| `S3_REGION` | No | S3 region |
| `CONFIG_PATH` | No | Path to `garage.toml` (default: `/etc/garage.toml`) |
| `BASE_PATH` | No | URL prefix for reverse proxy |
| `AUTH_USER_PASS` | No | WebUI login auth: `username:bcrypt_hash` |
| `PORT` | No | Listen port (default: 3909) |

*Either mount `garage.toml` OR set `API_BASE_URL` + `API_ADMIN_KEY`. Env vars are fallback when toml not found. [VERIFIED: GitHub README]

## Connection to Existing Garage

WebUI connects to the **admin API** (port 3903), NOT the S3 API. The admin API provides cluster management, bucket CRUD, key management. The S3 endpoint is optional — used only for the object/file browser.

For our setup (no `garage.toml` available in WebUI container):

```
API_BASE_URL=http://garage-wgs8kw8o4c08840844ss0o8g:3903
API_ADMIN_KEY=nWWLgyi3SK72cn29cJaHTqyASkb5rAj0
S3_ENDPOINT_URL=http://garage-wgs8kw8o4c08840844ss0o8g:3900
```

The container name `garage-wgs8kw8o4c08840844ss0o8g` is resolvable on the Coolify Docker network.

## Capabilities

| Feature | Supported |
|---------|-----------|
| Cluster health status | Yes |
| Cluster layout / node roles | Yes |
| Create/update/delete buckets | Yes |
| Browse objects in buckets | Yes |
| Create access keys | Yes |
| Assign keys to buckets (permissions) | Yes |
| Upload/download objects | Yes (via browser) |

[VERIFIED: GitHub README + Dokploy template docs]

## Deployment in Coolify

### Option A: Separate Docker Compose service (RECOMMENDED)

Deploy as a new **Docker Compose** resource in Coolify on the same network as Garage.

```yaml
services:
  garage-webui:
    image: khairul169/garage-webui:1.1.0
    container_name: garage-webui
    restart: unless-stopped
    ports:
      - "3909:3909"
    environment:
      API_BASE_URL: "http://garage-wgs8kw8o4c08840844ss0o8g:3903"
      API_ADMIN_KEY: "nWWLgyi3SK72cn29cJaHTqyASkb5rAj0"
      S3_ENDPOINT_URL: "http://garage-wgs8kw8o4c08840844ss0o8g:3900"
      AUTH_USER_PASS: "admin:BCRYPT_HASH_HERE"

networks:
  default:
    external: true
    name: coolify  # same network as Garage container
```

### Option B: Add to existing Garage compose

If Garage is deployed via Docker Compose in Coolify, add `garage-webui` as a second service in the same compose file. Then use `garage` as hostname instead of the full container name.

### Network Connectivity

Both containers must be on the same Docker network. In Coolify, all services share the `coolify` network by default. Use the Garage container name as hostname in `API_BASE_URL`.

### Authentication Setup

Generate bcrypt hash for WebUI login:

```bash
htpasswd -nbBC 10 "admin" "your-password"
# Output: admin:$2y$10$... — use full output as AUTH_USER_PASS
```

Or use an online bcrypt generator. The format is `username:bcrypt_hash`.

### Domain / Proxy

In Coolify, assign a domain (e.g. `garage-ui.email-platform.pp.ua`) and point it to port 3909. Coolify handles Traefik labels automatically.

## Notes

- No persistent storage needed — WebUI is stateless, reads everything from Garage admin API
- v1.1.0 added HTTPS support for Garage API connections (useful if admin API is behind TLS)
- The image is lightweight (Go binary + static React assets)
- No volumes required when using env vars instead of `garage.toml`

## Sources

- https://github.com/khairul169/garage-webui — main repo + README
- https://hub.docker.com/r/khairul169/garage-webui — Docker image
- https://docs.dokploy.com/docs/templates/garage-with-ui — proven compose template
- https://github.com/khairul169/garage-webui/releases — release history
