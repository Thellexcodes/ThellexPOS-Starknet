import {
  BaseBuilderConfigArgs,
  ContractAddress,
  POSConstructorArgs,
  ThellexPOSBuilder,
  ThellexPOSFactoryBuilder,
} from "@thellex/pos-sdk";
import path, { join } from "path";
import { Account, RpcProvider, hash } from "starknet";
import fs from "fs";
import { EventCallbackData } from "@thellex/pos-sdk/dist/types/events";

async function main() {
  // Setup provider and account
  const nodeUrl = "http://127.0.0.1:5050";
  const provider = new RpcProvider({ nodeUrl });

  // Account details
  const FACTORY_PRIVATE_KEY =
    "0x00000000000000000000000000000000ad54905f9361dde207deffc4a2e332d0";
  const FACTORY_ACCOUNT_ADDRESS =
    "0x03a33cdea932bcd7d6a7915223965dd4a379896cb34d443002abf0f8555cf744";

  const factoryAccount = new Account(
    provider,
    FACTORY_ACCOUNT_ADDRESS,
    FACTORY_PRIVATE_KEY
  );

  // Path to compiled contracts
  const CONTRACTS_DIR = join(process.cwd(), "../contracts/target/dev");
  const FACTORY_FILENAME = "thellexpos_ThellexPOSFactory.contract_class.json";
  const POS_FILENAME = "thellexpos_ThellexPOSV1.contract_class.json";

  //  FACTORY_ACCOUNT_ADDRESS, nodeUrl, CONTRACTS_DIR, FACTORY_FILENAME;
  // Initialize the Factory Builder
  const factoryBuilder = new ThellexPOSFactoryBuilder({
    treasuryAddress: FACTORY_ACCOUNT_ADDRESS,
    // @ts-ignore
    nodeUrl,
    contractsPath: CONTRACTS_DIR,
    factoryContractPath: FACTORY_FILENAME,
    udcAddress: "0x",
  });

  // // Full path to the compiled factory contract
  const factoryContractPath = join(CONTRACTS_DIR, FACTORY_FILENAME);
  const posContractPath = join(CONTRACTS_DIR, POS_FILENAME);

  // Parse the compiled factory contract JSON
  const compiledFactoryContract = JSON.parse(
    fs.readFileSync(factoryContractPath, "utf8")
  );

  const compiledPosContract = JSON.parse(
    fs.readFileSync(posContractPath, "utf8")
  );

  // Compute class hash using the file path
  const factoryClassHash = factoryBuilder.computeClassHash(factoryContractPath);
  const posClasHash = factoryBuilder.computeClassHash(posContractPath);

  //deploy contract
  // Declare the factory contract if not already declared
  const declareFactoryResponse = await factoryAccount.declareIfNot({
    contract: compiledFactoryContract,
    compiledClassHash: factoryClassHash,
  });

  const declarePosResponse = await factoryAccount.declareIfNot({
    contract: compiledPosContract,
    compiledClassHash: posClasHash,
  });

  // console.log({ declarePosResponse });

  // console.log({ declareResponse });

  // Deploy the factory contract
  const deployFactoryResponse = await factoryAccount.deployContract({
    classHash: factoryClassHash,
    constructorCalldata: [],
  });

  const posConstructorArgs: POSConstructorArgs = {
    owner: factoryAccount.address,
    deposit_address: FACTORY_ACCOUNT_ADDRESS,
    treasury: "0xabcdefabcdefabcdef...", // replace with actual treasury address
    fee_percent: 500, // example: 5% (in basis points)
    tax_percent: 200, // example: 2% (in basis points)
    timeout: 86400, // example: 24 hours
    factory_address: deployFactoryResponse.contract_address,
  };

  // // Convert u256 fields to Cairo-compatible format (low, high)
  // const feePercentUint256 = uint256.bnToUint256(posConstructorArgs.fee_percent);
  // const taxPercentUint256 = uint256.bnToUint256(posConstructorArgs.tax_percent);

  // Deploy the pos contract

  // Deploy POS contract with constructor calldata
  const deployPosResponse = await factoryAccount.deployContract({
    classHash: posClasHash,
    constructorCalldata: [
      posConstructorArgs.owner,
      posConstructorArgs.deposit_address,
      posConstructorArgs.treasury,
      feePercentUint256.low,
      feePercentUint256.high,
      taxPercentUint256.low,
      taxPercentUint256.high,
      posConstructorArgs.timeout,
      posConstructorArgs.factory_address,
    ],
  });

  // sign with another account
  // const deployCall = await factoryBuilder.buildFactoryDeployment(
  //   FACTORY_FILENAME
  // );

  // // Execute the deployment transaction
  // let deployTxHash;
  // try {
  //   deployTxHash = await factoryBuilder.sendTransaction(
  //     factoryAccount,
  //     deployCall
  //   );
  // } catch (error: any) {
  //   throw new Error(`Failed to deploy contract: ${error.message}`);
  // }

  // initialize factory
  // const initializeedTx = await factoryBuilder.buildInitializeFactoryTransaction(
  //   deployFactoryResponse.contract_address as ContractAddress,
  //   FACTORY_FILENAME,
  //   {
  //     feePercent: 500,
  //     taxPercent: 200,
  //     timeout: 3600,
  //   }
  // );

  // const receipt = await factoryBuilder.sendTransaction(
  //   factoryAccount,
  //   initializeedTx
  // );

  let shouldCancel = true;

  await factoryBuilder.monitorEvents(
    deployFactoryResponse.contract_address,
    ["FactoryInitialized"],
    async (eventData) => {
      console.log("New event:", eventData.event.type, eventData.event.data);
      console.log("Metadata:", eventData.metadata);
    },
    5000,
    factoryContractPath,
    () => shouldCancel
  );

  // console.log({ addr: deployPosResponse.contract_address });

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
