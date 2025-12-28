// src/config.ts
import { join } from "path";
import { Account, RpcProvider } from "starknet";

export const NODE_URL = "http://127.0.0.1:5050";

export const FACTORY_PRIVATE_KEY =
  "0x00000000000000000000000000000000763ab0485d272a2649c86d258ff5aa8b";
export const FACTORY_ACCOUNT_ADDRESS =
  "0x02555a3aa5a7d38aee3019e18aa11f9c1e1b3e6e682ffb3c23cbf15e6ede41b5";
export const TREASURY =
  "0x044d1f9511b22a55798ccd71f636b64efcd5afa882d97fc37785e98ef0351edc";

export const CONTRACTS_DIR = join(process.cwd(), "../contracts/target/dev");
export const FACTORY_FILENAME = "pos_Factory.contract_class.json";
export const POS_FILENAME = "pos_Store.contract_class.json";

export const UDC_ADDRESS =
  "0x41A78E741E5AF2FEC34B695679BC6891742439F7AFB8484ECD7766661AD02BF";

export const MERCHANT_ADDRESS =
  "0x044d1f9511b22a55798ccd71f636b64efcd5afa882d97fc37785e98ef0351edc";
export const MERCHANT_PRIVATE_KEY =
  "0x000000000000000000000000000000001326027562583f0bf588457bbd53ecf1";

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
