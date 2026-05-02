---
created: 2026-05-02T17:00:00.000Z
title: Dockerfile BuildKit cache bloat — `pnpm install --force` + `rm -rf node_modules`
area: infrastructure
files:
  - infra/docker/app.Dockerfile
---

## Problem

BuildKit cache раздулся до 92.9 GB за ~36 часов и вызвал переполнение
диска (`/dev/mapper/root 910G/930G 100%`), что заблокировало D-08
dual-mode smoke verification в Phase 999.17.3 Wave 4 (план `999.17.3-04`,
Task 6 пропущен — см. `999.17.3-04-SUMMARY.md`).

Анализ `docker builder du --verbose` показал, что почти каждый cache-entry
создаётся командами `pnpm install --force` и `rm -rf node_modules
apps/*/node_modules packages/*/node_modules`, выполняемыми внутри
Dockerfile при пересборках. Из-за `--force` слои `node_modules` каждый
билд создаются с нуля — layer-cache не работает, и BuildKit складирует
их как новые регулярные cache-entries вместо переиспользования
предыдущих.

## Required Changes

Переписать `infra/docker/app.Dockerfile` так, чтобы:

1. Убрать `--force` и `rm -rf node_modules` из RUN-инструкций.
2. Использовать стандартный pnpm-pattern для Docker:
   - сначала `COPY` только `package.json`, `pnpm-lock.yaml` и манифесты
     воркспейсов (`apps/*/package.json`, `packages/*/package.json`)
   - затем `pnpm install --frozen-lockfile` с BuildKit cache mount:
     `--mount=type=cache,target=/root/.pnpm-store` или
     `--mount=type=cache,target=/pnpm/store`
   - и уже потом `COPY` остального кода
3. Сохранять детерминизм через `--frozen-lockfile`, а не через `--force`.

## Goal

Повторные билды должны переиспользовать зависимости и не порождать по
1–3 GB новых cache-слоёв на каждый сбор. Это устранит recurring
disk-pressure проблему, которая блокировала executor-смоки в фазе
999.17.3.

## Context Links

- Phase: 999.17.3 Wave 4 SUMMARY (`999.17.3-04-SUMMARY.md`) — disk-full
  manifestation
- Affected file: `infra/docker/app.Dockerfile`
- Related: D-08 dual-mode smoke pattern (CONTEXT.md в 999.17.x)

## Suggested Phase

Тривиальный single-plan phase в milestone v4.0 — "Dockerfile pnpm cache
mount migration" — предположительно 999.17.6 или новая phase в `v5.0`.
