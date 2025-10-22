import {
  BaseBuilderConfigArgs,
  ContractAddress,
  POSConstructorArgs,
  ThellexPOSBuilder,
  ThellexPOSFactoryBuilder,
} from "@thellex/pos-sdk";
import { join } from "path";
import { Account, RpcProvider, hash } from "starknet";
import fs from "fs";

async function main() {
  // --- Setup provider and account ---
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

  // --- Paths to contracts ---
  const CONTRACTS_DIR = join(process.cwd(), "../contracts/target/dev");
  const FACTORY_FILENAME = "thellexpos_ThellexPOSFactory.contract_class.json";
  const POS_FILENAME = "thellexpos_ThellexPOSV1.contract_class.json";

  const factoryContractPath = join(CONTRACTS_DIR, FACTORY_FILENAME);
  const posContractPath = join(CONTRACTS_DIR, POS_FILENAME);

  const compiledFactoryContract = JSON.parse(
    fs.readFileSync(factoryContractPath, "utf8")
  );
  const compiledPosContract = JSON.parse(
    fs.readFileSync(posContractPath, "utf8")
  );

  const factoryBuilder = new ThellexPOSFactoryBuilder({
    treasuryAddress: FACTORY_ACCOUNT_ADDRESS,
    nodeUrl,
    contractsPath: CONTRACTS_DIR,
    factoryContractPath: FACTORY_FILENAME,
    udcAddress: "0x",
  });

  const factoryClassHash = factoryBuilder.computeClassHash(factoryContractPath);
  const posClassHash = factoryBuilder.computeClassHash(posContractPath);

  // --- Declare contracts if not already declared ---
  await factoryAccount.declareIfNot({
    contract: compiledFactoryContract,
    compiledClassHash: factoryClassHash,
  });
  await factoryAccount.declareIfNot({
    contract: compiledPosContract,
    compiledClassHash: posClassHash,
  });

  // --- Deploy factory contract ---
  const deployFactoryResponse = await factoryAccount.deployContract({
    classHash: factoryClassHash,
    constructorCalldata: [],
  });

  // --- Initialize factory ---
  const initTx = await factoryBuilder.buildInitializeFactoryTransaction(
    deployFactoryResponse.contract_address as ContractAddress,
    FACTORY_FILENAME,
    { feePercent: 500, taxPercent: 200, timeout: 3600 }
  );
  const initReceipt = await factoryBuilder.sendTransaction(
    factoryAccount,
    initTx
  );

  // --- Create a POS instance ---
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

  // --- Get deployed POS address from events ---
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

  console.log("Deployed POS address:", posAddress);

  // --- Example: Add supported token ---
  // Use an ERC20 or mock token address
  const tokenAddress = "0x1111111111111111111111111111111111111111";
  const addTokenTx = factoryBuilder.buildAddSupportedToken(
    posArgs.factory_address,
    tokenAddress,
    FACTORY_FILENAME
  );
  const addSupportedTokenTx = await factoryBuilder.sendTransaction(
    factoryAccount,
    addTokenTx
  );
  console.log({ addSupportedTokenTx });

  // // --- Example: Remove supported token ---
  // const removeTokenTx = factoryBuilder.buildRemoveSupportedToken(
  //   posArgs.factory_address,
  //   tokenAddress,
  //   FACTORY_FILENAME
  // );
  // await factoryBuilder.sendTransaction(factoryAccount, removeTokenTx);

  // // --- Example: Update factory parameters ---
  // const updateTreasuryTx = factoryBuilder.buildUpdateTreasury(
  //   posArgs.factory_address,
  //   "0x2222222222222222222222222222222222222222",
  //   FACTORY_FILENAME
  // );
  // await factoryBuilder.sendTransaction(factoryAccount, updateTreasuryTx);

  // const updateFeeTx = factoryBuilder.buildUpdateFeePercent(
  //   posArgs.factory_address,
  //   700,
  //   FACTORY_FILENAME
  // );
  // await factoryBuilder.sendTransaction(factoryAccount, updateFeeTx);

  // const updateTaxTx = factoryBuilder.buildUpdateTaxPercent(
  //   posArgs.factory_address,
  //   300,
  //   FACTORY_FILENAME
  // );
  // await factoryBuilder.sendTransaction(factoryAccount, updateTaxTx);

  // const updateTimeoutTx = factoryBuilder.buildUpdateTimeout(
  //   posArgs.factory_address,
  //   7200,
  //   FACTORY_FILENAME
  // );
  // await factoryBuilder.sendTransaction(factoryAccount, updateTimeoutTx);

  // const setPausedTx = factoryBuilder.buildSetPaused(
  //   posArgs.factory_address,
  //   true,
  //   FACTORY_FILENAME
  // );
  // await factoryBuilder.sendTransaction(factoryAccount, setPausedTx);

  // // --- Example: Query current factory state ---
  // const treasury = await factoryBuilder.getTreasury(
  //   posArgs.factory_address,
  //   FACTORY_FILENAME
  // );
  // const feePercent = await factoryBuilder.getFeePercent(
  //   posArgs.factory_address,
  //   FACTORY_FILENAME
  // );
  // const taxPercent = await factoryBuilder.getTaxPercent(
  //   posArgs.factory_address,
  //   FACTORY_FILENAME
  // );
  // const timeout = await factoryBuilder.getTimeout(
  //   posArgs.factory_address,
  //   FACTORY_FILENAME
  // );
  // const isSupported = await factoryBuilder.isSupportedToken(
  //   posArgs.factory_address,
  //   tokenAddress,
  //   FACTORY_FILENAME
  // );

  // console.log({ treasury, feePercent, taxPercent, timeout, isSupported });

  // //create POS
  // const posAddress = factoryBuilder.buildCreatePOS(
  //   deployPosResponse.contract_address as ContractAddress,
  //   FACTORY_FILENAME,
  //   FACTORY_ACCOUNT_ADDRESS,
  //   posClasHash
  // );

  // const posBuilder = new ThellexPOSBuilder(factoryBuilder);
  // const initializeTx = await posBuilder.initializePOSContract();
}

main().catch(console.error);
