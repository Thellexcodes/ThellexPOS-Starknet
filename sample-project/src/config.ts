// src/config.ts
import { ContractAddress } from "@thellex/pos-sdk";
import { join } from "path";
import { Account, RpcProvider } from "starknet";

export const NODE_URL = "http://127.0.0.1:5050";

export const CONTRACTS_DIR = join(process.cwd(), "../contracts/target/dev");
export const FACTORY_FILENAME = "pos_Factory.contract_class.json";
export const POS_FILENAME = "pos_Store.contract_class.json";

export const UDC_ADDRESS =
  "0x41A78E741E5AF2FEC34B695679BC6891742439F7AFB8484ECD7766661AD02BF";

export const FACTORY_PRIVATE_KEY =
  "0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9";
export const FACTORY_ACCOUNT_ADDRESS =
  "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691";

export const MERCHANT_ADDRESS =
  "0x078662e7352d062084b0010068b99288486c2d8b914f6e2a55ce945f8792c8b1";
export const MERCHANT_PRIVATE_KEY =
  "0x000000000000000000000000000000000e1406455b7d66b1690803be066cbe5e";

export const CUSTOMER_ADDRESS =
  "0x049dfb8ce986e21d354ac93ea65e6a11f639c1934ea253e5ff14ca62eca0f38e";
export const CUSTOMER_PRIVATE_KEY =
  "0x00000000000000000000000000000000a20a02f0ac53692d144b20cb371a60d7";

export const FACTORY_ADDRESS =
  "0x789067540ff1ab65991b3746f0710eeedfca6cc7e24a893358fcef8d74f8946";

const provider = new RpcProvider({ nodeUrl: NODE_URL });

export const factoryAccount = new Account(
  provider,
  FACTORY_ACCOUNT_ADDRESS,
  FACTORY_PRIVATE_KEY
);

export const merchantAccount = new Account(
  provider,
  MERCHANT_ADDRESS,
  MERCHANT_PRIVATE_KEY
);

export const cashierAccount = new Account(
  provider,
  MERCHANT_ADDRESS,
  MERCHANT_PRIVATE_KEY
);

export const customerAccount = new Account(
  provider,
  CUSTOMER_ADDRESS,
  CUSTOMER_PRIVATE_KEY
);

export const TREASURY = customerAccount.address as ContractAddress;
