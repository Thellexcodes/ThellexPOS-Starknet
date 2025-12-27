#!/usr/bin/env bash
set -euo pipefail

PROFILE=${1:?Usage: ./scripts/declare.sh <profile>}

# Resolve project root
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACTS_FILE="$ROOT_DIR/addresses.json"

# List of contracts to declare
CONTRACTS=("Factory" "Store" "ERC20")

# Ensure artifacts file exists
if [ ! -f "$ARTIFACTS_FILE" ]; then
  echo "{}" > "$ARTIFACTS_FILE"
fi

cd "$ROOT_DIR/contracts"

for CONTRACT in "${CONTRACTS[@]}"; do
  echo "Declaring ${CONTRACT}..."

  # Run sncast declare — capture output even on "already declared"
  OUTPUT=$(sncast --profile "$PROFILE" declare \
    --contract-name "$CONTRACT" 2>&1 || true)

  # Extract the class hash (appears in both success and "already declared" cases)
  CLASS_HASH=$(echo "$OUTPUT" | grep -oE '0x[0-9a-fA-F]{64}' | head -n 1)

  if [[ -z "$CLASS_HASH" ]]; then
    echo "Failed to extract class hash for ${CONTRACT}"
    echo "Full output:"
    echo "$OUTPUT"
    exit 1
  fi

  echo "   ${CONTRACT} class hash: ${CLASS_HASH}"

  # Map contract name to JSON key
  case "$CONTRACT" in
    "Factory") CLASS_KEY="FactoryClassHash" ;;
    "Store")   CLASS_KEY="StoreClassHash" ;;
    "ERC20")   CLASS_KEY="ERC20ClassHash" ;;
    *)         echo "Unknown contract: $CONTRACT"; exit 1 ;;
  esac

  # Update addresses.json with the class hash under the profile
  cd "$ROOT_DIR"

  jq --arg profile "$PROFILE" \
     --arg key "$CLASS_KEY" \
     --arg hash "$CLASS_HASH" \
     '
     .[$profile] = (.[$profile] // {})
     | .[$profile][$key] = $hash
     ' \
     "$ARTIFACTS_FILE" > .tmp.artifacts.json \
     && mv .tmp.artifacts.json "$ARTIFACTS_FILE"

  cd "$ROOT_DIR/contracts"
done

cd "$ROOT_DIR"

echo ""
echo "All contracts declared successfully!"
echo "Class hashes saved to $ARTIFACTS_FILE under profile '$PROFILE'"
echo ""
jq ".\"$PROFILE\"" "$ARTIFACTS_FILE"