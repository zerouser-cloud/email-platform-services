# Runbook: Docker Disk Hygiene

> Phase 999.18.4 Plan 07 — operational runbook for managing Docker disk usage on the local development host.
> Background: `.planning/notes/docker-cache-bloat.md` (seed), `.planning/phases/999.18.4-dockerfile-build-infra-hardening-iterative-refactor/999.18.4-RESEARCH.md` (full investigation).

## Why this runbook exists

Docker не запускает автоматическую garbage collection по умолчанию. На активной dev-машине, где собираются 6 сервисов × 5-stage Dockerfile × N rebuild-ов в день, накапливаются:

- **dangling images** (старые слои без тега) — после каждого `pnpm start:isolated --build`,
- **regular intermediate stage layers** (`pruner`/`prod-deps`/`builder`) — доминирующий потребитель, часто 2-4 ГБ за день при активной разработке,
- **BuildKit cache mounts** (`pnpm-store`) — обычно один экземпляр на ID, делится между сервисами.

Без явной настройки эта куча растёт линейно неделями, пока не упрётся в свободное место на разделе. У нас зафиксирован пик **100+ ГБ** на одной машине — это причина появления Plan 07.

## Disk-usage profile (expected)

После применения `infra/docker/daemon.json.example` (BuildKit GC enabled), ожидаемый профиль:

| Категория              | Объём                                      | Примечание                                                                                      |
| ---------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Images (active tagged) | 5–10 ГБ                                    | 6 service images + base images (postgres, redis, rabbitmq, garage, busybox, grpc-health-probe). |
| Build cache (regular)  | до 20 ГБ                                   | `keepDuration=168h` — старше 7 дней удаляется автоматически; ceiling 20 ГБ из policy.           |
| Build cache (mounts)   | до 2 ГБ                                    | pnpm-store cache mount — один экземпляр на `id=pnpm-store`, не растёт линейно.                  |
| Containers (writable)  | <100 МБ                                    | running + recent stopped; на cold-stop ~0.                                                      |
| Volumes                | определяется проектом                      | Postgres data, garage S3, etc. — НЕ трогаются никаким автоматическим GC.                        |
| **Total ceiling**      | **~30 ГБ** (defaultReservedSpace + policy) | После пика BuildKit GC автоматически реклаймит до этого уровня.                                 |

Если суммарный размер вышел за 30 ГБ — это сигнал, что либо GC не включился, либо надо запустить on-demand cleanup ниже.

## Диагностика

```bash
# Запустить read-only снапшот:
pnpm clean:docker:diagnose
```

Создаёт `.planning/notes/docker-cache-bloat-baseline-{TIMESTAMP}.md` со полной декомпозицией: `docker system df` + `docker buildx du` (по типам) + dangling images count + builder list. Эти файлы в `.gitignore`-not-tracked состоянии — runtime artifacts.

## On-demand cleanup (pnpm scripts)

Все user-facing команды cleanup идут через `pnpm clean:docker:*`. Никогда не вызывай raw `docker prune` напрямую — оборачивающий `scripts/clean-docker.sh` содержит guardrails (запрет на `--volumes`, `-a`, `--all`).

### `pnpm clean:docker:dangling` — самое безопасное

Удаляет только dangling images (без тега, не используются никаким контейнером).

- **Scope:** images filter dangling=true.
- **Safety:** не трогает tagged images, не трогает volumes, не трогает containers, не трогает build cache.
- **Когда использовать:** регулярно (раз в неделю-две) или после серии `pnpm start:isolated --build`.

### `pnpm clean:docker:builder` — buildx cache

Удаляет BuildKit cache, не использовавшийся 168 часов (7 дней).

- **Scope:** `docker buildx prune --filter "unused-for=168h" --force`.
- **Safety:** активный cache (использованный за последние 7 дней) сохраняется → следующий cold-start не замедлится.
- **Когда использовать:** если `docker system df` показал build cache > 20 ГБ.

### `pnpm clean:docker:safe` — комбо

Запускает diagnose → dangling → stopped containers → builder в одной транзакции.

- **Scope:** объединение трёх предыдущих + `docker container prune --force` (только Exited контейнеры).
- **Safety:** идентично выше — никаких volumes, никаких tagged images.
- **Когда использовать:** monthly cleanup или когда хочется освободить место без аналитики «что именно растёт».

### `pnpm clean:docker:nuclear` — для аварийных случаев

То же что `safe`, плюс `docker buildx prune --reserved-space 2GB --force` (агрессивный prune buildkit cache, оставляет только 2 ГБ floor).

- **Scope:** всё что в `safe` + полная очистка buildx cache.
- **Safety:** требует интерактивного подтверждения `[y/N]` (или env var `CLEAN_DOCKER_YES=1` для CI).
- **Cold-start cost:** следующий `pnpm start:isolated` пересоберёт всё с нуля (~5-10 мин дополнительно).
- **Когда использовать:** только если диск переполнен и нужно освободить место немедленно.

## Long-term hygiene — daemon.json BuildKit GC policy

Файл `infra/docker/daemon.json.example` содержит шаблон для `/etc/docker/daemon.json` с включённой автоматической garbage collection. Применяется один раз — после этого Docker сам поддерживает диск в порядке.

### Apply procedure

```bash
# 1. Read current state (всё что есть сейчас — будет преподнесено заменой)
cat /etc/docker/daemon.json

# 2. Compare с template
diff -u /etc/docker/daemon.json infra/docker/daemon.json.example

# 3. Apply (требует sudo)
sudo cp infra/docker/daemon.json.example /etc/docker/daemon.json

# 4. Validate JSON
jq . /etc/docker/daemon.json && echo "JSON valid"

# 5. Restart docker daemon (убьёт ВСЕ running containers!)
sudo systemctl restart docker

# 6. Verify
docker info | grep -i builder
jq -e '.builder.gc.policy' /etc/docker/daemon.json
```

### What gets configured (V2-A conservative)

- `defaultReservedSpace: 10GB` — нижний floor warm cache (BuildKit не уйдёт ниже).
- `keepDuration: 168h` (7 дней) — старше выбрасывается.
- `policy[0]`: cache-mounts + source.local — `maxUsedSpace: 2GB` (pnpm-store, build context).
- `policy[1]`: regular intermediate stage layers — `maxUsedSpace: 20GB` (доминирующий потребитель).
- `policy[2]`: catch-all — `maxUsedSpace: 30GB` (общий потолок), `minFreeSpace: 20GB` (если на разделе осталось <20 ГБ — реклаймить агрессивнее).

### Rollback

Если после restart Docker сломался или поведение не устраивает:

```bash
# Вернуть к дефолту (снять policy)
sudo rm /etc/docker/daemon.json
sudo systemctl restart docker

# Или восстановить из git
git show HEAD:infra/docker/daemon.json.example  # см. что было применено
```

## What this runbook does NOT do

Эти команды **категорически НЕ рекомендуются** этим runbook-ом и **НЕ присутствуют** в `pnpm clean:docker:*` scripts. Если ты их где-то увидишь в дикой природе или в чужих гистах — не запускай:

| Command                         | Почему запрещено                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `docker system prune --volumes` | Сотрёт volumes, включая Postgres data, garage data, etc. — потеря всех runtime данных.                             |
| `docker volume prune`           | То же самое — сотрёт unused volumes; «unused» определяется по running containers, а после `stop:isolated` — все.   |
| `docker image prune -a`         | Удалит **все** non-running images, включая base images (postgres, redis, rabbitmq, busybox). Cold-start сломается. |
| `docker buildx prune --all`     | Удалит весь BuildKit cache — следующий build будет с нуля, ~10 мин на 6 сервисов.                                  |

Если когда-нибудь окажешься в ситуации «диск переполнен, надо ВСЁ снести» — лучше:

1. Сначала `docker system df` — узнать кто реально занимает.
2. Сначала `docker volume ls` — записать имена важных volumes (postgres, garage).
3. Потом точечно: `pnpm clean:docker:nuclear` (с подтверждением).
4. Только в крайнем случае raw `docker system prune --all` (БЕЗ `--volumes`!) — и понимая что base images будут rebootstrapped.

## Internals (raw docker invocations)

> Эта секция — для maintainer-ов `scripts/clean-docker.sh`. В обычной разработке используй `pnpm clean:docker:*`.

`scripts/clean-docker.sh` оборачивает следующие raw команды:

```bash
# diagnose
docker system df
docker system df -v
docker buildx du --filter type=exec.cachemount
docker buildx du --filter type=source.local
docker buildx du --filter type=regular
docker buildx du --filter type=internal
docker buildx du --filter type=frontend
docker buildx du
docker images --filter dangling=true
docker buildx ls

# dangling
docker image prune --filter dangling=true --force

# builder
docker buildx prune --filter "unused-for=168h" --force

# safe (= diagnose + dangling + builder + container)
docker container prune --force
# + the above three

# nuclear (= safe + aggressive buildx)
docker buildx prune --reserved-space 2GB --force
```

Все thresholds (`168h`, `2GB`) объявлены как `readonly` constants в начале `scripts/clean-docker.sh` (per `no-magic-values` SKILL).
