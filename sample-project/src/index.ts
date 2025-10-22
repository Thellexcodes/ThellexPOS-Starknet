import {
  BaseBuilderConfigArgs,
  ContractAddress,
  POSConstructorArgs,
  ThellexPOSBuilder,
  ThellexPOSFactoryBuilder,
} from "@thellex/pos-sdk";
import { join } from "path";
import { Account, RpcProvider } from "starknet";
import fs from "fs";

async function main() {
  // ============================================================
  // 🧠 SETUP SECTION
  // ------------------------------------------------------------
  // This section initializes the provider, account, and contract paths.
  // ============================================================

  const nodeUrl = "http://127.0.0.1:5050";
  const provider = new RpcProvider({ nodeUrl });

  const FACTORY_PRIVATE_KEY =
    "0x00000000000000000000000000000000ad54905f9361dde207deffc4a2e332d0";
  const FACTORY_ACCOUNT_ADDRESS =
    "0x03a33cdea932bcd7d6a7915223965dd4a379896cb34d443002abf0f8555cf744";

  const factoryAccount = new Account(
    provider,
    FACTORY_ACCOUNT_ADDRESS,
    FACTORY_PRIVATE_KEY
  );

  // Contract compilation directories
  const CONTRACTS_DIR = join(process.cwd(), "../contracts/target/dev");
  const FACTORY_FILENAME = "thellexpos_ThellexPOSFactory.contract_class.json";
  const POS_FILENAME = "thellexpos_ThellexPOSV1.contract_class.json";

  const factoryContractPath = join(CONTRACTS_DIR, FACTORY_FILENAME);
  const posContractPath = join(CONTRACTS_DIR, POS_FILENAME);

  // Read compiled contract files
  const compiledFactoryContract = JSON.parse(
    fs.readFileSync(factoryContractPath, "utf8")
  );
  const compiledPosContract = JSON.parse(
    fs.readFileSync(posContractPath, "utf8")
  );

  // ============================================================
  // 🏗️ FACTORY DEPLOYMENT & INITIALIZATION
  // ------------------------------------------------------------
  // Deploys the ThellexPOSFactory contract and initializes it with
  // default parameters such as fee, tax, and timeout.
  // ============================================================

  const factoryBuilder = new ThellexPOSFactoryBuilder({
    treasuryAddress: FACTORY_ACCOUNT_ADDRESS,
    nodeUrl,
    contractsPath: CONTRACTS_DIR,
    factoryContractPath: FACTORY_FILENAME,
    udcAddress: "0x",
  });

  const factoryClassHash = factoryBuilder.computeClassHash(factoryContractPath);
  const posClassHash = factoryBuilder.computeClassHash(posContractPath);

  // Declare contracts if not already declared
  await factoryAccount.declareIfNot({
    contract: compiledFactoryContract,
    compiledClassHash: factoryClassHash,
  });
  await factoryAccount.declareIfNot({
    contract: compiledPosContract,
    compiledClassHash: posClassHash,
  });

  // Deploy the factory contract
  const deployFactoryResponse = await factoryAccount.deployContract({
    classHash: factoryClassHash,
    constructorCalldata: [],
  });

  // Initialize the factory contract
  const initTx = await factoryBuilder.buildInitializeFactoryTransaction(
    deployFactoryResponse.contract_address as ContractAddress,
    FACTORY_FILENAME,
    { feePercent: 500, taxPercent: 200, timeout: 3600 }
  );
  await factoryBuilder.sendTransaction(factoryAccount, initTx);

  console.log("✅ Factory deployed and initialized:", {
    address: deployFactoryResponse.contract_address,
  });

  // ============================================================
  // ⚙️ FACTORY MANAGEMENT FUNCTIONS
  // ------------------------------------------------------------
  // Demonstrates factory-level administrative operations such as
  // adding/removing supported tokens and updating parameters.
  // ============================================================

  const tokenAddress = "0x1111111111111111111111111111111111111111";

  // Add supported token
  const addTokenTx = factoryBuilder.buildAddSupportedToken(
    deployFactoryResponse.contract_address as ContractAddress,
    tokenAddress,
    FACTORY_FILENAME
  );
  await factoryBuilder.sendTransaction(factoryAccount, addTokenTx);

  // Remove supported token
  const removeTokenTx = factoryBuilder.buildRemoveSupportedToken(
    deployFactoryResponse.contract_address as ContractAddress,
    tokenAddress,
    FACTORY_FILENAME
  );
  await factoryBuilder.sendTransaction(factoryAccount, removeTokenTx);

  // Update treasury address
  const updateTreasuryTx = factoryBuilder.buildUpdateTreasury(
    deployFactoryResponse.contract_address as ContractAddress,
    "0x2222222222222222222222222222222222222222",
    FACTORY_FILENAME
  );
  await factoryBuilder.sendTransaction(factoryAccount, updateTreasuryTx);

  // Update fee percent
  const updateFeeTx = factoryBuilder.buildUpdateFeePercent(
    deployFactoryResponse.contract_address as ContractAddress,
    700,
    FACTORY_FILENAME
  );
  await factoryBuilder.sendTransaction(factoryAccount, updateFeeTx);

  // Update tax percent
  const updateTaxTx = factoryBuilder.buildUpdateTaxPercent(
    deployFactoryResponse.contract_address as ContractAddress,
    300,
    FACTORY_FILENAME
  );
  await factoryBuilder.sendTransaction(factoryAccount, updateTaxTx);

  // Update timeout
  const updateTimeoutTx = factoryBuilder.buildUpdateTimeout(
    deployFactoryResponse.contract_address as ContractAddress,
    7200,
    FACTORY_FILENAME
  );
  await factoryBuilder.sendTransaction(factoryAccount, updateTimeoutTx);

  // // Pause the factory
  // const setPausedTx = factoryBuilder.buildSetPaused(
  //   deployFactoryResponse.contract_address as ContractAddress,
  //   true,
  //   FACTORY_FILENAME
  // );
  // await factoryBuilder.sendTransaction(factoryAccount, setPausedTx);

  // Query factory state
  const treasury = await factoryBuilder.getTreasury(
    deployFactoryResponse.contract_address as ContractAddress,
    FACTORY_FILENAME
  );
  const feePercent = await factoryBuilder.getFeePercent(
    deployFactoryResponse.contract_address as ContractAddress,
    FACTORY_FILENAME
  );
  const taxPercent = await factoryBuilder.getTaxPercent(
    deployFactoryResponse.contract_address as ContractAddress,
    FACTORY_FILENAME
  );
  const timeout = await factoryBuilder.getTimeout(
    deployFactoryResponse.contract_address as ContractAddress,
    FACTORY_FILENAME
  );
  const isSupported = await factoryBuilder.isSupportedToken(
    deployFactoryResponse.contract_address as ContractAddress,
    tokenAddress,
    FACTORY_FILENAME
  );

  console.log("🏭 Factory parameters updated:", {
    treasury,
    feePercent,
    taxPercent,
    timeout,
    isSupported,
  });

  // ============================================================
  // 💳 POS CREATION & MONITORING
  // ------------------------------------------------------------
  // Creates a POS instance via the factory, listens for the
  // POSCreated event, and logs the deployed POS address.
  // ============================================================

  const posArgs: POSConstructorArgs = {
    owner: FACTORY_ACCOUNT_ADDRESS,
    treasury: FACTORY_ACCOUNT_ADDRESS,
    fee_percent: 500,
    tax_percent: 200,
    timeout: 86400,
    factory_address: deployFactoryResponse.contract_address as ContractAddress,
  };

  const createPosTx = await factoryBuilder.buildCreatePOS(
    FACTORY_FILENAME,
    posArgs.factory_address as ContractAddress,
    posArgs.owner,
    posClassHash
  );

  const posTxReceipt = await factoryAccount.execute(createPosTx);
  await factoryAccount.waitForTransaction(posTxReceipt.transaction_hash);

  // Wait for the POSCreated event
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
      1000,
      factoryContractPath,
      () => shouldCancel
    );
  });

  console.log("Deployed POS Address:", posAddress);
}

main().catch(console.error);
