#!/usr/bin/env bash
set -euo pipefail

PROFILE=${1:?Usage: ./scripts/deploy_pos_factory.sh <profile> <store_pos_class_hash>}
STORE_POS_CLASS_HASH=${2:?Usage: ./scripts/deploy_pos_factory.sh <profile> <store_pos_class_hash>}

POS_FACTORY_CLASS_HASH=0x04a602980e4b5a593e2bc72c56844c966de659d8b623e0061af22a160f01b95d

# Resolve project root
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACTS_FILE="$ROOT_DIR/adresses.json"

echo "Deploying POSFactory..."
echo "Profile: ${PROFILE}"
echo "POSFactory class hash: ${POS_FACTORY_CLASS_HASH}"
echo "StorePOS class hash (constructor arg): ${STORE_POS_CLASS_HASH}"

cd "$ROOT_DIR/contracts"

OUTPUT=$(sncast --profile="$PROFILE" deploy \
  --class-hash="$POS_FACTORY_CLASS_HASH" \
  --arguments "$STORE_POS_CLASS_HASH")

echo "$OUTPUT"

CONTRACT_ADDRESS=$(echo "$OUTPUT" | grep -oE 'Contract Address:\s*0x[0-9a-fA-F]+' | awk '{print $3}')

if [[ -z "$CONTRACT_ADDRESS" ]]; then
  echo "Failed to extract deployed contract address"
  exit 1
fi

echo "POSFactory deployed at: ${CONTRACT_ADDRESS}"

cd "$ROOT_DIR"

# Ensure artifacts file exists
if [ ! -f "$ARTIFACTS_FILE" ]; then
  echo "{}" > "$ARTIFACTS_FILE"
fi

jq --arg profile "$PROFILE" \
   --arg address "$CONTRACT_ADDRESS" \
   '
   .[$profile] = (.[$profile] // {})
   | .[$profile].POSFactoryAddress = $address
   ' \
   "$ARTIFACTS_FILE" > .tmp.artifacts.json \
   && mv .tmp.artifacts.json "$ARTIFACTS_FILE"

echo "Deployment address saved under profile '${PROFILE}'"
echo "POSFactory deployment complete."
