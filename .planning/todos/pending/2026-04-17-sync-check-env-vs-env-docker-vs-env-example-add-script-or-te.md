---
created: 2026-04-17T07:36:33.010Z
title: Sync check — .env vs .env.docker vs .env.example
area: tooling
files:
  - .env
  - .env.docker
  - .env.example
---

## Problem

Env files могут рассинхронизироваться незаметно. В Phase 24.1 env hygiene добавили 6 HTTP env vars в `.env.docker` и `.env.example`, но не обновили `.env` (который используется для native mode).

Обнаружено в UAT Phase 999.7 (2026-04-17): sender, parser, notifier падают при старте native mode с ZodError — missing env vars:
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BASE_URL` (notifier)
- `CLOUDFN_API_KEY`, `CLOUDFN_BASE_URL` (sender)
- `APPSTORESPY_API_KEY`, `APPSTORESPY_BASE_URL` (parser)

Временно исправлено через `/gsd:fast` — скопировал placeholders из `.env.example` в `.env`. Но проблема системная: нет механизма который ловит этот класс багов.

## Solution

TBD — выбрать один или комбинацию:

1. **Sync script**: `scripts/check-env-sync.sh` сравнивает keys между `.env.example`, `.env.docker`, `.env` и fails если расхождение. Запускается в CI и локально.

2. **Pre-commit hook**: при изменении любого `.env*` файла предупреждать если другие не синхронизированы.

3. **CI gate**: GitHub Actions job проверяет что `.env.example` keys == `.env.docker` keys (без проверки `.env` т.к. он gitignored).

4. **Zod reuse**: унифицировать так чтобы все env-схемы использовали один источник истины (топологию SERVICE каталога + sub-schemas), и `.env.example`/`.env.docker` генерировались из него.

Приоритет — 3 (CI gate) + 4 (долгосрочно). Обе файла в git, можно сравнивать напрямую.

Связано с backlog Phase 999.1 (TopologySchema Static Refactor) — может быть закрыто там же при переработке env-schema pipeline.
