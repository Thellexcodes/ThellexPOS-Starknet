import {
  ContractAddress,
  FactoryBuilder,
  StoreBuilder,
  Executor,
} from "@thellex/pos-sdk";
import { LRUCache } from "lru-cache";
import {
  customerAccount,
  factoryAccount,
  merchantAccount,
  NODE_URL,
} from "./config";
import {
  Account,
  Call,
  Contract,
  hash,
  RpcProvider,
  uint256,
  num,
} from "starknet";
import { compiledContract } from "./token/deployERC20";
import { depositDetector, SELECTORS } from "./utils/constants";
import { DepositEvent } from "./types/events";
import { dump } from "./utils/dump";

import fs from "fs";
import path from "path";
import {
  computeTestSignUserHash,
  signStoreOffchainMessage,
  signTestSignUserHash,
  toBigIntSafe,
  toUint256Parts,
} from "./utils/signers";

/**
 * Persistent file for lastSafeBlock
 */
const LAST_BLOCK_FILE = path.join(__dirname, "last_safe_block.json");

/**
 * Load lastSafeBlock from file
 */
function loadLastSafeBlock(): number {
  try {
    if (fs.existsSync(LAST_BLOCK_FILE)) {
      const data = JSON.parse(fs.readFileSync(LAST_BLOCK_FILE, "utf-8"));
      const block = Number(data.block);
      console.log(`   📂 Loaded lastSafeBlock from file: ${block}`);
      return block;
    }
  } catch (err: any) {
    console.warn(`   ⚠️  Failed to load last_safe_block.json: ${err.message}`);
    console.log("   → Starting from block 0");
  }
  return 0;
}

/**
 * Save lastSafeBlock to file
 */
function saveLastSafeBlock(block: number) {
  try {
    fs.writeFileSync(LAST_BLOCK_FILE, JSON.stringify({ block }, null, 2));
    console.log(`   💾 Saved lastSafeBlock: ${block}`);
  } catch (err: any) {
    console.error(`   ❌ Failed to save last_safe_block.json: ${err.message}`);
  }
}

/**
 * ERC20 raw balance cache
 */
const erc20BalanceCache = new LRUCache<string, bigint>({
  max: 1000,
  ttl: 1000 * 60 * 10,
  updateAgeOnGet: true,
});

function makeCacheKey(
  merchantAddress: ContractAddress,
  posAddress: ContractAddress,
  tokenAddress: ContractAddress
): string {
  return `${merchantAddress.toLowerCase()}_${posAddress.toLowerCase()}_${tokenAddress.toLowerCase()}`;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * FULL Thellex Store POS — Auto External Deposit Registration
 */
export async function operatePOS(
  posAddress: ContractAddress,
  factoryBuilder: FactoryBuilder,
  storeBuilder: StoreBuilder,
  tokenAddresses: ContractAddress[],
  executor: Executor
) {
  const merchantAddress = merchantAccount.address as ContractAddress;

  console.log("\n🚀 THELLEX STORE POS — AUTO EXTERNAL DEPOSIT REGISTRATION");
  console.log(`   Merchant: ${merchantAddress}`);
  console.log(`   POS Address: ${posAddress}`);

  const demoToken = tokenAddresses[0];
  if (!demoToken) throw new Error("Token required");
  console.log(`   Monitoring token: ${demoToken}\n`);

  // Contracts
  const factoryErc20 = new Contract(
    compiledContract.abi,
    demoToken,
    factoryAccount
  );
  const customerErc20 = new Contract(
    compiledContract.abi,
    demoToken,
    customerAccount
  );

  const provider =
    factoryBuilder.provider || new RpcProvider({ nodeUrl: NODE_URL });

  // ========================================================================
  // 0. Seed customer
  // ========================================================================
  console.log("0. Seeding customer with tokens");
  try {
    await factoryErc20.transfer(
      customerAccount.address as ContractAddress,
      "1000"
    );
    console.log("   ✅ Customer funded with 1000 tokens\n");
  } catch (err: any) {
    console.warn("   ⚠️  Seeding failed (already funded?):", err.message);
  }

  // ========================================================================
  // 1. Initial balance & load persistent block
  // ========================================================================
  let initialBalance: bigint;
  try {
    initialBalance = BigInt(await customerErc20.balance_of(posAddress));
  } catch (err: any) {
    console.error("Failed to read initial balance:", err.message);
    initialBalance = BigInt(0);
  }

  const cacheKey = makeCacheKey(merchantAddress, posAddress, demoToken);
  erc20BalanceCache.set(cacheKey, initialBalance);
  console.log(`   Initial raw balance: ${initialBalance.toString()}`);

  let lastSafeBlock = loadLastSafeBlock();
  console.log(`   Block scanning starts from: ${lastSafeBlock}\n`);

  // ========================================================================
  // 2. Block scanning — detects sender + auto-registers
  // ========================================================================
  const scanIntervalMs = 8000;

  setInterval(async () => {
    try {
      const latestBlock = await provider.getBlockNumber();

      // 10-block overlap for safety
      const startBlock = Math.max(lastSafeBlock + 1, latestBlock - 9);

      if (startBlock > latestBlock) {
        return;
      }

      console.log(
        `\n🔄 Scanning blocks ${startBlock} → ${latestBlock} (10-block overlap)`
      );

      for (let blockNum = startBlock; blockNum <= latestBlock; blockNum++) {
        let block: any;
        try {
          block = await provider.getBlockWithTxs(blockNum);
        } catch (err: any) {
          console.error(`   Failed to fetch block ${blockNum}:`, err.message);
          continue;
        }

        for (const tx of block.transactions) {
          if (tx.type !== "INVOKE") continue;
          if (!tx.calldata || tx.calldata.length < 7) continue;

          const transferSelector = hash.getSelectorFromName("transfer");
          if (tx.calldata[2] !== transferSelector) continue;

          const recipient = tx.calldata[4];
          if (recipient.toLowerCase() !== posAddress.toLowerCase()) continue;

          const amountLow = tx.calldata[5];
          const amountHigh = tx.calldata[6] || "0";
          const amountBN = uint256.uint256ToBN({
            low: amountLow,
            high: amountHigh,
          });
          const amountStr = amountBN.toString();

          console.log("\n💰 EXTERNAL DEPOSIT DETECTED!");
          console.log(`   Sender: ${tx.sender_address}`);
          console.log(`   Amount: ${amountStr}`);
          console.log(`   Tx Hash: ${tx.transaction_hash}`);
          console.log(`   Block: ${blockNum}\n`);

          // === AUTO REGISTER ===
          try {
            console.log("   🔄 Auto-registering deposit...");

            const nonceStr = toBigIntSafe(
              await storeBuilder.getNonce(
                posAddress,
                merchantAccount.address as ContractAddress
              )
            );
            const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
            const tokenAddress = demoToken;
            const senderAddress = tx.sender_address;
            const signerAddress = merchantAccount.address;
            const contractAddress = posAddress;
            const hash = computeTestSignUserHash(
              SELECTORS.register_external_deposit,
              [
                amountLow.toString(),
                amountHigh.toString(),
                tokenAddress,
                senderAddress,
                signerAddress,
                nonceStr,
                deadline,
              ]
            );
            const sig = signTestSignUserHash(hash);

            dump([
              hash,
              sig,
              amountStr,
              amountLow.toString(),
              amountHigh.toString(),
              tokenAddress,
              senderAddress,
              signerAddress,
              nonceStr,
              deadline,
              sig.sig_r, // r
              sig.sig_s, // s
            ]);

            const amountU256 = uint256.bnToUint256(amountStr);

            const call: Call = {
              contractAddress,
              entrypoint: SELECTORS.register_external_deposit,
              calldata: [
                amountU256.low, // e.g., "0x1a2b3c..."
                amountU256.high, // e.g., "0x0" or "0x4d5e6f...",
                tokenAddress,
                senderAddress,
                signerAddress,
                nonceStr, //nonce
                deadline,
                sig.sig_r, // r
                sig.sig_s, // s
              ],
            };

            const txn = await factoryBuilder.sendTransaction(
              factoryAccount,
              call
            );

            dump({ txn });

            // User wants to approve a deposit gaslessly
            // await executor.signMetaTransaction(
            //   merchantAccount,
            //   {
            //     to: storeAddress,
            //     entrypoint: "approve_transaction",
            //     calldata: [tx_id, nonce, deadline, sig_r, sig_s], // Note: modify Store to accept user param if needed
            //   }
            // );

            // const nonce = BigInt(5);
            // const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

            // const hash = computeTestSignUserHash(SELECTORS.test_sign_user, [
            //   1,
            //   merchantAccount.address as ContractAddress,
            //   nonce,
            //   deadline,
            // ]);

            // const registerTx = await factoryBuilder.sendTransaction(
            //   merchantAccount,
            //   call
            // );
            // console.log(
            //   `   ✅ register_external_deposit submitted! Tx: ${registerTx}`
            // );

            // const { low: nonceLow, high: nonceHigh } = toUint256Parts(nonce);
            // const { low: deadlineLow, high: deadlineHigh } =
            //   toUint256Parts(nonce);

            // const nonceU64 = BigInt(nonce);
            // const deadlineU64 = BigInt(deadline);

            // let contractAddress = posAddress;

            // const call: Call = {
            //   contractAddress,
            //   entrypoint: SELECTORS.test_sign_user,
            //   calldata: [
            //     merchantAccount.address, // user
            //     nonceU64,
            //     deadlineU64,
            //     sig.sig_r, // r
            //     sig.sig_s, // s
            //   ],
            // };

            // const tx = await factoryBuilder.sendTransaction(
            //   factoryAccount,
            //   call
            // );

            // dump({ tx });

            // const registerTx = await factoryBuilder.sendTransaction(
            //   merchantAccount,
            //   call
            // );
            // console.log(
            //   `   ✅ register_external_deposit submitted! Tx: ${registerTx}`
            // );
            console.log(`   → Balance will be credited (net after fee)\n`);
          } catch (regErr: any) {
            console.error("   ❌ Auto-registration failed:", regErr.message);
          }
        }
      }

      // Only save on full success
      lastSafeBlock = latestBlock;
      saveLastSafeBlock(lastSafeBlock);
    } catch (err: any) {
      console.error("⚠️ Critical scan error (retrying):", err.message);
      // Do NOT save lastSafeBlock → will re-scan on next cycle
    }
  }, scanIntervalMs);

  // ========================================================================
  // 3. Demo deposit
  // ========================================================================
  console.log("⏳ Sending demo external deposit in 2 seconds...");
  await delay(2000);

  try {
    console.log("   Sending 100 tokens to POS");
    const tx = await customerErc20.transfer(posAddress, "100");
    console.log(`   ✅ Sent! Tx: ${tx.transaction_hash || tx}`);
    console.log(`   → Will be auto-registered soon\n`);
  } catch (err: any) {
    console.warn("   Demo transfer failed:", err.message);
  }

  await new Promise(() => {});
}
