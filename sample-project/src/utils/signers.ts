import { ContractAddress } from "@thellex/pos-sdk";
import { Account, ec, hash, num, uint256 } from "starknet";
import { dump } from "./dump";
import {
  customerAccount,
  FACTORY_PRIVATE_KEY,
  MERCHANT_ADDRESS,
  MERCHANT_PRIVATE_KEY,
} from "../config";
import { SELECTORS } from "./constants";

export async function signStoreOffchainMessage(
  account: Account,
  storeAddress: ContractAddress,
  functionName: string,
  params: any[], // raw params in order (e.g., [amountU256, token, sender])
  nonce: bigint,
  deadline: bigint
): Promise<
  | {
      sig_r: string;
      sig_s: string;
      pubkey: string;
    }
  | any
> {
  // 1. Build calldata hash
  let calldataHash: BigNumberish = BigInt(0);
  for (const param of params) {
    if (typeof param === "object" && "low" in param && "high" in param) {
      // u256
      calldataHash = hash.computeHashOnElements([
        calldataHash,
        BigInt(param.low),
      ]);
      calldataHash = hash.computeHashOnElements([
        calldataHash,
        BigInt(param.high),
      ]);
    } else {
      calldataHash = hash.computeHashOnElements([calldataHash, BigInt(param)]);
    }
  }
  // 2. Build full message hash (exact match with contract)
  let msgHash: BigNumberish = BigInt(1); // constant prefix
  msgHash = hash.computeHashOnElements([msgHash, BigInt(account.address)]);
  msgHash = hash.computeHashOnElements([msgHash, nonce]);
  msgHash = hash.computeHashOnElements([msgHash, deadline]);
  msgHash = hash.computeHashOnElements([
    msgHash,
    BigInt(hash.getSelectorFromName(functionName)),
  ]);
  msgHash = hash.computeHashOnElements([msgHash, calldataHash]);

  const { r, s } = ec.starkCurve.sign(msgHash, MERCHANT_PRIVATE_KEY);

  return {
    sig_r: "0x" + r.toString(16),
    sig_s: "0x" + s.toString(16),
  };
}

export function computeTestSignUserHash(
  selector: SELECTORS,
  args: BigNumberish[]
): string {
  // Convert calldata arguments to felts
  const calldata = args.map((v) => num.toBigInt(v));

  // Convert selector to felt (bigint)
  const selectorFelt = num.toBigInt(hash.getSelector(selector));

  // Compute Pedersen hash
  const hashResult = hash.computeHashOnElements([...calldata, selectorFelt]);

  return hashResult; // hex string
}

export function signTestSignUserHash(hashHex: string) {
  const msgHash = num.getHexString(hashHex);

  const { r, s } = ec.starkCurve.sign(msgHash, MERCHANT_PRIVATE_KEY);

  return {
    sig_r: "0x" + r.toString(16),
    sig_s: "0x" + s.toString(16),
  };
}

export function toUint256Parts(
  value: string | number | bigint,
  decimals: number = 0
): { low: bigint; high: bigint } {
  // Convert input to string for normalization
  const str = value.toString();

  let scaled: bigint;

  // If input is already BigInt and decimals = 0
  if (typeof value === "bigint" && decimals === 0) {
    scaled = value;
  }
  // No decimal in input → treat as integer
  else if (!str.includes(".")) {
    scaled = BigInt(str) * BigInt(10 ** decimals);
  }
  // Decimal present
  else {
    const [whole, frac = ""] = str.split(".");

    const fractionPadded = (frac + "0".repeat(decimals)).slice(0, decimals);

    scaled =
      BigInt(whole || "0") * BigInt(10 ** decimals) +
      BigInt(fractionPadded || "0");
  }

  // Convert scaled BigInt → uint256
  const uint = uint256.bnToUint256(scaled);

  return {
    low: BigInt(uint.low),
    high: BigInt(uint.high),
  };
}

export type BigNumberish = bigint | number | string;

export function toBigIntSafe(value: BigNumberish): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error("Number exceeds safe integer range");
    }
    return BigInt(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    // Hex string
    if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
      return BigInt(trimmed);
    }

    // Decimal string
    if (/^[0-9]+$/.test(trimmed)) {
      return BigInt(trimmed);
    }

    throw new Error(`Invalid numeric string: ${value}`);
  }

  throw new Error(`Unsupported type: ${typeof value}`);
}
