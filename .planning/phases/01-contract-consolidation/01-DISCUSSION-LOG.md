# Phase 1: Contract Consolidation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 01-contract-consolidation
**Areas discussed:** Proto gen стратегия, Turbo pipeline

---

## Proto gen стратегия

| Option | Description | Selected |
|--------|-------------|----------|
| Только по команде | pnpm proto:generate вручную. Сгенерированный код коммитится. Build не трогает proto. | |
| При каждом build | Turbo task 'generate' перед build. Код НЕ коммитится, создаётся на лету. | |
| Гибрид (Recommended) | Turbo task 'generate' при build + коммитим результат. И вручную, и автоматически. | ✓ |

**User's choice:** Гибрид — генерация и при build, и по команде, сгенерированный код коммитится
**Notes:** Пользователь ранее уточнил что generate.sh скрипт нормальный, менять на Buf CLI не нужно

---

## Turbo pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Turbo task (Recommended) | Добавить 'generate' task в turbo.json. contracts build зависит от generate. Turbo кэширует результат. | ✓ |
| Prebuild script | Добавить 'prebuild' в contracts/package.json. Проще, но не кэшируется Turbo. | |

**User's choice:** Turbo task — полная интеграция с кэшированием
**Notes:** Нет

---

## Удаление дубликата

Не обсуждалось отдельно — пользователь выбрал "Вы решайте" для этого аспекта. Анализ кода показал что `contracts/generated/` не импортируется нигде — безопасно удалить.

## Claude's Discretion

- Точная конфигурация Turbo task (inputs/outputs/dependsOn)
- Cleanup dist/generated/ если существует
- Мелкие улучшения generate.sh если очевидны

## Deferred Ideas

Нет — обсуждение осталось в рамках Phase 1
