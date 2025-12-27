// src/token/deployERC20.ts
import { RpcProvider, Account, Contract, uint256, CallData } from "starknet";
import fs from "fs";
import { join } from "path";
import {
  NODE_URL,
  FACTORY_ACCOUNT_ADDRESS,
  FACTORY_PRIVATE_KEY,
  CONTRACTS_DIR,
} from "../config";
import { dump } from "../utils/dump";

const ERC20_FILENAME = "pos_ERC20.contract_class.json"; // Your compiled ERC20 file

export interface DeployedToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

export type DeployError = {
  error: string;
};

export type DeployERC20Result = DeployedToken | DeployError;

export async function deployERC20(
  name: string,
  symbol: string,
  initialSupply: string = "1000000000000000000000", // 1000 tokens with 18 decimals
  decimals: number = 18
): Promise<DeployERC20Result> {
  console.log(`\nDeploying ERC20: ${name} (${symbol})`);

  const provider = new RpcProvider({ nodeUrl: NODE_URL });
  const account = new Account(
    provider,
    FACTORY_ACCOUNT_ADDRESS,
    FACTORY_PRIVATE_KEY
  );

  try {
    const compiledPath = join(CONTRACTS_DIR, ERC20_FILENAME);
    const compiledContract = JSON.parse(fs.readFileSync(compiledPath, "utf8"));

    const classHash =
      "0x05ccacfef4a28b6d8ddd82a3dd161349337bc78371e08f13cc2d17c82c186d1e";

    // Declare if not already declared
    await account.declareIfNot({
      contract: compiledContract,
      compiledClassHash: classHash,
    });

    const { low, high } = uint256.bnToUint256(initialSupply);

    // ABI-safe calldata compilation (handles ByteArray correctly)
    const callData = new CallData(compiledContract.abi);
    const constructorCalldata = callData.compile("constructor", [
      name,
      symbol,
      decimals,
      low,
      high,
      account.address,
    ]);

    const deployResponse = await account.deployContract({
      classHash,
      constructorCalldata,
    });

    await account.waitForTransaction(deployResponse.transaction_hash);

    console.log(`ERC20 deployed at: ${deployResponse.contract_address}`);
    console.log(`Tx: ${deployResponse.transaction_hash}`);

    return {
      address: deployResponse.contract_address!,
      name,
      symbol,
      decimals,
    };
  } catch (err: any) {
    console.error("ERC20 deployment failed");

    // Starknet RPC errors usually hide useful info deep inside
    if (err?.baseError?.data) {
      console.error(JSON.stringify(err.baseError.data, null, 2));
    } else {
      console.error(err);
    }

    return {
      error: err?.message ?? "Unknown deployment error",
    };
  }
}
