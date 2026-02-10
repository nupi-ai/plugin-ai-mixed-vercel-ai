#!/bin/bash
# Generate TypeScript types from proto files
set -e

cd "$(dirname "$0")/.."

PROTO_DIR="./proto"
OUT_DIR="./src/proto"

mkdir -p "$OUT_DIR"

echo "Generating TypeScript types..."

# Note: proto path must be relative to include dir, use -- to separate options from filenames
./node_modules/.bin/proto-loader-gen-types \
  --longs=String \
  --enums=String \
  --defaults \
  --oneofs \
  --grpcLib=@grpc/grpc-js \
  -O "$OUT_DIR" \
  -I "$PROTO_DIR" \
  -- nupi/nap/v1/ai.proto

echo "TypeScript generation complete!"
