import {
  ContractAddress,
  FactoryBuilder,
  StoreBuilder,
} from "@thellex/pos-sdk";
import { LRUCache } from "lru-cache";
import { ERC20Manager } from "./token/manageERC20";
import { factoryAccount } from "./config";

// Global balance cache: (posAddress_tokenAddress) → balance string
const balanceCache = new LRUCache<string, string>({
  max: 1000,
  ttl: 1000 * 60 * 10, // 10 minutes
  updateAgeOnGet: true,
});

function getCacheKey(pos: ContractAddress, token: ContractAddress): string {
  return `${pos.toLowerCase()}_${token.toLowerCase()}`;
}

/**
 * Demonstrates full operation of a Store POS:
 * - Sends an external ERC20 transfer directly to the POS
 * - Monitors POS credited balance (not raw ERC20 balance)
 * - Detects when balance increases
 * - Prepares to register the external deposit
 */
export async function operatePOS(
  posAddress: ContractAddress,
  factoryBuilder: FactoryBuilder,
  tokenAddresses: ContractAddress[]
) {
  console.log("\n💳 Starting Store POS operation demo");
  console.log(`   POS Address: ${posAddress}`);
  console.log(
    `   Tokens to monitor: ${tokenAddresses
      .map((t) => t.slice(0, 10) + "...")
      .join(", ")}\n`
  );

  const storeBuilder = new StoreBuilder(factoryBuilder);

  console.log(`Token address is ${tokenAddresses[1]}`);

  // Pick one token for the external transfer demo
  const demoToken = tokenAddresses[1];
  if (!demoToken) {
    throw new Error("No token addresses provided");
  }

  const erc20 = new ERC20Manager(demoToken);

  // Step 1: Send external deposit (direct transfer to POS)
  console.log(
    "🔄 Step 1: Sending external deposit (1 token) directly to POS..."
  );
  try {
    const txHash = await erc20.transfer(posAddress, "1", factoryAccount);
    console.log(`   External transfer successful! Tx: ${txHash}`);
  } catch (err: any) {
    console.error("   Failed to send external transfer:", err.message);
    return;
  }

  // Step 2: Start balance monitoring loop
  console.log(
    "\n🔍 Step 2: Monitoring credited balances in Store POS every 10 seconds...\n"
  );

  const interval = setInterval(async () => {
    let detected = false;

    for (const token of tokenAddresses) {
      const key = getCacheKey(posAddress, token);
      const previous = balanceCache.get(key) || "0";

      try {
        const current = await storeBuilder.getStoreBalance(posAddress, token);
        balanceCache.set(key, current);

        const prev = BigInt(previous);
        const curr = BigInt(current);

        if (curr > prev) {
          const increase = (curr - prev).toString();
          detected = true;

          console.log(`\n✅ External deposit detected & credited!`);
          console.log(`   Token: ${token}`);
          console.log(`   Increase: ${increase} tokens`);
          console.log(`   New credited balance: ${current}`);

          // Optional: Stop monitoring after first detection (for demo)
          clearInterval(interval);
          console.log("\nMonitoring stopped after successful detection.");

          // Next step: You could auto-approve if it was a regular deposit,
          // but since this was external and now registered → balance is already credited!
        }
      } catch (err: any) {
        console.error(
          `   Error reading balance for token ${token.slice(0, 10)}...:`,
          err.message
        );
      }
    }

    if (!detected) {
      console.log(
        `   Balances unchanged (checked at ${new Date().toLocaleTimeString()})`
      );
    }
  }, 10_000);

  // Graceful shutdown
  process.on("SIGINT", () => {
    clearInterval(interval);
    console.log("\n🛑 Monitoring stopped by user.");
    process.exit(0);
  });

  // Keep process running
  await new Promise(() => {});
}
