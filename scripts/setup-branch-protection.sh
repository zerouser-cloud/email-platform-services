#!/bin/bash
# Setup branch protection rules for dev and main branches.
# Usage: ./scripts/setup-branch-protection.sh <owner/repo>
# Requires: gh CLI authenticated with repo admin access.

set -euo pipefail

REPO="${1:?Usage: $0 <owner/repo>}"

for BRANCH in dev main; do
  echo "Setting protection for $BRANCH..."

  gh api \
    --method PUT \
    "repos/$REPO/branches/$BRANCH/protection" \
    --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Lint", "Typecheck", "Build"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF

  echo "Done: $BRANCH"
done

echo "Branch protection configured for dev and main."
