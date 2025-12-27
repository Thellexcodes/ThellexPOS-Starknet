// src/createPOS.ts
import {
  FactoryBuilder,
  ContractAddress,
  POSConstructorArgs,
  POSType,
} from "@thellex/pos-sdk";
import { Account } from "starknet";
import { FACTORY_ACCOUNT_ADDRESS } from "./config";
import { join } from "path";
import { CONTRACTS_DIR, FACTORY_FILENAME } from "./config";
import { dump } from "./utils/dump";

export async function createPOSInstance(
  factoryAddress: ContractAddress,
  factoryBuilder: FactoryBuilder,
  factoryAccount: Account,
  account: Account,
  storeClassHash: string,
  type: POSType
): Promise<ContractAddress | any> {
  console.log("\n🏗️ Creating new POS instance...");

  const posArgs: POSConstructorArgs = {
    owner: FACTORY_ACCOUNT_ADDRESS,
    treasury: FACTORY_ACCOUNT_ADDRESS,
    fee_percent: 500,
    tax_percent: 200,
    timeout: 86400,
    factory_address: factoryAddress,
  };

  const createPosTx = await factoryBuilder.buildCreatePOS(
    `${CONTRACTS_DIR}${FACTORY_FILENAME}`,
    posArgs.factory_address,
    {
      type,
      merchant: account.address as ContractAddress,
      storeName: "Thellex",
    }
  );

  const storePosReceipt = await factoryAccount.execute(createPosTx);
  await factoryAccount.waitForTransaction(storePosReceipt.transaction_hash);

  dump({ storePosReceipt });

  const posAddress = await new Promise<ContractAddress>((resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) reject(new Error("Timeout: No POS created in 60s"));
    }, 60000);

    factoryBuilder.monitorEvents(
      factoryAddress,
      ["StorePOSCreated"],
      async (eventData) => {
        if (resolved) return;
        dump({ eventData });

        // const posAddr = eventData.event.data.pos_address as string;
        // console.log(`POS Created: ${shortenAddress(posAddr)}`);

        resolved = true;
        clearTimeout(timeout);
        // resolve(posAddr as ContractAddress);
        resolve("" as any);
      },
      3000, // Check every 3s — perfect balance
      "pos_Factory.contract_class.json",
      () => resolved
    );
  });
}
