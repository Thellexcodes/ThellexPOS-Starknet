# Smart Contracts Workflow

This project uses **Scarb** and **Starknet Foundry (`sncast`)** for building, declaring, and deploying contracts.  
All commands are **profile-aware** (e.g. `devnet`, `sepolia`, `mainnet`).

---

## Prerequisites

- `scarb`
- `sncast >= 0.48`
- A running Starknet devnet (for `devnet` profile)
- Properly configured `snfoundry.toml` profiles

---

## Scripts Setup

Make scripts executable (run once):

```bash
chmod +x scripts/*.sh
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
  "devnet": {
    "FactoryClassHash": "...",
    "StoreClassHash": "...",
    "ERC20ClassHash": "...",
    "FactoryAddress": "..."
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

---

# THELLEX POS PROTOCOL

This document provides a guide to deploying and interacting with the **Thellex POS Protocol** on Starknet, including account setup, factory deployment, POS creation, and POS operations.

---

## 1. Account Setup

Import your devnet account using `sncast`:

```bash
sncast account import \
 --address=0x... \
 --type=oz \
 --url=http://127.0.0.1:5050 \
 --private-key=000... \
 --add-profile=devnet \
 --silent
```

---

## 2. Contract Declaration

Declare the ThellexPOSFactory and POSV1 contract on the devnet profile:

```bash
sncast --profile=devnet declare \
 --contract-name=ThellexPOSFactory

sncast --profile=devnet declare \
 --contract-name=ThellexPOSV1
```

---

## 3. Setup & Deployment (JS/TS)

### Dependencies

```bash
yarn add @thellex/pos-sdk starknet
```

### Setup Provider & Account

```ts
import { Account, RpcProvider } from "starknet";

const nodeUrl = "http://127.0.0.1:5050";
const provider = new RpcProvider({ nodeUrl });

const PRIVATE_KEY = "0x00000000000000000000000000000000...";
const ACCOUNT_ADDRESS =
  "0x03a33cdea932bcd7d6a7915223965dd4a379896cb34d443002abf0f8555cf744";

const factoryAccount = new Account(
  provider,
  ACCOUNT_ADDRESS,
  FACTORY_PRIVATE_KEY
);
```

### Deploy & Initialize Factory

```ts
import { ThellexPOSFactoryBuilder } from "@thellex/pos-sdk";

const factoryBuilder = new ThellexPOSFactoryBuilder({
  treasuryAddress: FACTORY_ACCOUNT_ADDRESS,
  nodeUrl,
  contractsPath: CONTRACTS_DIR,
  factoryContractPath: FACTORY_FILENAME,
  udcAddress: "0x",
});

const deployFactoryResponse = await factoryAccount.deployContract({
  classHash: factoryClassHash,
  constructorCalldata: [],
});

const initTx = await factoryBuilder.buildInitializeFactoryTransaction(
  deployFactoryResponse.contract_address,
  FACTORY_FILENAME,
  { feePercent: 500, taxPercent: 200, timeout: 3600 }
);

await factoryBuilder.sendTransaction(factoryAccount, initTx);
```

---

## 4. Factory Management Functions

```ts
await factoryBuilder.sendTransaction(
  factoryAccount,
  factoryBuilder.buildAddSupportedToken(
    deployFactoryResponse.contract_address,
    tokenAddress,
    FACTORY_FILENAME
  )
);

await factoryBuilder.sendTransaction(
  factoryAccount,
  factoryBuilder.buildRemoveSupportedToken(
    deployFactoryResponse.contract_address,
    tokenAddress,
    FACTORY_FILENAME
  )
);

await factoryBuilder.sendTransaction(
  factoryAccount,
  factoryBuilder.buildUpdateTreasury(
    deployFactoryResponse.contract_address,
    "0x222...",
    FACTORY_FILENAME
  )
);

await factoryBuilder.sendTransaction(
  factoryAccount,
  factoryBuilder.buildUpdateFeePercent(
    deployFactoryResponse.contract_address,
    700,
    FACTORY_FILENAME
  )
);

await factoryBuilder.sendTransaction(
  factoryAccount,
  factoryBuilder.buildUpdateTaxPercent(
    deployFactoryResponse.contract_address,
    300,
    FACTORY_FILENAME
  )
);

await factoryBuilder.sendTransaction(
  factoryAccount,
  factoryBuilder.buildUpdateTimeout(
    deployFactoryResponse.contract_address,
    7200,
    FACTORY_FILENAME
  )
);
```

---

## 5. POS Creation & Event Monitoring

```ts
const posArgs = {
  owner: FACTORY_ACCOUNT_ADDRESS,
  treasury: FACTORY_ACCOUNT_ADDRESS,
  fee_percent: 500,
  tax_percent: 200,
  timeout: 86400,
  factory_address: deployFactoryResponse.contract_address,
};

const createPosTx = await factoryBuilder.buildCreatePOS(
  FACTORY_FILENAME,
  posArgs.factory_address,
  posArgs.owner,
  posClassHash
);

await factoryAccount.execute(createPosTx);
```

---

## 6. POS Operations

```ts
const posBuilder = new ThellexPOSBuilder(factoryBuilder);

await factoryBuilder.sendTransaction(
  factoryAccount,
  posBuilder.buildDeposit(posAddress, "1000", "tx001", tokenAddress)
);

await factoryBuilder.sendTransaction(
  factoryAccount,
  posBuilder.buildApproveTransaction(posAddress, "tx001")
);

await factoryBuilder.sendTransaction(
  factoryAccount,
  posBuilder.buildRejectTransaction(posAddress, "tx002")
);

await factoryBuilder.sendTransaction(
  factoryAccount,
  posBuilder.buildAutoRefund(posAddress, "tx001", FACTORY_ACCOUNT_ADDRESS)
);

await factoryBuilder.sendTransaction(
  factoryAccount,
  posBuilder.buildWithdraw(
    posAddress,
    FACTORY_ACCOUNT_ADDRESS,
    "500",
    tokenAddress
  )
);
```

---

## Summary

- Import account with sncast
- Declare and deploy ThellexPOSFactory
- Initialize factory parameters
- Manage supported tokens
- Deploy POS contracts
- Execute POS lifecycle operations
- Monitor events for all state changes
