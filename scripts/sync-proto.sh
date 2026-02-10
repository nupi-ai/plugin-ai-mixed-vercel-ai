#!/bin/bash
# Sync proto files from GitHub repositories
set -e

cd "$(dirname "$0")/.."

PROTO_DIR="./proto"

# Nupi NAP protos
NUPI_REPO="nupi-ai/nupi"
NUPI_BRANCH="main"
NUPI_PROTOS=(
  "api/nap/v1/ai.proto:nupi/nap/v1/ai.proto"
)

# Google well-known types
GOOGLE_REPO="protocolbuffers/protobuf"
GOOGLE_BRANCH="main"
GOOGLE_PROTOS=(
  "src/google/protobuf/timestamp.proto:google/protobuf/timestamp.proto"
)

download_proto() {
  local repo="$1"
  local branch="$2"
  local src="$3"
  local dst="$4"

  local url="https://raw.githubusercontent.com/${repo}/${branch}/${src}"
  local target="${PROTO_DIR}/${dst}"

  mkdir -p "$(dirname "$target")"
  echo "Downloading ${url} -> ${target}"
  curl -sfL "$url" -o "$target" || { echo "Failed to download $url"; exit 1; }
}

echo "Syncing proto files..."

for entry in "${NUPI_PROTOS[@]}"; do
  IFS=':' read -r src dst <<< "$entry"
  download_proto "$NUPI_REPO" "$NUPI_BRANCH" "$src" "$dst"
done

for entry in "${GOOGLE_PROTOS[@]}"; do
  IFS=':' read -r src dst <<< "$entry"
  download_proto "$GOOGLE_REPO" "$GOOGLE_BRANCH" "$src" "$dst"
done

echo "Proto sync complete!"
