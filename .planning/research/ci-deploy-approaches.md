# CI Deploy Approaches: Coolify from GitHub Actions

**Researched:** 2026-04-06
**Confidence:** HIGH

## Summary

There are 4 viable approaches to trigger Coolify v4 deploys from GitHub Actions. The official Coolify docs recommend a raw `curl` GET to the deploy webhook. Community GitHub Actions wrap this into reusable steps. An official Coolify CLI (Go-based, 283 stars) exists but is overkill for CI -- it is designed for interactive use. The cleanest approach for our case (6 matrix services) is either **a community action** or **a custom composite action** wrapping the curl call.

## Approach Comparison

| Approach | Cleanliness | Maintenance | Multi-service | Wait for deploy | Recommendation |
|----------|-------------|-------------|---------------|-----------------|----------------|
| Raw curl in workflow | Low | Self | Manual loop | No | Current, works but ugly |
| `boredland/action-coolify-deployment@1.0.2` | High | Community (3 stars) | Yes (comma-sep UUIDs) | Yes (built-in) | **Best fit** |
| `christophecvb/deploy-coolify-action@v3` | High | Community (6 stars) | Via tag or UUID | Yes (built-in) | Good alternative |
| `marconneves/coolify-actions@v0.0.4` | Medium | Community (30 stars) | No | No | Outdated, v0.0.x |
| Official Coolify CLI | Overkill | Official (283 stars) | Yes (batch cmd) | Yes (--follow) | Better for local dev |
| Custom composite action | Medium | Self | Yes | Can add | Fallback option |

## 1. Official Coolify Docs Approach (Baseline)

Source: https://coolify.io/docs/applications/ci-cd/github/actions

Coolify officially documents a simple `curl` GET with Bearer token:

```yaml
- name: Deploy to Coolify
  run: |
    curl --request GET '${{ secrets.COOLIFY_WEBHOOK }}' \
      --header 'Authorization: Bearer ${{ secrets.COOLIFY_TOKEN }}'
```

**Setup:**
1. Coolify Settings > Configuration > Advanced > Enable "API Access"
2. Keys & Tokens > API Tokens > Check "Deploy" permission > Generate
3. Application > Webhook page > Copy "Deploy webhook" URL
4. GitHub repo Settings > Secrets: `COOLIFY_WEBHOOK`, `COOLIFY_TOKEN`

**Webhook URL format:** `https://<coolify-domain>/api/v1/deploy?uuid=<app-uuid>&force=false`

**Key detail:** The token is shared across all apps. Only the webhook URL (containing the UUID) differs per service.

## 2. Community Action: boredland/action-coolify-deployment (Best Fit)

Source: https://github.com/boredland/action-coolify-deployment

**Why best fit:**
- Supports comma-separated UUIDs for batch deploy
- Built-in wait-for-completion with configurable timeout
- Clean inputs: `api-key`, `coolify-url`, `uuid`, `tag`, `wait`, `force`

```yaml
- name: Deploy all services
  uses: boredland/action-coolify-deployment@1.0.2
  with:
    api-key: ${{ secrets.COOLIFY_API_KEY }}
    coolify-url: ${{ secrets.COOLIFY_URL }}
    uuid: "uuid1,uuid2,uuid3,uuid4,uuid5,uuid6"
    wait: 600
    force: true
```

**Risk:** Only 3 stars, single maintainer. If abandoned, easy to fork or replace with curl.

## 3. Community Action: christophecvb/deploy-coolify-action

Source: https://github.com/marketplace/actions/deploy-to-coolify

- v3.1.0, 6 stars
- Supports deploy by UUID, tag, or PR number
- `waitForDeploy` option with timeout/interval config
- Single UUID per step (no batch), but tag-based deploy can target multiple

```yaml
- name: Deploy to Coolify
  uses: christophecvb/deploy-coolify-action@v3
  with:
    token: ${{ secrets.COOLIFY_API_TOKEN }}
    domain: ${{ secrets.COOLIFY_DOMAIN }}
    uuid: ${{ secrets.COOLIFY_APP_UUID }}
    waitForDeploy: true
    timeout: 300
```

## 4. Official Coolify CLI

Source: https://github.com/coollabsio/coolify-cli

Go binary, officially maintained by coollabsio. 283 stars, active development on v4.x branch.

```bash
coolify deploy name <app-name>
coolify deploy batch <app1,app2,app3>
coolify deploy uuid <uuid> --follow  # streams logs
```

**Not recommended for CI because:**
- Requires install step (curl | bash or go install)
- Context/config setup needed
- Designed for interactive developer use
- Heavier than a simple API call

## 5. Custom Composite Action (Fallback)

If community actions break or are abandoned, wrap the curl in a local composite action:

```yaml
# .github/actions/coolify-deploy/action.yml
name: 'Deploy to Coolify'
description: 'Trigger Coolify deployment via webhook'
inputs:
  webhook-url:
    required: true
  token:
    required: true
runs:
  using: 'composite'
  steps:
    - name: Trigger deploy
      shell: bash
      run: |
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
          --request GET '${{ inputs.webhook-url }}' \
          --header 'Authorization: Bearer ${{ inputs.token }}')
        if [ "$HTTP_CODE" != "200" ]; then
          echo "::error::Deploy failed with HTTP $HTTP_CODE"
          exit 1
        fi
```

Usage:
```yaml
- uses: ./.github/actions/coolify-deploy
  with:
    webhook-url: ${{ secrets.COOLIFY_WEBHOOK_GATEWAY }}
    token: ${{ secrets.COOLIFY_TOKEN }}
```

## Recommendation for Our Setup

**Context:** 6 services in matrix build, need deploy after all images are pushed.

**Recommended approach: Separate deploy job with `boredland/action-coolify-deployment`**

```yaml
deploy:
  name: Deploy to Coolify
  needs: build-and-push
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - name: Deploy all services
      uses: boredland/action-coolify-deployment@1.0.2
      with:
        api-key: ${{ secrets.COOLIFY_API_KEY }}
        coolify-url: ${{ secrets.COOLIFY_URL }}
        uuid: ${{ secrets.COOLIFY_APP_UUIDS }}  # comma-separated
        wait: 600
        force: true
```

**Required secrets:**
- `COOLIFY_API_KEY` -- API token with Deploy permission
- `COOLIFY_URL` -- e.g., `https://coolify.email-platform.pp.ua` (or LAN address)
- `COOLIFY_APP_UUIDS` -- comma-separated UUIDs of all 6 services

**Alternative if we want per-service control:** Use matrix strategy in deploy job with individual UUIDs per service, stored as separate secrets like `COOLIFY_UUID_GATEWAY`, `COOLIFY_UUID_AUTH`, etc.

**Fallback plan:** If the community action breaks, replace with the composite action (approach 5) in 10 minutes.

## Key Detail: Webhook URL is Just an API Call

The Coolify "Deploy Webhook" shown in the UI is simply:
```
GET /api/v1/deploy?uuid=<app-uuid>&force=false
```
with `Authorization: Bearer <token>` header. There is no special webhook mechanism -- it is a standard authenticated API endpoint. The token is the same for all apps; only the UUID differs.

## Sources

- [Coolify Official Docs: GitHub Actions](https://coolify.io/docs/applications/ci-cd/github/actions)
- [boredland/action-coolify-deployment](https://github.com/boredland/action-coolify-deployment)
- [christophecvb/deploy-coolify-action](https://github.com/marketplace/actions/deploy-to-coolify)
- [marconneves/coolify-actions](https://github.com/marketplace/actions/coolify-application-deploy)
- [Official Coolify CLI](https://github.com/coollabsio/coolify-cli)
