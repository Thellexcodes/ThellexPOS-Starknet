import {
  ContractAddress,
  FactoryBuilder,
  StoreBuilder,
} from "@thellex/pos-sdk";
import { LRUCache } from "lru-cache";
import { customerAccount, factoryAccount, merchantAccount } from "./config";
import { Contract } from "starknet";
import { compiledContract } from "./token/deployERC20";
import { dump } from "./utils/dump";

// /**
//  * Simple async delay helper
//  */
// const delay = (ms: number) =>
//   new Promise<void>((resolve) => setTimeout(resolve, ms));

// /**
//  * ERC20 balance cache
//  * Key: `${posAddress}_${tokenAddress}`
//  */
// const erc20BalanceCache = new LRUCache<string, bigint>({
//   max: 1000,
//   ttl: 1000 * 60 * 10,
//   updateAgeOnGet: true,
// });

// function makeCacheKey(
//   posAddress: ContractAddress,
//   tokenAddress: ContractAddress
// ): string {
//   return `${posAddress.toLowerCase()}_${tokenAddress.toLowerCase()}`;
// }

// /**
//  * FULL BLOWN Thellex Store POS Demo & ERC20 Monitoring Solution
//  */
// export async function operatePOS(
//   posAddress: ContractAddress,
//   factoryBuilder: FactoryBuilder,
//   storeBuilder: StoreBuilder,
//   tokenAddresses: ContractAddress[]
// ) {
//   console.log("\n🚀 THELLEX STORE POS — FULL LIFECYCLE DEMO & MONITOR");
//   console.log(`   POS Address: ${posAddress}`);
//   console.log(`   Monitoring ${tokenAddresses.length} token(s):`);
//   tokenAddresses.forEach((t, i) => console.log(`      [${i + 1}] ${t}`));

//   const demoToken = tokenAddresses[0];
//   if (!demoToken) {
//     throw new Error("At least one token address is required");
//   }

//   // ========================================================================
//   // ERC20 CONTRACTS
//   // ========================================================================

//   const factoryErc20 = new Contract(
//     compiledContract.abi,
//     demoToken,
//     factoryAccount
//   );

//   const customerErc20 = new Contract(
//     compiledContract.abi,
//     demoToken,
//     customerAccount
//   );

//   // ========================================================================
//   // 0. SEED CUSTOMER WITH TOKENS
//   // ========================================================================

//   console.log("\n0. Seeding customer with demo tokens");

//   await factoryErc20.transfer(
//     customerAccount.address as ContractAddress,
//     "100"
//   );

//   console.log("   ✅ Customer funded with 100 tokens");

//   // ========================================================================
//   // 1. INITIAL ERC20 BALANCE SNAPSHOT (SOURCE OF TRUTH)
//   // ========================================================================

//   console.log("\n🔍 ERC20 INITIAL BALANCE CHECK");

//   const initialErc20Balance = BigInt(
//     await customerErc20.balance_of(posAddress)
//   );

//   console.log(`   POS ERC20 balance: ${initialErc20Balance.toString()}`);

//   const balanceKey = makeCacheKey(posAddress, demoToken);
//   erc20BalanceCache.set(balanceKey, initialErc20Balance);

//   // ========================================================================
//   // 2. REAL-TIME ERC20 MONITORING LOOP (READ-ONLY)
//   // ========================================================================

//   const pollIntervalMs = 7_000;
//   let initialDepositDetected = false;
//   let followUpTransferTriggered = false;

//   setInterval(async () => {
//     try {
//       const previousBalance = erc20BalanceCache.get(balanceKey) ?? BigInt(0);
//       const currentBalance = BigInt(await customerErc20.balance_of(posAddress));

//       if (currentBalance === previousBalance) {
//         console.log(
//           `   No ERC20 balance change — ${new Date().toLocaleTimeString()}`
//         );
//         return;
//       }

//       const delta = currentBalance - previousBalance;
//       erc20BalanceCache.set(balanceKey, currentBalance);

//       console.log("\n📈 ERC20 BALANCE CHANGE DETECTED");
//       console.log(`   Token: ${demoToken}`);
//       console.log(`   Δ ${delta.toString()}`);
//       console.log(`   New Balance: ${currentBalance.toString()}`);
//       console.log(`   Time: ${new Date().toLocaleString()}`);

//       if (!initialDepositDetected && delta > BigInt(0)) {
//         initialDepositDetected = true;
//         console.log("🟢 Initial deposit confirmed");
//       }
//     } catch (err) {
//       console.error("⚠️ ERC20 polling error:", err);
//     }
//   }, pollIntervalMs);

//   // ========================================================================
//   // 3. REACTIVE FOLLOW-UP TRANSFER (OUTSIDE MONITOR)
//   // ========================================================================

//   const waitForDepositThenTriggerTransfer = async () => {
//     while (!initialDepositDetected) {
//       await delay(1_000);
//     }

//     if (followUpTransferTriggered) return;
//     followUpTransferTriggered = true;

//     console.log("\n🚀 Triggering follow-up ERC20 transfer to POS");

//     const followUpTx = await factoryErc20.transfer(posAddress, "15");

//     console.log("   ✅ Follow-up transfer sent");
//     console.log(`   Tx Hash: ${followUpTx}`);
//   };

//   void waitForDepositThenTriggerTransfer();

//   // ========================================================================
//   // 4. DELAYED INITIAL EXTERNAL TRANSFER
//   // ========================================================================

//   console.log("\n1. Waiting 60 seconds before initial external deposit to POS");
//   await delay(60_000);

//   console.log("   ⏳ Sending initial external deposit to POS");

//   const initialTransferTx = await customerErc20.transfer(posAddress, "15");

//   console.log("   ✅ External transfer sent");
//   console.log(`   Tx Hash: ${initialTransferTx}`);

//   // ========================================================================
//   // 5. KEEP PROCESS ALIVE
//   // ========================================================================

//   await new Promise(() => {});
// }

/**
 * Simple async delay helper
 */
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * ERC20 raw balance cache
 * Key: `${merchantAddress}_${posAddress}_${tokenAddress}` (all lowercase)
 * Supports multiple merchants safely
 */
const erc20BalanceCache = new LRUCache<string, bigint>({
  max: 1000,
  ttl: 1000 * 60 * 10, // 10 minutes
  updateAgeOnGet: true,
});

function makeCacheKey(
  merchantAddress: ContractAddress,
  posAddress: ContractAddress,
  tokenAddress: ContractAddress
): string {
  return `${merchantAddress.toLowerCase()}_${posAddress.toLowerCase()}_${tokenAddress.toLowerCase()}`;
}

/**
 * FULL BLOWN Thellex Store POS Demo & External Deposit Monitor
 * Monitors raw ERC20 balance of the POS for external deposits
 */
export async function operatePOS(
  posAddress: ContractAddress,
  factoryBuilder: FactoryBuilder,
  storeBuilder: StoreBuilder,
  tokenAddresses: ContractAddress[]
) {
  const merchantAddress = merchantAccount.address as ContractAddress;

  console.log("\n🚀 THELLEX STORE POS — EXTERNAL DEPOSIT MONITOR");
  console.log(`   Merchant: ${merchantAddress}`);
  console.log(`   POS Address: ${posAddress}`);

  const demoToken = tokenAddresses[0];
  if (!demoToken) {
    throw new Error("At least one token address is required");
  }
  console.log(`   Monitoring token: ${demoToken}\n`);

  // ========================================================================
  // ERC20 CONTRACTS (direct style — no changes to your pattern)
  // ========================================================================
  const factoryErc20 = new Contract(
    compiledContract.abi,
    demoToken,
    factoryAccount // assuming factoryAccount is your funding account
  );

  const customerErc20 = new Contract(
    compiledContract.abi,
    demoToken,
    customerAccount
  );

  // ========================================================================
  // 0. SEED CUSTOMER WITH TOKENS
  // ========================================================================
  console.log("0. Seeding customer with demo tokens");
  await factoryErc20.transfer(
    customerAccount.address as ContractAddress,
    "200"
  );
  console.log("   ✅ Customer funded with 200 tokens\n");

  // ========================================================================
  // 1. INITIAL BALANCE SNAPSHOT
  // ========================================================================
  console.log("🔍 Taking initial raw ERC20 balance snapshot");

  const initialBalance = BigInt(await customerErc20.balance_of(posAddress));
  console.log(`   POS raw balance: ${initialBalance.toString()}`);

  const balanceKey = makeCacheKey(merchantAddress, posAddress, demoToken);
  erc20BalanceCache.set(balanceKey, initialBalance);

  // ========================================================================
  // 2. REAL-TIME BALANCE MONITORING (7-second poll)
  // ========================================================================
  const pollIntervalMs = 7000;
  let initialDepositDetected = false;
  let followUpTransferTriggered = false;

  // storeBuilder.watchStoreDeposits({
  //   merchantAddress: merchantAccount.address as ContractAddress,
  //   storeAddress: posAddress,
  //   tokenAddress: demoToken,
  //   pollIntervalMs: pollIntervalMs,
  //   onDeposit: (info) => {
  //     dump({ info });
  //   },
  // });

  setInterval(async () => {
    try {
      const previousBalance = erc20BalanceCache.get(balanceKey) ?? BigInt(0);
      const currentBalance = BigInt(await customerErc20.balance_of(posAddress));

      if (currentBalance === previousBalance) {
        console.log(`   No change — ${new Date().toLocaleTimeString()}`);
        return;
      }

      const delta = currentBalance - previousBalance;
      erc20BalanceCache.set(balanceKey, currentBalance);

      console.log("\n📈 RAW ERC20 BALANCE CHANGE DETECTED (EXTERNAL DEPOSIT)");
      console.log(`   Token: ${demoToken}`);
      console.log(`   Change: ${delta > 0 ? "+" : ""}${delta.toString()}`);
      console.log(`   New Raw Balance: ${currentBalance.toString()}`);
      console.log(`   Time: ${new Date().toLocaleString()}`);
      console.log(`   Merchant: ${merchantAddress}`);
      console.log(`   POS: ${posAddress}\n`);

      if (!initialDepositDetected && delta > BigInt(0)) {
        initialDepositDetected = true;
        console.log("🟢 First external deposit confirmed\n");
      }

      console.log("   NEXT STEP:");
      console.log(
        "     → Call register_external_deposit() with the delta amount"
      );
      console.log("     → Sign with merchant account to credit POS balance\n");
    } catch (err: any) {
      console.error("⚠️ Polling error:", err.message);
    }
  }, pollIntervalMs);

  // ========================================================================
  // 3. REACTIVE FOLLOW-UP TRANSFER
  // ========================================================================
  const waitForDepositThenTriggerFollowUp = async () => {
    while (!initialDepositDetected) {
      await delay(1000);
    }

    if (followUpTransferTriggered) return;
    followUpTransferTriggered = true;

    console.log("\n🚀 Triggering follow-up external transfer (15 tokens)");
    const tx = await factoryErc20.transfer(posAddress, "15");
    console.log(`   ✅ Follow-up sent! Tx: ${tx.transaction_hash || tx}`);
    console.log(`   → Will be detected in next poll cycle\n`);
  };

  void waitForDepositThenTriggerFollowUp();

  // ========================================================================
  // 4. INITIAL EXTERNAL DEPOSIT (after delay)
  // ========================================================================
  console.log(
    "\n⏳ Waiting 60 seconds before sending initial external deposit..."
  );
  await delay(60_000);

  console.log("   Sending initial external deposit (20 tokens) to POS");
  const initialTx = await customerErc20.transfer(posAddress, "20");
  console.log(
    `   ✅ Initial external deposit sent! Tx: ${
      initialTx.transaction_hash || initialTx
    }`
  );
  console.log(
    `   → Monitor will detect soon → then register_external_deposit needed\n`
  );

  // ========================================================================
  // 5. KEEP PROCESS ALIVE
  // ========================================================================
  await new Promise(() => {});
}
