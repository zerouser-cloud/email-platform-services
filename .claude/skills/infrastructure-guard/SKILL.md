---
name: infrastructure-guard
description: Validate infrastructure changes before applying. Triggers on docker-compose, Dockerfile, .env, ports, volumes, networks, healthchecks, database connections, cache clients, message-broker clients, object-storage clients, credentials, secrets, CI/CD pipelines, deploy configs. Apply when modifying any infrastructure file or configuration.
---

# Infrastructure Guard

## Principles, Not Inventory

This skill describes **timeless principles** for guarding infrastructure configuration against uncontrolled changes. It does **not** describe the current state of the codebase. Do **not** add inventory to this file: specific file paths beyond stable workspace roots (`apps/`, `packages/`), port numbers, production class or function names, enumerated counts of files / services / overrides / lines. For current-state lookups, link to a tracked configuration file by **role** (e.g., "the project ESLint config"), link to the enclosing **directory** (not a file), or provide a `grep` command the reader runs on demand.

Author-facing rule: if you feel the urge to write a specific file path, a real class name, or a count, stop and apply the **rename test** — would this sentence still be true if that file / class / number were renamed or changed tomorrow? If no, rewrite the sentence until it is.

Protect infrastructure configuration from uncontrolled changes. Every infra change must be intentional, reviewed, and consistent.

## Rule: Never Change Infrastructure Without Approval

**All infrastructure changes require explicit user confirmation before applying.**

This includes:
- Port mappings (compose-level ports, service ports)
- Credentials (passwords, API keys, connection strings)
- Docker Compose services (add/remove/modify)
- Dockerfile changes (base images, build stages, exposed ports)
- Tracked env templates (the files at the repository root that define the env-var surface for each deployment mode)
- Network configuration (docker networks, service discovery)
- Volume mounts (persistence, data directories)
- Healthcheck definitions
- CI/CD pipeline configurations
- Deploy scripts and configs

## Pre-Change Checklist

Before modifying any infrastructure file, verify:

```
1. Is this change requested by the user?                            → If NO, ask first
2. Does it change a port or connection string?                      → Present old vs new, ask approval
3. Does it change credentials or secrets?                           → NEVER hardcode, ask where they come from
4. Does it affect other developers' local setup?                    → Flag this explicitly
5. Does it match 12-Factor principles?                              → Config from env, not code
6. Are the standard ports as defined in the tracked env templates   → If your change modifies an `*_PORT` value in any
   preserved?                                                          tracked env file, treat it as a port change and
                                                                        apply step 2 of this checklist.
7. Is the change consistent across all tracked env templates?       → If a var exists in one template but not others,
                                                                        that is a bug — see §Environment Files Sync Rule.
```

## Infrastructure Identifiers — Where to Find Current Inventory

Infrastructure identifiers (ports, hostnames, credentials, service backing stores) are defined in the project's tracked configuration — the tracked env templates at the repository root and the tracked docker-compose infra configuration in the infrastructure directory. This skill does NOT enumerate specific port numbers or backing-store identities. Those values live in the tracked config and are the single source of truth; duplicating them here creates drift.

To see the current authoritative port inventory, run at the repository root:

```bash
grep -rh '_PORT=' .env.example .env.docker.example 2>/dev/null | sort -u
```

To extend the inventory to hostnames and URLs, widen the suffix pattern (e.g., `grep -rhE '_(PORT|HOST|URL)=' …`). That command returns the current authoritative identifier inventory; use the repository's tracked env templates as the source, and read the matching service section of the tracked docker-compose infra configuration for the container-side bindings (volumes, healthchecks, network aliases).

What this skill does NOT enumerate:

- Specific port numbers
- Specific service backing stores (databases, caches, message brokers, object-storage implementations)
- Specific host-to-container mappings
- Specific container image tags

All of the above are repository-tracked configuration values. They can change in the tracked config without requiring a skill update; the skill's rule ("no infra change without approval") applies regardless of which specific identifiers are in use today.

## Environment Files Sync Rule

Every env var lives in the tracked env template(s) for each deployment mode the project supports. Typical pattern: one template per mode — local development, containerized development, and an example template used by new contributors. When changing an env var, update ALL templates so they stay in sync.

**If a var exists in one template but not others — that's a bug.**

To see the current set of tracked env templates in this project, run at the repository root:

```bash
ls .env*
```

To confirm key-set parity across templates, diff the sorted key lists from each template (cut on `=`). A non-empty diff means one template drifted; fix before committing.

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
| Hardcoded port in docker-compose | Breaks other developers when the port is busy on their host | Use the project-standard port defined in the tracked env template; document conflict resolution |
| Per-service-backing-store override env var for a project-standard port | Over-engineering that creates drift between documented ports and live ports | Keep the project-standard port (defined once in the tracked env template) and resolve conflicts at the OS level |
| Different compose files per env | Config drift | One compose + env files |
| Credentials in `docker-compose.yml` | Security | `${VAR:-default}` from env file |
| Changing infra to work around a local conflict | Affects everyone | Ask user, fix locally |
| Silently adding/removing ports | Breaks connectivity | Always ask |

## Conflict Resolution

**ABSOLUTE RULE: Never change port numbers to resolve conflicts. Kill the conflicting process instead.**

When a standard port is occupied (substitute `{port}` with the conflicted port read from the tracked env template):

```
Port {port} busy?
│
├─ Step 1: Identify what's using it
│   └─ docker ps --format '{{.Names}} {{.Ports}}' | grep <the conflicted port from .env>
│   └─ ss -tlnp | grep <the conflicted port from .env>
│
├─ Step 2: Ask the user
│   └─ "Port {port} is occupied by <container/process>. Can I stop it?"
│
├─ Step 3: Only after user approves
│   └─ docker stop <container>
│   └─ OR: sudo systemctl stop <the conflicting service>
│
└─ NEVER:
    ├─ Change the port in docker-compose    → Affects ALL developers
    ├─ Change the port in any tracked env   → Creates config drift
    │    template
    ├─ Change the port in a ports override  → Same problem
    │    file
    └─ Use a different port "temporarily"   → Nothing is more permanent
```

**The port is standard. The conflict is temporary. Fix the conflict, not the port.**
