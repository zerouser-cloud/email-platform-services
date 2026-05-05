# Email Platform

NestJS-based microservices monorepo for email campaign management. Services: gateway (REST facade), auth, sender, parser, audience, notifier (gRPC + RMQ).

## Setup

After clone:

```sh
pnpm install
pnpm setup-hooks
```

This installs dependencies AND configures Git to use repository-tracked
hooks in `.githooks/`. Skipping `pnpm setup-hooks` means pre-commit and
pre-push gates will NOT run on your machine — CI will still enforce
them, but you'll see noisy push failures.

## Development

Two local-stack flavours (use either, not both):

```sh
pnpm start:native      # gateway on :3000 — host node, dockerized infra
pnpm start:isolated    # gateway on :4000 — fully dockerized stack
pnpm stop:native       # tear down native stack
pnpm stop:isolated     # tear down isolated stack
```

Health probes:

```sh
curl http://localhost:3000/health/ready    # native mode (gateway)
curl http://localhost:4000/health/ready    # isolated mode (gateway)
```

## Project Conventions

- Architecture: Clean / DDD / Hexagonal (apps/), simple-utility (packages/)
- Tech stack: NestJS 11 + TypeScript + gRPC + PostgreSQL + RabbitMQ + Redis
- See `CLAUDE.md` for full code-style + architectural skills inventory
- See `.claude/skills/*/SKILL.md` for project-specific skill rules
- See `.planning/ROADMAP.md` for project status

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
