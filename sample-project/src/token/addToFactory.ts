// src/token/addToFactory.ts
import { ThellexPOSFactoryBuilder, ContractAddress } from "@thellex/pos-sdk";
import { Account } from "starknet";

export async function addTokenToFactory(
  tokenAddress: ContractAddress,
  factoryBuilder: ThellexPOSFactoryBuilder,
  factoryAccount: Account,
  factoryAddress: ContractAddress
) {
  console.log(`\nAdding token ${tokenAddress} to POS Factory...`);

  const addTx = factoryBuilder.buildAddSupportedToken(
    factoryAddress,
    tokenAddress,
    "pos_Factory.contract_class.json"
  );

  await factoryBuilder.sendTransaction(factoryAccount, addTx);
  console.log("Token successfully added to factory supported list");

  // Verify
  const isSupported = await factoryBuilder.isSupportedToken(
    factoryAddress,
    tokenAddress,
    "pos_Factory.contract_class.json"
  );
  console.log(`Is supported: ${isSupported}`);
}
