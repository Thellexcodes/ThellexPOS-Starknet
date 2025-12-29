// src/createPOS.ts
import {
  FactoryBuilder,
  ContractAddress,
  POSConstructorArgs,
  POSType,
} from "@thellex/pos-sdk";
import { Account, Call } from "starknet";
import { FACTORY_ACCOUNT_ADDRESS, merchantAccount } from "./config";
import { join } from "path";
import { CONTRACTS_DIR, FACTORY_FILENAME } from "./config";
import { dump } from "./utils/dump";

export async function createPOSInstance(
  factoryAddress: ContractAddress,
  factoryBuilder: FactoryBuilder,
  type: POSType = "store"
): Promise<ContractAddress> {
  console.log("\n🏗️ Creating new POS instance...");

  const posArgs: POSConstructorArgs = {
    owner: merchantAccount.address as ContractAddress,
    treasury: FACTORY_ACCOUNT_ADDRESS,
    fee_percent: 500,
    tax_percent: 200,
    timeout: 86400,
    factory_address: factoryAddress,
  };

  // -------------------- Build tx --------------------
  const createPosTx = factoryBuilder.buildCreatePOS({
    factoryAddress: posArgs.factory_address,
    type,
    merchant: merchantAccount.address as ContractAddress,
    storeName: "Thellex Store",
  });

  // -------------------- Execute tx --------------------
  const receipt = await merchantAccount.execute(createPosTx);
  console.log(`POS creation tx sent: ${receipt.transaction_hash}`);

  await merchantAccount.waitForTransaction(receipt.transaction_hash);
  console.log("POS creation transaction ACCEPTED_ON_L2");

  // -------------------- Wait for event --------------------
  console.log("Waiting for StorePOSCreated / PersonalPOSCreated event...");

  return new Promise<ContractAddress>(async (resolve, reject) => {
    let resolved = false;

    try {
      await factoryBuilder.monitorEvents({
        contractAddress: factoryAddress,
        eventNames: ["StorePOSCreated", "PersonalPOSCreated"],
        abiFilePath: "pos_Factory.contract_class.json",
        cancelToken: () => resolved,
        callback: async (eventData) => {
          const event = eventData.event;

          if (
            event.type === "StorePOSCreated" ||
            event.type === "PersonalPOSCreated"
          ) {
            const posAddress = event.data.pos_address as ContractAddress;

            console.log("✅ POS successfully created!");
            console.log(`   Type: ${event.type}`);
            console.log(`   Address: ${posAddress}`);
            console.log(`   Tx Hash: ${eventData.metadata.transactionHash}`);

            resolved = true;
            resolve(posAddress);
          }
        },
      });
    } catch (err) {
      reject(err);
    }
  });
}
