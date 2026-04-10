# Diun Script Notifier: Deduplication Research

**Date:** 2026-04-06
**Confidence:** HIGH (verified against source code and official docs)

## Summary

Diun processes images concurrently via a worker pool (default 10 workers), and notifications fire per-image as each check completes -- there is NO batching. The script notifier executes synchronously (`cmd.Run()`), but because the worker pool runs jobs in parallel goroutines, multiple script invocations CAN overlap. A lock file approach works but needs `flock` instead of naive file checks due to race conditions. The `diun.watch_repo` label does NOT control notification deduplication -- it only enables watching all tags in a repo.

## Q1: Timing -- Synchronous or Parallel?

**Answer: BOTH. Script itself is synchronous, but multiple scripts run in parallel.**

- Diun uses a worker pool with configurable concurrency (`watch.workers`, default: 10)
- Each image check runs as a separate job in the pool
- When a job finds an update, it calls `notif.Send(entry)` immediately (no collection/batching)
- `notif.Send` iterates through registered notifiers and calls each one's `Send()` method
- The script notifier uses `exec.Command` + `cmd.Run()` (synchronous, blocks until script exits)
- BUT: since 6 images are checked by 6 separate goroutines in the worker pool, up to 6 script invocations can overlap

**Source:** GitHub `internal/notif/script/client.go` line 57: `cmd.Run()` (blocking). Worker pool in `internal/app/diun.go`.

**Confidence:** HIGH

## Q2: Lock File Approach

**The naive approach has a race condition:**

```sh
# RACE CONDITION: Two scripts check simultaneously, both see no lock, both proceed
if [ -f "$LOCK" ] && [ $(($(date +%s) - $(cat "$LOCK"))) -lt 60 ]; then
  exit 0
fi
date +%s > "$LOCK"
```

Since worker pool runs jobs in parallel, two scripts can check the lock file at the same time, both find it absent, and both proceed to deploy.

**Correct approach -- use `flock` (atomic kernel-level locking):**

```sh
#!/bin/sh
TAG=$(echo "$DIUN_ENTRY_IMAGE" | sed 's/.*://')
LOCK="/tmp/diun-deploy-${TAG}.lock"
COOLDOWN=60

# flock -n = non-blocking, exits 1 if lock held by another process
# flock -w 0 = same effect
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "Another deploy already in progress for $TAG, skipping"
  exit 0
fi

# Check cooldown (inside lock, so no race)
if [ -f "${LOCK}.ts" ]; then
  LAST=$(cat "${LOCK}.ts")
  NOW=$(date +%s)
  if [ $((NOW - LAST)) -lt $COOLDOWN ]; then
    echo "Deployed $TAG $((NOW - LAST))s ago, skipping"
    exit 0
  fi
fi

date +%s > "${LOCK}.ts"

# Call Coolify deploy here
```

**Important:** Alpine's busybox includes `flock`. Verified: busybox utilities in Alpine 3.23 include flock.

**Confidence:** HIGH

## Q3: DIUN_WATCH_FIRSTCHECKNOTIF and notify_on

### firstCheckNotif
- Controls whether notifications fire on the VERY FIRST analysis of an image (when Diun has no prior record)
- Default: `false` (no notification on first check)
- This is about initial discovery, NOT about deduplication within a cycle
- **Not useful for deduplication**

### diun.notify_on label
- Accepts semicolon-separated values: `new`, `update`
- Default: `new;update`
- `new` = image tag seen for the first time
- `update` = existing tracked image has new digest
- **Cannot filter "only first image per cycle"** -- it's per-image status, not per-cycle ordering

**Confidence:** HIGH

## Q4: Notification Loop Architecture

From source code analysis:

1. `Run()` in `diun.go` creates a worker pool
2. Each provider (Docker, Swarm, K8s, File, etc.) submits image jobs to the pool
3. Pool workers execute `runJob()` concurrently
4. `runJob()` checks manifest, determines status (new/update/unchanged)
5. If notification needed, `runJob()` calls `di.notif.Send(entry)` IMMEDIATELY
6. There is NO "collect all changes, then notify once" mechanism
7. Each image update triggers its own independent notification cycle

**The notification is per-image, not per-cycle. There is no built-in deduplication.**

**Confidence:** HIGH (verified from source code on GitHub)

## Q5: Can diun.notify_on Help?

**Short answer: No, not for deduplication.**

The idea was: set `notify_on=new` on 5 services and `notify_on=new;update` on gateway only. This fails because:

- After the first check cycle, all images are "known" to Diun
- On subsequent CI pushes, ALL 6 images get new digests = all 6 are `update` status
- The 5 services with `notify_on=new` would indeed be silent on updates
- Gateway with `notify_on=new;update` would fire once

**Wait -- this actually WORKS for the specific use case!** If all 6 images always update together (same CI build), then:
- Gateway: `notify_on=new;update` -- fires on every new digest
- Other 5: `notify_on=new` -- only fires if the tag is brand new (not on digest updates)

**CAVEAT:** This means the 5 services would NEVER notify on updates, which is the desired behavior IF you only need one deploy trigger. But if gateway somehow doesn't update while others do (unlikely but possible), you'd miss the deploy.

**This is actually the simplest approach if all 6 images are always pushed together by CI.**

**Confidence:** MEDIUM (logic is sound, but edge cases exist)

## Q6: Diun Alpine Image -- Available Tools

Verified by running the actual container:

| Tool | Available | Path |
|------|-----------|------|
| sh | YES | `/bin/sh` (busybox) |
| bash | NO | - |
| wget | YES | `/usr/bin/wget` (busybox wget) |
| curl | NO | - |
| flock | YES | busybox built-in |

- Base: Alpine Linux 3.23
- Installed packages: `ca-certificates`, `tzdata` only
- busybox wget supports: `-q`, `-O`, `-T` (timeout), `--header` for custom headers

**Confidence:** HIGH (verified by running `docker run --rm crazymax/diun:latest`)

### wget syntax for Coolify API call:

```sh
wget -q -O /dev/null \
  --header "Authorization: Bearer ${COOLIFY_TOKEN}" \
  "http://192.168.1.25:8000/api/v1/deploy?uuid=${UUID}&force=false"
```

## CRITICAL: diun.watch_repo Misconception

**The existing plan (18.1-01) assumes `diun.watch_repo=true` on gateway only = single webhook trigger. This is WRONG.**

`diun.watch_repo` means "watch all tags in this image's repository" (e.g., discover `dev-latest`, `prod-latest`, `v1.2.3` etc.), NOT "this is the only container that triggers webhooks."

Every container with `diun.enable=true` that has a digest change WILL trigger a separate notification, regardless of `watch_repo` setting.

**The only ways to get exactly 1 deploy call per cycle are:**

1. **`notify_on` approach:** Set `diun.notify_on=new` on 5 services, `diun.notify_on=new;update` on gateway (simplest)
2. **Script notifier with flock dedup:** Use script notifier instead of webhook, with kernel-level locking
3. **Combination:** Script notifier with cooldown timer

## Recommended Approach

**Option A (simplest, no script needed):** Use webhook notifier + `diun.notify_on` labels
- Gateway: `diun.notify_on: "new;update"` 
- Other 5: `diun.notify_on: "new"`
- Webhook fires only for gateway updates
- Risk: if gateway doesn't update but others do, deploy is missed (low risk if CI always builds all 6)

**Option B (most robust):** Script notifier with flock dedup
- All 6 services: `diun.notify_on: "new;update"` (default)
- Script uses `flock` + cooldown to ensure only first invocation per TAG per 60s window triggers deploy
- Works even if only some services update
- Requires mounting a script into the Diun container

**Option C (hybrid):** Webhook notifier for simplicity, accept that Coolify handles concurrent deploys
- Coolify may already queue/deduplicate deploy requests for the same environment
- Worth testing: fire 6 rapid GETs to the deploy endpoint, check if Coolify runs 6 deploys or 1

## Sources

- [Diun Script Notifier docs](https://crazymax.dev/diun/notif/script/) -- env vars, configuration
- [Diun Docker Provider docs](https://crazymax.dev/diun/providers/docker/) -- labels including notify_on, watch_repo
- [Diun Watch config](https://crazymax.dev/diun/config/watch/) -- firstCheckNotif, workers, schedule
- [Diun source: script/client.go](https://github.com/crazy-max/diun/blob/master/internal/notif/script/client.go) -- cmd.Run() synchronous execution
- [Diun source: diun.go](https://github.com/crazy-max/diun/blob/master/internal/app/diun.go) -- worker pool, job dispatch
- [Diun source: notif/client.go](https://github.com/crazy-max/diun/blob/master/internal/notif/client.go) -- per-entry Send() loop
- [Diun Dockerfile](https://github.com/crazy-max/diun/blob/master/Dockerfile) -- Alpine 3.23 base
