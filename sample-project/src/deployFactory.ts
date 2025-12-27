// src/deployFactory.ts
import { RpcProvider, Account } from "starknet";
import fs from "fs";
import { join } from "path";
import { FactoryBuilder, ContractAddress } from "@thellex/pos-sdk";
import {
  NODE_URL,
  FACTORY_PRIVATE_KEY,
  FACTORY_ACCOUNT_ADDRESS,
  TREASURY,
  CONTRACTS_DIR,
  FACTORY_FILENAME,
  POS_FILENAME,
  UDC_ADDRESS,
} from "./config";
import { dump } from "./utils/dump";

export async function deployAndInitializeFactory() {
  const provider = new RpcProvider({ nodeUrl: NODE_URL });
  const factoryAccount = new Account(
    provider,
    FACTORY_ACCOUNT_ADDRESS,
    FACTORY_PRIVATE_KEY
  );

  const factoryContractPath = join(CONTRACTS_DIR, FACTORY_FILENAME);
  const storeContractPath = join(CONTRACTS_DIR, POS_FILENAME);

  const compiledFactory = JSON.parse(
    fs.readFileSync(factoryContractPath, "utf8")
  );
  const compiledPos = JSON.parse(fs.readFileSync(storeContractPath, "utf8"));

  const factoryBuilder = new FactoryBuilder({
    treasuryAddress: FACTORY_ACCOUNT_ADDRESS,
    nodeUrl: NODE_URL,
    contractsPath: CONTRACTS_DIR,
    factoryContractPath: FACTORY_FILENAME,
    udcAddress: UDC_ADDRESS,
  });

  const factoryClassHash = factoryBuilder.computeClassHash(factoryContractPath);
  const storeClassHash = factoryBuilder.computeClassHash(storeContractPath);

  dump({ factoryClassHash, storeClassHash });

  // Declare if needed
  await factoryAccount.declareIfNot({
    contract: compiledFactory,
    compiledClassHash: factoryClassHash,
  });
  await factoryAccount.declareIfNot({
    contract: compiledPos,
    compiledClassHash: storeClassHash,
  });

  // Deploy factory
  // const deployResponse = await factoryAccount.deployContract({
  //   classHash: factoryClassHash,
  //   constructorCalldata: [storeClassHash],
  // });

  // await factoryAccount.waitForTransaction(deployResponse.transaction_hash);

  // // Initialize
  // const initTx = await factoryBuilder.buildInitializeFactoryTransaction(
  //   deployResponse.contract_address as ContractAddress,
  //   FACTORY_FILENAME,
  //   {
  //     treasury: TREASURY,
  //     feePercent: 500,
  //     taxPercent: 200,
  //     timeout: 3600,
  //     minWithdrawalLimit: 500,
  //   }
  // );

  // await factoryBuilder.sendTransaction(factoryAccount, initTx);

  // console.log("✅ Factory deployed and initialized:");
  // console.log(`   Address: ${deployResponse.contract_address}`);
  // console.log(`   Tx Hash: ${deployResponse.transaction_hash}`);

  return {
    // factoryAddress: deployResponse.contract_address as ContractAddress,
    factoryBuilder,
    factoryAccount,
    storeClassHash,
  };
}
