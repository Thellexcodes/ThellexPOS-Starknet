// src/deployFactory.ts
import { RpcProvider, Account } from "starknet";
import fs from "fs";
import { join } from "path";
import {
  FactoryBuilder,
  ContractAddress,
  StoreBuilder,
  Executor,
} from "@thellex/pos-sdk";
import {
  NODE_URL,
  FACTORY_PRIVATE_KEY,
  FACTORY_ACCOUNT_ADDRESS,
  CONTRACTS_DIR,
  FACTORY_FILENAME,
  POS_FILENAME,
  UDC_ADDRESS,
  TREASURY,
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

  const storeBuilder = new StoreBuilder(factoryBuilder);
  // Backend (trusted executor owner)
  const executor = new Executor(factoryBuilder, "0x...");

  const factoryClassHash = factoryBuilder.computeClassHash(factoryContractPath);
  const storeClassHash = factoryBuilder.computeClassHash(storeContractPath);

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
  const deployResponse = await factoryAccount.deployContract({
    classHash: factoryClassHash,
    constructorCalldata: [storeClassHash],
  });

  await factoryAccount.waitForTransaction(deployResponse.transaction_hash);

  // Initialize
  const initTx = factoryBuilder.buildInitializeFactory(
    deployResponse.contract_address as ContractAddress,
    {
      treasury: TREASURY,
      feePercent: 500,
      taxPercent: 200,
      timeout: 3600,
      minWithdrawalLimit: 500,
    }
  );

  await factoryBuilder.sendTransaction(factoryAccount, initTx);

  console.log("✅ Factory deployed and initialized:");
  console.log(`   Address: ${deployResponse.contract_address}`);
  console.log(`   Tx Hash: ${deployResponse.transaction_hash}`);

  return {
    // factoryAddress: deployResponse.contract_address as ContractAddress,
    factoryBuilder,
    storeBuilder,
    factoryAccount,
    storeClassHash,
    executor,
  };
}

// {
//   block: {
//     status: 'ACCEPTED_ON_L2',
//     block_hash: '0x2e8d4b427a1c4e7f172dab09c617effcfb37cdf0a6fc781551f430a5d1e1cfa',
//     parent_hash: '0x4dd4ce944232441173e640e208daa89cdbca485bb4a66f6e5e406ad0b872943',
//     block_number: 140,
//     sequencer_address: '0x1000',
//     new_root: '0x0',
//     timestamp: 1767103144,
//     starknet_version: '0.13.6',
//     l1_gas_price: { price_in_fri: '0x3b9aca00', price_in_wei: '0x3b9aca00' },
//     l2_gas_price: { price_in_fri: '0x3b9aca00', price_in_wei: '0x3b9aca00' },
//     l1_data_gas_price: { price_in_fri: '0x3b9aca00', price_in_wei: '0x3b9aca00' },
//     l1_da_mode: 'BLOB',
//     transactions: [
//       {
//         transaction_hash: '0x649510cc7c8d062de9bf196226ae1a26e2c7e5e6886f41e9ab6de5557af2d78',
//         type: 'INVOKE',
//         version: '0x3',
//         signature: [
//           '0xe3f9dc449579fdc10e24a024da959c6cbe0d47dbaf5d7001db1c366e500539',
//           '0x7adb68a4f7009adfdc3b1686666c69cc6efd7a1a10f8c044fc3aa43236f5085'
//         ],
//         nonce: '0x7e',
//         resource_bounds: {
//           l1_gas: { max_amount: '0x0', max_price_per_unit: '0x59682f00' },
//           l1_data_gas: { max_amount: '0x1e0', max_price_per_unit: '0x59682f00' },
//           l2_gas: { max_amount: '0x15e640', max_price_per_unit: '0x59682f00' }
//         },
//         tip: '0x0',
//         paymaster_data: [],
//         nonce_data_availability_mode: 'L1',
//         fee_data_availability_mode: 'L1',
//         account_deployment_data: [],
//         sender_address: '0x13d6c1103f94f045f993f3f5480af9921e52a34662adc4960ca1edd726741b6',
//         calldata: [
//           '0x1',
//           '0x39681dc61b620093641fb0313d519053a3112c235b8396cb194d22364fd6771',
//           '0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e',
//           '0x3',
//           '0x38068eba682b7820670f851057e64085eb80a29b6946a58265a410af93bcf9f',
//           '0xf',
//           '0x0'
//         ]
//       }
//     ]
//   }
// }
// ─────────
