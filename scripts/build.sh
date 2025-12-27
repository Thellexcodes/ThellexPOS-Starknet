#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"

echo "Building contracts..."
cd "$CONTRACTS_DIR"

scarb build

echo "Build completed."
