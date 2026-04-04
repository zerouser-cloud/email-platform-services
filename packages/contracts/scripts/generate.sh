#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "${SKIP_PROTO_GEN:-}" = "true" ]; then
  echo "Skipping protobuf generation (SKIP_PROTO_GEN=true)..."
  exit 0
fi

PROTO_DIR="$SCRIPT_DIR/../proto"
OUT_DIR="$SCRIPT_DIR/../src/generated"

# Clean and recreate output directory
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

TS_PROTO_PLUGIN="$(pnpm bin)/protoc-gen-ts_proto"

if [ ! -x "$TS_PROTO_PLUGIN" ]; then
  # Fallback to workspace root bin
  TS_PROTO_PLUGIN="$(pnpm bin -w)/protoc-gen-ts_proto"
fi

if [ ! -x "$TS_PROTO_PLUGIN" ]; then
  # Fallback to global path
  TS_PROTO_PLUGIN="$(which protoc-gen-ts_proto || echo '')"
fi

if [ -z "$TS_PROTO_PLUGIN" ] || [ ! -x "$TS_PROTO_PLUGIN" ]; then
  echo "Error: protoc-gen-ts_proto not found. Run 'pnpm install' first."
  exit 1
fi

echo "Generating TypeScript from proto files..."
echo "  Proto dir: $PROTO_DIR"
echo "  Output dir: $OUT_DIR"

pnpm exec grpc_tools_node_protoc \
  --plugin="protoc-gen-ts_proto=$TS_PROTO_PLUGIN" \
  --ts_proto_out="$OUT_DIR" \
  --ts_proto_opt=nestJs=true \
  --ts_proto_opt=addGrpcMetadata=true \
  --ts_proto_opt=outputServices=grpc-js \
  --ts_proto_opt=esModuleInterop=true \
  --ts_proto_opt=env=node \
  --ts_proto_opt=useOptionals=messages \
  --proto_path="$PROTO_DIR" \
  "$PROTO_DIR"/*.proto

echo "✅ Generated $(ls "$OUT_DIR"/*.ts 2>/dev/null | wc -l) TypeScript files"
