---
name: infrastructure-guard
description: Validate infrastructure changes before applying. Triggers on docker-compose, Dockerfile, .env, ports, volumes, networks, healthchecks, database connections, redis, rabbitmq, minio, credentials, secrets, CI/CD pipelines, deploy configs. Apply when modifying any infrastructure file or configuration.
---

# Infrastructure Guard

Protect infrastructure configuration from uncontrolled changes. Every infra change must be intentional, reviewed, and consistent.

## Rule: Never Change Infrastructure Without Approval

**All infrastructure changes require explicit user confirmation before applying.**

This includes:
- Port mappings (docker-compose ports, service ports)
- Credentials (passwords, API keys, connection strings)
- Docker Compose services (add/remove/modify)
- Dockerfile changes (base images, build stages, exposed ports)
- Environment files (.env, .env.docker, .env.example)
- Network configuration (docker networks, service discovery)
- Volume mounts (persistence, data directories)
- Healthcheck definitions
- CI/CD pipeline configurations
- Deploy scripts and configs

## Pre-Change Checklist

Before modifying any infrastructure file, verify:

```
1. Is this change requested by the user?           → If NO, ask first
2. Does it change a port or connection string?      → Present old vs new, ask approval
3. Does it change credentials or secrets?           → NEVER hardcode, ask where they come from
4. Does it affect other developers' local setup?    → Flag this explicitly
5. Does it match 12-Factor principles?              → Config from env, not code
6. Are standard ports preserved?                    → 5432 (PG), 6379 (Redis), 5672 (RabbitMQ), 9000 (MinIO)
7. Is the change consistent across all env files?   → .env, .env.docker, .env.example must stay in sync
```

## Standard Ports (never change without approval)

| Service | Standard Port | Protocol |
|---|---|---|
| PostgreSQL | 5432 | TCP |
| Redis | 6379 | TCP |
| RabbitMQ | 5672 (AMQP), 15672 (management) | TCP |
| MinIO | 9000 (API), 9001 (console) | TCP |
| Gateway (HTTP) | 4000 (host) → 3000 (container) | HTTP |
| Auth (gRPC) | 50051 | gRPC |
| Sender (gRPC) | 50052 | gRPC |
| Parser (gRPC) | 50053 | gRPC |
| Audience (gRPC) | 50054 | gRPC |

## Environment Files Sync Rule

When changing an env var, update ALL relevant files:

| File | Purpose | When to update |
|---|---|---|
| `.env` | Local dev (services on host) | Always |
| `.env.docker` | Docker Compose (all in Docker) | Always |
| `.env.example` | Template for new developers | Always |

**If a var exists in one file but not others — that's a bug.**

## Docker Compose Change Protocol

```
Modifying docker-compose?
|
+-- Adding a new service?
|   +-- Present: image, ports, healthcheck, network, env vars
|   +-- Ask user to approve
|
+-- Changing ports?
|   +-- Show: current port → proposed port
|   +-- Explain WHY
|   +-- Ask user to approve
|
+-- Changing credentials?
|   +-- Source from env vars, NEVER hardcode
|   +-- Show which env files need updating
|   +-- Ask user to approve
|
+-- Removing a service?
|   +-- Show what depends on it
|   +-- Ask user to approve
|
+-- Changing healthcheck?
    +-- Show old vs new check command
    +-- Ask user to approve
```

## 12-Factor Compliance for Infrastructure

| Factor | Infrastructure Rule |
|---|---|
| III (Config) | All config from env vars. No env-specific docker-compose files. One compose + different env files |
| V (Build, release, run) | One Dockerfile per service. Same image for dev and prod. Env vars at runtime |
| IX (Disposability) | Containers must start fast and stop gracefully. Healthchecks must be defined |
| X (Dev/prod parity) | Same services in dev and prod. Different instances, same topology |
| XI (Logs) | Services write to stdout. No log files inside containers |

## Anti-Patterns

| Prohibited | Why | Do Instead |
|---|---|---|
| Hardcoded port in docker-compose | Breaks other devs if port busy | Standard port, document conflict resolution |
| `POSTGRES_PORT` variable for standard port | Over-engineering, confuses | Use 5432, fix conflicts at OS level |
| Different compose files per env | Config drift | One compose + env files |
| Credentials in docker-compose.yml | Security | `${VAR:-default}` from env file |
| Changing infra to work around local conflict | Affects everyone | Ask user, fix locally |
| Silently adding/removing ports | Breaks connectivity | Always ask |

## Conflict Resolution

**ABSOLUTE RULE: Never change port numbers to resolve conflicts. Kill the conflicting process instead.**

When a standard port is occupied:

```
Port 5432 busy?
│
├─ Step 1: Identify what's using it
│   └─ docker ps --format '{{.Names}} {{.Ports}}' | grep 5432
│   └─ ss -tlnp | grep 5432
│
├─ Step 2: Ask the user
│   └─ "Port 5432 is occupied by <container/process>. Can I stop it?"
│
├─ Step 3: Only after user approves
│   └─ docker stop <container>
│   └─ OR: sudo systemctl stop postgresql
│
└─ NEVER:
    ├─ Change port in docker-compose     → Affects ALL developers
    ├─ Change port in .env               → Creates config drift
    ├─ Change port in dev-ports override  → Same problem
    └─ Use a different port "temporarily" → Nothing is more permanent
```

**The port is standard. The conflict is temporary. Fix the conflict, not the port.**
