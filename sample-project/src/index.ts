import { ContractAddress, ThellexPOSFactoryBuilder } from "@thellex/pos-sdk";
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
    "0x000000000000000000000000000000003c60270280e85849443bfb111e6d5f88";
  const FACTORY_ACCOUNT_ADDRESS =
    "0x0743f3d517e33d4ef62e41b025bc121ea219656bdf80df92ff26dec740f0f69f";

  // Predeployed UDC
  // Address: 0x41A78E741E5AF2FEC34B695679BC6891742439F7AFB8484ECD7766661AD02BF
  // Class Hash: 0x7B3E

  const factoryAccount = new Account(
    provider,
    FACTORY_ACCOUNT_ADDRESS,
    FACTORY_PRIVATE_KEY
  );

  // Path to compiled contracts
  const CONTRACTS_DIR = join(process.cwd(), "../contracts/target/dev");
  const FACTORY_FILENAME = "thellexpos_ThellexPOSFactory.contract_class.json";

  //  FACTORY_ACCOUNT_ADDRESS, nodeUrl, CONTRACTS_DIR, FACTORY_FILENAME;
  // Initialize the Factory Builder
  const factoryBuilder = new ThellexPOSFactoryBuilder({
    treasuryAddress: FACTORY_ACCOUNT_ADDRESS,
    nodeUrl,
    contractsPath: CONTRACTS_DIR,
    factoryContractPath: FACTORY_FILENAME,
    udcAddress: "0x",
  });

  // // Full path to the compiled factory contract
  const factoryContractPath = join(CONTRACTS_DIR, FACTORY_FILENAME);

  // Parse the compiled factory contract JSON
  const compiledFactoryContract = JSON.parse(
    fs.readFileSync(factoryContractPath, "utf8")
  );

  // Compute class hash using the file path
  const factoryClassHash = factoryBuilder.computeClassHash(factoryContractPath);

  //deploy contract
  // Declare the factory contract if not already declared
  const declareResponse = await factoryAccount.declareIfNot({
    contract: compiledFactoryContract,
    compiledClassHash: factoryClassHash,
  });

  // Deploy the factory contract

  //const deployResponse = await factoryAccount.deployContract({
  //   classHash: factoryClassHash,
  //   constructorCalldata: [],
  // });

  // console.log({ deployResponse });

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
  //   "0x6ca112f6ee51d5d6fbd567d8a9dad0f9567bb82eb7eaa75ec8c68a69ba37942" as ContractAddress,
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

  let shouldCancel = false;

  await factoryBuilder.monitorEvents(
    "0x6ca112f6ee51d5d6fbd567d8a9dad0f9567bb82eb7eaa75ec8c68a69ba37942",
    ["FactoryInitialized"],
    async (eventData) => {
      console.log("New event:", eventData.event.type, eventData.event.data);
      console.log("Metadata:", eventData.metadata);
    },
    5000,
    factoryContractPath,
    () => shouldCancel
  );
}

main().catch(console.error);
