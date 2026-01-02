#!/usr/bin/env bash
set -euo pipefail

PROFILE=${1:?Usage: ./scripts/declare.sh <profile>}

# Resolve project root
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"
ARTIFACTS_FILE="$ROOT_DIR/addresses.json"

# Contracts to declare (must match exact names in Scarb.toml)
CONTRACTS=("Factory" "Store" "ERC20")

echo "Declaring contracts on profile: $PROFILE"
echo "Working in: $CONTRACTS_DIR"
echo ""

# Ensure artifacts file exists
[ ! -f "$ARTIFACTS_FILE" ] && echo "{}" > "$ARTIFACTS_FILE"

# MUST cd into contracts dir
cd "$CONTRACTS_DIR"

for CONTRACT in "${CONTRACTS[@]}"; do
  echo "Processing $CONTRACT..."

  # Try to declare – capture output and status
  if OUTPUT=$(sncast --profile "$PROFILE" declare \
      --contract-name "$CONTRACT" \
      2>&1); then

    # Success: new declaration
    echo "Declared successfully"
    echo "$OUTPUT"

    CLASS_HASH=$(echo "$OUTPUT" | grep -i "Class Hash:" | awk '{print $NF}' || echo "")
    [ -z "$CLASS_HASH" ] && CLASS_HASH=$(echo "$OUTPUT" | grep -oE '0x[0-9a-fA-F]{64,}' | head -1)

  else
    # Failed: likely already declared
    echo "$OUTPUT"

    if echo "$OUTPUT" | grep -q "Class.*already declared"; then
      echo "Class already declared – extracting existing class hash from error message..."

      # Extract the hash mentioned in the error: 0x04004ea25de5078814dec3f9f34f42ec1ede5f75c01e9ecbe558d53bdc84affb
      CLASS_HASH=$(echo "$OUTPUT" | grep -oE '0x[0-9a-fA-F]{64,}' | head -1)

      if [ -z "$CLASS_HASH" ]; then
        echo "ERROR: Could not extract class hash even from error message for $CONTRACT"
        exit 1
      fi

      echo "   → Existing class hash: $CLASS_HASH"
    else
      echo "ERROR: Unexpected declaration failure for $CONTRACT"
      exit 1
    fi
  fi

  if [ -z "$CLASS_HASH" ]; then
    echo "ERROR: Failed to obtain class hash for $CONTRACT"
    exit 1
  fi

  echo "   → Using class hash: $CLASS_HASH"

  # Map to JSON key
  case "$CONTRACT" in
    Factory) KEY="FactoryClassHash" ;;
    Store)   KEY="StoreClassHash" ;;
    ERC20)   KEY="ERC20ClassHash" ;;
    *)       echo "Unknown contract: $CONTRACT"; exit 1 ;;
  esac

  # Save to addresses.json
  jq --arg profile "$PROFILE" \
     --arg key "$KEY" \
     --arg hash "$CLASS_HASH" \
     '.[$profile] //= {} | .[$profile][$key] = $hash' \
     "$ARTIFACTS_FILE" > "$ARTIFACTS_FILE.tmp" \
     && mv "$ARTIFACTS_FILE.tmp" "$ARTIFACTS_FILE"

  echo "   → Saved to addresses.json under $PROFILE.$KEY"
  echo ""
done

cd "$ROOT_DIR"

echo "✅ All contracts processed!"
echo "Final class hashes for profile '$PROFILE':"
jq ".\"$PROFILE\"" "$ARTIFACTS_FILE"