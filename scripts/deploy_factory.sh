#!/usr/bin/env bash
set -euo pipefail

PROFILE=${1:?Usage: ./scripts/deploy_factory.sh <profile> <store_class_hash>}
STORE_CLASS_HASH=${2:?Usage: ./scripts/deploy_factory.sh <profile> <store_class_hash>}

# Resolve project root
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACTS_FILE="$ROOT_DIR/addresses.json"  # Fixed typo: was "adresses.json"

echo "Deploying Factory contract..."
echo "Profile: $PROFILE"
echo "Store class hash (constructor arg): $STORE_CLASS_HASH"
echo ""

# === Read Factory class hash from addresses.json ===
if [[ ! -f "$ARTIFACTS_FILE" ]]; then
  echo "ERROR: $ARTIFACTS_FILE not found. Run ./scripts/declare.sh $PROFILE first."
  exit 1
fi

FACTORY_CLASS_HASH=$(jq -r --arg p "$PROFILE" '.[$p].FactoryClassHash // empty' "$ARTIFACTS_FILE")

if [[ -z "$FACTORY_CLASS_HASH" || "$FACTORY_CLASS_HASH" == "null" ]]; then
  echo "ERROR: FactoryClassHash not found in $ARTIFACTS_FILE under profile '$PROFILE'"
  echo "Make sure you ran ./scripts/declare.sh $PROFILE successfully."
  exit 1
fi

echo "Factory class hash (from addresses.json): $FACTORY_CLASS_HASH"
echo ""

# Change to contracts directory (required for sncast in some setups)
cd "$ROOT_DIR/contracts"

# Deploy the Factory with Store class hash as constructor argument
echo "Deploying Factory..."
OUTPUT=$(sncast --profile="$PROFILE" deploy \
  --class-hash="$FACTORY_CLASS_HASH" \
  --constructor-calldata="$STORE_CLASS_HASH" \
  2>&1)

echo "$OUTPUT"

# Extract deployed contract address
CONTRACT_ADDRESS=$(echo "$OUTPUT" | grep -i "contract address" | grep -oE '0x[0-9a-fA-F]{63,64}' | head -1)

if [[ -z "$CONTRACT_ADDRESS" ]]; then
  echo "ERROR: Failed to extract deployed Factory address from output"
  echo "Full output:"
  echo "$OUTPUT"
  exit 1
fi

echo ""
echo "Factory successfully deployed!"
echo "Address: $CONTRACT_ADDRESS"
echo ""

# Return to root
cd "$ROOT_DIR"

# Save deployed address to addresses.json under profile
jq --arg profile "$PROFILE" \
   --arg addr "$CONTRACT_ADDRESS" \
   '
   .[$profile] //= {} 
   | .[$profile].FactoryAddress = $addr
   ' \
   "$ARTIFACTS_FILE" > "${ARTIFACTS_FILE}.tmp" \
   && mv "${ARTIFACTS_FILE}.tmp" "$ARTIFACTS_FILE"

echo "Factory address saved to $ARTIFACTS_FILE under profile '$PROFILE'"
echo ""
echo "Final entry for profile '$PROFILE':"
jq -r --arg p "$PROFILE" '.[$p] | select(.)' "$ARTIFACTS_FILE"
echo ""
echo "Deployment complete!"