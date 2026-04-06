---
phase: quick
plan: 260406-oes
type: execute
wave: 1
depends_on: []
files_modified:
  - docker-compose.prod.yml
  - infra/scripts/deploy-router.sh
  - .github/actions/coolify-deploy/action.yml
  - .github/workflows/docker-build.yml
autonomous: true
must_haves:
  truths:
    - "CI push to dev or main builds images AND triggers Coolify deploy"
    - "No Diun labels remain in docker-compose.prod.yml"
    - "No Diun deploy-router.sh script exists"
    - "Coolify UUIDs and credentials come from GitHub secrets, never hardcoded"
  artifacts:
    - path: ".github/actions/coolify-deploy/action.yml"
      provides: "Reusable composite action wrapping Coolify deploy API"
    - path: ".github/workflows/docker-build.yml"
      provides: "CI workflow with deploy job after build-and-push"
    - path: "docker-compose.prod.yml"
      provides: "Clean compose without Diun labels"
  key_links:
    - from: ".github/workflows/docker-build.yml"
      to: ".github/actions/coolify-deploy/action.yml"
      via: "uses: ./.github/actions/coolify-deploy"
      pattern: "uses:.*coolify-deploy"
---

<objective>
Replace Diun pull-based deployment with GitHub Actions push-based Coolify deploy.

Purpose: After CI builds and pushes Docker images to GHCR, a deploy job calls Coolify API to trigger redeployment. This eliminates the need for Diun polling and the deploy-router.sh script.
Output: Updated CI workflow with deploy job, new composite action, cleaned docker-compose.
</objective>

<execution_context>
@/home/mr/Hellkitchen/workspace/projects/tba-tech/api/email-platform_claude/.claude/get-shit-done/workflows/execute-plan.md
@/home/mr/Hellkitchen/workspace/projects/tba-tech/api/email-platform_claude/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docker-compose.prod.yml
@.github/workflows/docker-build.yml
@infra/scripts/deploy-router.sh
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove Diun artifacts from compose and scripts</name>
  <files>docker-compose.prod.yml, infra/scripts/deploy-router.sh</files>
  <action>
1. In `docker-compose.prod.yml`, remove the `labels:` block (containing `diun.enable: "true"`) from ALL 6 services: gateway, auth, sender, parser, audience, notifier. Remove the entire `labels:` key and its children — no labels section should remain.

2. Delete `infra/scripts/deploy-router.sh` entirely. This Diun script notifier is no longer needed.

NOTE: Do NOT change any ports, healthchecks, images, pull_policy, or other settings. Only remove Diun-related labels and delete the script.
  </action>
  <verify>
    <automated>grep -r "diun" docker-compose.prod.yml && echo "FAIL: diun labels still present" || echo "OK: no diun labels"; test ! -f infra/scripts/deploy-router.sh && echo "OK: script deleted" || echo "FAIL: script still exists"</automated>
  </verify>
  <done>docker-compose.prod.yml has zero Diun labels across all 6 services. deploy-router.sh is deleted.</done>
</task>

<task type="auto">
  <name>Task 2: Create composite action and add deploy job to CI</name>
  <files>.github/actions/coolify-deploy/action.yml, .github/workflows/docker-build.yml</files>
  <action>
1. Create `.github/actions/coolify-deploy/action.yml` — a composite action that calls the Coolify deploy API:
   - `name: Coolify Deploy`
   - `description: Trigger Coolify redeployment via API`
   - Inputs (all required): `token` (Coolify API token), `host` (Coolify host URL), `uuid` (Coolify application UUID)
   - Single step using `curl`:
     ```
     curl -fsSL -H "Authorization: Bearer ${{ inputs.token }}" \
       "${{ inputs.host }}/api/v1/deploy?uuid=${{ inputs.uuid }}&force=false"
     ```
   - Use `shell: bash` for the run step

2. Update `.github/workflows/docker-build.yml` — add a `deploy` job AFTER `build-and-push`:
   - `needs: [build-and-push]` so it runs only after ALL matrix builds complete
   - `runs-on: ubuntu-latest`
   - `if: success()` (only deploy if all builds succeeded)
   - Steps:
     a. `actions/checkout@v4` (needed to access local composite action)
     b. Use `./.github/actions/coolify-deploy` with inputs:
        - `token: ${{ secrets.COOLIFY_TOKEN }}`
        - `host: ${{ secrets.COOLIFY_HOST }}`
        - `uuid`: conditionally select based on branch:
          `${{ github.ref == 'refs/heads/dev' && secrets.COOLIFY_UUID_DEV || secrets.COOLIFY_UUID_PROD }}`

   IMPORTANT: All secrets (COOLIFY_TOKEN, COOLIFY_HOST, COOLIFY_UUID_DEV, COOLIFY_UUID_PROD) come from GitHub repository secrets. Do NOT hardcode any values.
  </action>
  <verify>
    <automated>cat .github/actions/coolify-deploy/action.yml | grep -q "api/v1/deploy" && echo "OK: action has deploy endpoint" || echo "FAIL"; cat .github/workflows/docker-build.yml | grep -q "needs:.*build-and-push" && echo "OK: deploy depends on build" || echo "FAIL"; cat .github/workflows/docker-build.yml | grep -q "COOLIFY_TOKEN" && echo "OK: uses secrets" || echo "FAIL"; cat .github/workflows/docker-build.yml | grep -q "COOLIFY_UUID_DEV" && echo "OK: has dev UUID ref" || echo "FAIL"</automated>
  </verify>
  <done>Composite action exists at .github/actions/coolify-deploy/action.yml. CI workflow has deploy job that runs after all matrix builds, uses secrets for Coolify credentials, routes to dev or prod UUID based on branch.</done>
</task>

</tasks>

<verification>
- `grep -r "diun" docker-compose.prod.yml` returns nothing
- `test ! -f infra/scripts/deploy-router.sh` passes
- `.github/actions/coolify-deploy/action.yml` exists and contains deploy API call
- `.github/workflows/docker-build.yml` has deploy job with `needs: [build-and-push]`
- No hardcoded Coolify UUIDs or tokens anywhere in code
</verification>

<success_criteria>
- Diun completely removed: no labels in compose, no deploy-router.sh script
- CI pipeline: build-and-push -> deploy (sequential)
- Deploy routes to correct Coolify UUID based on branch (dev vs main)
- All credentials from GitHub secrets only
</success_criteria>

<output>
After completion, create `.planning/quick/260406-oes-pivot-deploy-replace-diun-with-ci-push-b/260406-oes-SUMMARY.md`
</output>
