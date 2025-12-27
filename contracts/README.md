# Smart Contracts Workflow

This project uses **Scarb** and **Starknet Foundry (`sncast`)** for building, declaring, and deploying contracts.  
All commands are **profile-aware** (e.g. `devnet`, `sepolia`, `mainnet`).

---

## Prerequisites

- `scarb`
- `sncast >= 0.48`
- `jq`
- A running Starknet devnet (for `devnet` profile)
- Properly configured `snfoundry.toml` profiles

---

## Scripts Setup

Make scripts executable (run once):

```bash
chmod +x scripts/build_and_declare.sh
chmod +x scripts/deploy_pos_factory.sh
```

---

## 1. Build & Declare Contracts

This script:

- Builds all contracts
- Declares `POSFactory` and `StorePOS`
- Stores declared **class hashes** in a JSON file at the **project root**

### Command

```bash
./scripts/build_and_declare.sh <PROFILE>
```

### Example (local development)

```bash
./scripts/build_and_declare.sh devnet
```

### Output Artifact

A file is created/updated at the project root:

```text
adresses.json
```

Example contents:

```json
{
  "POSFactory": {
    "class_hash": "0x..."
  },
  "StorePOS": {
    "class_hash": "0x..."
  }
}
```

---

## 2. Deploy POSFactory

POSFactory is deployed **using the StorePOS class hash** as its constructor argument.

### Command

```bash
./scripts/deploy_pos_factory.sh <PROFILE> <STORE_POS_CLASS_HASH>
```

### Example

```bash
./scripts/deploy_pos_factory.sh devnet 0x04a602980e4b5a593e2bc72c56844c966de659d8b623e0061af22a160f01b95d
```

---

## 3. Call a Contract (example)

```bash
sncast --profile=devnet call \
  --contract-address 0x0680845dd2b6022f9a7d16b880d63a393d6c90717d62a3f5defb9fbed9f0aceb \
  --function starknet_entry_points
```

---

## Notes & Best Practices

- **Profiles** (`devnet`, `sepolia`, `mainnet`) are passed explicitly to scripts
- No hard-coded networks or accounts inside scripts
- Local development (`devnet`) uses **localhost** and **OpenZeppelin accounts**
- Sepolia / Mainnet may use **Ready accounts**
- All declared artifacts are tracked centrally in JSON for reproducibility

---

## Recommended Next Steps (Optional)

- Auto-load class hashes from `adresses.json` during deploy
- Persist deployed contract addresses per profile
- Convert scripts into `sncast script` flows
- Add CI support
