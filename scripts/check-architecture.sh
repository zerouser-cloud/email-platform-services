#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Architecture Verification Script
# Run after each phase: bash scripts/check-architecture.sh
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

pass() { echo -e "${GREEN}  ✅ PASS${NC}: $1"; }
fail() { echo -e "${RED}  ❌ FAIL${NC}: $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "${YELLOW}  ⚠️  WARN${NC}: $1"; WARNINGS=$((WARNINGS + 1)); }
skip() { echo -e "  ⏭️  SKIP: $1"; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Architecture Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# ─── R1: Domain Layer Isolation ───────────────────────────────────────────────
echo "📐 R1: Domain Layer Isolation"

DOMAIN_DIRS=$(find apps/*/src/domain -type d 2>/dev/null || true)
if [ -z "$DOMAIN_DIRS" ]; then
    skip "No domain/ directories found yet"
else
    # Check no NestJS imports in domain layer
    NESTJS_IN_DOMAIN=$(grep -rl "@nestjs" apps/*/src/domain/ 2>/dev/null || true)
    if [ -z "$NESTJS_IN_DOMAIN" ]; then
        pass "Domain layer has no NestJS imports"
    else
        fail "Domain layer imports NestJS in: $NESTJS_IN_DOMAIN"
    fi

    # Check no infrastructure imports in domain layer
    INFRA_IN_DOMAIN=$(grep -rl "infrastructure/" apps/*/src/domain/ 2>/dev/null || true)
    if [ -z "$INFRA_IN_DOMAIN" ]; then
        pass "Domain layer has no infrastructure imports"
    else
        fail "Domain layer imports infrastructure in: $INFRA_IN_DOMAIN"
    fi
fi

echo ""

# ─── R2: Service Isolation ────────────────────────────────────────────────────
echo "🔒 R2: Service Isolation"

SERVICES=(gateway auth sender parser audience notifier)
CROSS_IMPORT_FOUND=false

for SRC in "${SERVICES[@]}"; do
    if [ ! -d "apps/$SRC/src" ]; then continue; fi
    for DST in "${SERVICES[@]}"; do
        if [ "$SRC" = "$DST" ]; then continue; fi
        CROSS=$(grep -rl "apps/$DST" "apps/$SRC/" 2>/dev/null || true)
        if [ -n "$CROSS" ]; then
            fail "apps/$SRC imports from apps/$DST in: $CROSS"
            CROSS_IMPORT_FOUND=true
        fi
    done
done

if [ "$CROSS_IMPORT_FOUND" = false ]; then
    pass "No cross-service imports detected"
fi

echo ""

# ─── R4: Gateway Rules ───────────────────────────────────────────────────────
echo "🚪 R4: Gateway Rules"

if [ -d "apps/gateway/src" ]; then
    if [ -d "apps/gateway/src/domain" ]; then
        fail "Gateway has domain/ directory (should not contain business logic)"
    else
        pass "Gateway has no domain/ directory"
    fi

    if [ -d "apps/gateway/src/application/use-cases" ]; then
        fail "Gateway has use-cases/ directory (should not contain business logic)"
    else
        pass "Gateway has no use-cases/ directory"
    fi
else
    skip "Gateway src/ not created yet"
fi

echo ""

# ─── R5: Auth Centralization ─────────────────────────────────────────────────
echo "🔐 R5: Auth Centralization"

NON_AUTH_SERVICES=(sender parser audience notifier)
JWT_LEAK=false

for SVC in "${NON_AUTH_SERVICES[@]}"; do
    if [ ! -d "apps/$SVC" ]; then continue; fi
    JWT_IMPORT=$(grep -rl "jsonwebtoken" "apps/$SVC/" 2>/dev/null || true)
    if [ -n "$JWT_IMPORT" ]; then
        fail "apps/$SVC imports jsonwebtoken directly: $JWT_IMPORT"
        JWT_LEAK=true
    fi
done

if [ "$JWT_LEAK" = false ]; then
    pass "No JWT library imports outside Auth Service"
fi

echo ""

# ─── R3: Contract Rules ──────────────────────────────────────────────────────
echo "📜 R3: Contract Rules"

if [ -d "packages/contracts" ]; then
    # Check no business logic in contracts (no .service.ts, no .use-case.ts)
    BIZ_LOGIC=$(find packages/contracts -name "*.service.ts" -o -name "*.use-case.ts" 2>/dev/null || true)
    if [ -z "$BIZ_LOGIC" ]; then
        pass "packages/contracts has no business logic files"
    else
        fail "packages/contracts contains business logic: $BIZ_LOGIC"
    fi
else
    skip "packages/contracts not created yet"
fi

echo ""

# ─── R6: Package Dependency Direction ────────────────────────────────
echo "📦 R6: Package Dependency Direction"

DIRECTION_VIOLATION=false

# contracts: leaf package — cannot import any workspace package
if [ -d "packages/contracts/src" ]; then
    BAD=$(grep -rl "@email-platform/" packages/contracts/src/ 2>/dev/null | grep -v "node_modules" || true)
    if [ -z "$BAD" ]; then
        pass "contracts has no workspace package imports"
    else
        fail "contracts imports workspace packages: $BAD"
        DIRECTION_VIOLATION=true
    fi
fi

# config: cannot import foundation or apps
if [ -d "packages/config/src" ]; then
    BAD=$(grep -rEl "@email-platform/(foundation|gateway|auth|sender|parser|audience|notifier)" packages/config/src/ 2>/dev/null || true)
    if [ -z "$BAD" ]; then
        pass "config has no wrong-direction imports"
    else
        fail "config imports wrong-direction packages: $BAD"
        DIRECTION_VIOLATION=true
    fi
fi

# foundation: cannot import apps
if [ -d "packages/foundation/src" ]; then
    BAD=$(grep -rEl "@email-platform/(gateway|auth|sender|parser|audience|notifier)" packages/foundation/src/ 2>/dev/null || true)
    if [ -z "$BAD" ]; then
        pass "foundation has no wrong-direction imports"
    else
        fail "foundation imports app packages: $BAD"
        DIRECTION_VIOLATION=true
    fi
fi

# cross-app: each app cannot import other app packages
APP_NAMES=(gateway auth sender parser audience notifier)
CROSS_APP_VIOLATION=false

for APP in "${APP_NAMES[@]}"; do
    if [ ! -d "apps/$APP/src" ]; then continue; fi
    OTHERS=""
    for OTHER in "${APP_NAMES[@]}"; do
        if [ "$APP" = "$OTHER" ]; then continue; fi
        if [ -z "$OTHERS" ]; then
            OTHERS="$OTHER"
        else
            OTHERS="$OTHERS|$OTHER"
        fi
    done
    BAD=$(grep -rEl "@email-platform/($OTHERS)" "apps/$APP/src/" 2>/dev/null || true)
    if [ -n "$BAD" ]; then
        fail "apps/$APP imports other app packages: $BAD"
        CROSS_APP_VIOLATION=true
        DIRECTION_VIOLATION=true
    fi
done

if [ "$CROSS_APP_VIOLATION" = false ]; then
    pass "No cross-app package imports detected"
fi

if [ "$DIRECTION_VIOLATION" = false ]; then
    pass "Package dependency direction is correct"
fi

echo ""

# ─── Summary ─────────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN} ✅ ALL CHECKS PASSED${NC} ($WARNINGS warnings)"
else
    echo -e "${RED} ❌ $ERRORS CHECK(S) FAILED${NC} ($WARNINGS warnings)"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $ERRORS
