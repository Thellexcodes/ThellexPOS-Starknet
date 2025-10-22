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

# Contract Declaration

Declare the ThellexPOSFactory and POSV1 contract on the devnet profile:

```bash
sncast --profile=devnet declare \
 --contract-name=ThellexPOSFactory

sncast --profile=devnet declare \
 --contract-name=ThellexPOSV1
```

# Setup & Deployment (JS/TS)

### Dependencies

```bash
yarn add @thellex/pos-sdk starknet
```

### Setup Provider & Account

```bash
import { Account, RpcProvider } from "starknet";

const nodeUrl = "http://127.0.0.1:5050";
const provider = new RpcProvider({ nodeUrl });

const PRIVATE_KEY = "0x00000000000000000000000000000000...";
const ACCOUNT_ADDRESS = "0x03a33cdea932bcd7d6a7915223965dd4a379896cb34d443002abf0f8555cf744";

const factoryAccount = new Account(provider, ACCOUNT_ADDRESS, FACTORY_PRIVATE_KEY);
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

// Deploy and initialize factory
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

### Factory Management Functions

- Add supported token

- Remove supported token

- Update treasury, fee, tax, and timeout

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

### POS Creation & Monitoring

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

// Wait for POSCreated event
const posAddress = (await new Promise())<string>((resolve) => {
  let shouldCancel = false;
  factoryBuilder.monitorEvents(
    deployFactoryResponse.contract_address,
    ["POSCreated"],
    (eventData) => {
      resolve(eventData.event.data.pos_address);
      shouldCancel = true;
    },
    1000,
    factoryContractPath,
    () => shouldCancel
  );
});

console.log("Deployed POS Address:", posAddress);
```

### POS Operations

- Deposit

- Approve transaction

- Reject transaction

- Auto refund

- Withdraw funds

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

## 5. POS Creation & Event Monitoring

After deploying the factory, you can create a POS instance and listen for the **POSCreated** event to retrieve the deployed POS address.

```ts
const posArgs: POSConstructorArgs = {
  owner: FACTORY_ACCOUNT_ADDRESS,
  treasury: FACTORY_ACCOUNT_ADDRESS,
  fee_percent: 500,
  tax_percent: 200,
  timeout: 86400,
  factory_address: deployFactoryResponse.contract_address as ContractAddress,
};

// Create POS via the factory
const createPosTx = await factoryBuilder.buildCreatePOS(
  FACTORY_FILENAME,
  posArgs.factory_address as ContractAddress,
  posArgs.owner,
  posClassHash
);

const posTxReceipt = await factoryAccount.execute(createPosTx);
await factoryAccount.waitForTransaction(posTxReceipt.transaction_hash);

// Monitor POSCreated event to get the new POS address
const posAddress = await new Promise<string>((resolve) => {
  let shouldCancel = false;
  factoryBuilder.monitorEvents(
    deployFactoryResponse.contract_address,
    ["POSCreated"],
    async (eventData: any) => {
      const pos_address = eventData.event.data.pos_address;
      shouldCancel = true;
      resolve(pos_address);
    },
    1000, // polling interval in ms
    factoryContractPath,
    () => shouldCancel
  );
});

console.log("Deployed POS Address:", posAddress);
```

### POS OPERATIONS

```ts
const posBuilder = new ThellexPOSBuilder(factoryBuilder);

// Deposit funds into the POS
await factoryBuilder.sendTransaction(
  factoryAccount,
  posBuilder.buildDeposit(posAddress, "1000", "tx001", tokenAddress)
);

// Approve a specific transaction
await factoryBuilder.sendTransaction(
  factoryAccount,
  posBuilder.buildApproveTransaction(posAddress, "tx001")
);

// Reject a specific transaction
await factoryBuilder.sendTransaction(
  factoryAccount,
  posBuilder.buildRejectTransaction(posAddress, "tx002")
);

// Process auto refund for a transaction
await factoryBuilder.sendTransaction(
  factoryAccount,
  posBuilder.buildAutoRefund(posAddress, "tx001", FACTORY_ACCOUNT_ADDRESS)
);

// Withdraw funds from the POS
await factoryBuilder.sendTransaction(
  factoryAccount,
  posBuilder.buildWithdraw(
    posAddress,
    FACTORY_ACCOUNT_ADDRESS,
    "500",
    tokenAddress
  )
);

// Retrieve deposit details by transaction ID
const deposit = await posBuilder.getDeposit(posAddress, "tx001");
console.log("Deposit details:", deposit);

// Get the POS token balance
const balance = await posBuilder.getPOSBalance(posAddress, tokenAddress);
console.log("POS balance:", balance);

// Get the owner of the POS contract
const owner = await posBuilder.getOwner(posAddress);
console.log("POS owner:", owner);

// Get the treasury address used by the POS
const treasury = await posBuilder.getTreasury(posAddress);
console.log("POS treasury:", treasury);

// Check if a token is supported by the POS
const isSupported = await posBuilder.isSupportedToken(posAddress, tokenAddress);
console.log("Is token supported:", isSupported);
```

### Summary

- Import account with sncast.

- Declare ThellexPOSFactory contract.

- Deploy and initialize factory with treasury, fee, tax, and timeout.

- Manage supported tokens and parameters.

- Deploy POS instances via the factory.

- Perform POS operations: deposit, approve, reject, refund, withdraw.

- Listen to events to track all important actions on both Factory and POS.
