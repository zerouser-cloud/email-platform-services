# Phase 4: Architecture Reference Implementation - Discussion Log

> **Audit trail only.**

**Date:** 2026-04-02
**Phase:** 04-architecture-reference-implementation
**Areas discussed:** Scope каркаса, Валидация

---

## Scope каркаса

| Option | Description | Selected |
|--------|-------------|----------|
| Полный каркас | Все файлы по TARGET_ARCHITECTURE: entities, VOs, ports, use-case заглушки, adapter заглушки | |
| Только слои | domain/, application/, infrastructure/ + минимум файлов: 1 entity, 1 port, 1 use-case, 1 adapter | ✓ |
| Полный + DI wiring | Как полный + DI в module.ts. Сервис собирается. | |

**User's choice:** Только слои — минимальный каркас для валидации паттерна

---

## Валидация

| Option | Description | Selected |
|--------|-------------|----------|
| После выполнения (Recommended) | Создать каркас, потом валидатор. Нарушения — в gap closure. | |
| В каждом плане | Валидация после каждого плана — строже, но дороже | ✓ |

**User's choice:** Строгая валидация после каждого плана

## Claude's Discretion

- Точные имена файлов
- Domain service stub или нет
- gRPC adapter wiring approach

## Deferred Ideas

Нет
