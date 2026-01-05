// src/main.ts
import { dump } from "./utils/dump";
import { deployERC20, DeployERC20Result } from "./token/deployERC20";
import { deployAndInitializeFactory } from "./deployFactory";
import { manageFactorySettings } from "./manageFactory";
import { createPOSInstance } from "./createPOS";
import { operatePOS } from "./operatePOS";
import { addTokenToFactory } from "./token/addToFactory";
import { ContractAddress } from "@thellex/pos-sdk";
import { delay } from "./utils/delay";
import { Account } from "starknet";
import {
  FACTORY_ADDRESS,
  MERCHANT_ADDRESS,
  MERCHANT_PRIVATE_KEY,
  merchantAccount,
} from "./config";
import { shortenAddress } from "./utils/shortenAddress";
import { depositDetector } from "./utils/constants";
import { DepositEvent } from "./types/events";

async function main() {
  console.log("🚀 Starting Thellex POS Full Deployment & Demo\n");

  // =====================
  // 1. Deploy ERC20 Tokens
  // =====================
  console.log(
    "Deploying test ERC20 tokens (sequentially to respect nonce)...\n"
  );

  const tokenConfigs = [
    {
      name: "StarkToken",
      symbol: "STRK",
      supply: "10000000000000000000000", // 10,000 STRK (18 decimals)
      decimals: 18,
    },
    {
      name: "Mock USD Coin",
      symbol: "USDC",
      supply: "1000000000000", // 1,000,000 USDC (6 decimals)
      decimals: 6,
    },
  ];

  const deployedTokens: {
    name: string;
    symbol: string;
    address: ContractAddress;
  }[] = [];

  for (const config of tokenConfigs) {
    try {
      const token = (await deployERC20(
        config.name,
        config.symbol,
        config.supply,
        config.decimals
      )) as any;

      deployedTokens.push({
        name: config.name,
        symbol: config.symbol,
        address: token.address,
      });

      console.log(
        `   → ${config.name} (${config.symbol}) deployed at ${shortenAddress(
          token.address
        )}\n`
      );
    } catch (err) {
      console.error(`Failed to deploy ${config.name}:`, (err as Error).message);
    }

    await delay(2000);
  }

  if (deployedTokens.length === 0) {
    throw new Error("No tokens were successfully deployed. Aborting.");
  }

  const tokenAddresses = deployedTokens.map((t) => t.address);

  // =====================
  // 2. Deploy Factory
  // =====================

  const { factoryBuilder, factoryAccount, storeBuilder, executor } =
    await deployAndInitializeFactory();

  // =====================
  // 📡 START EVENT LISTENER (NON-BLOCKING)
  // =====================
  const eventListenerControl = { stop: false };

  // factoryBuilder
  //   .monitorEvents({
  //     contractAddress: FACTORY_ADDRESS,
  //     eventNames: ["StorePOSCreated", "PersonalPOSCreated"],
  //     abiFilePath: "pos_Factory.contract_class.json",
  //     cancelToken: () => eventListenerControl.stop,
  //     callback: async (eventData) => {
  //       const event = eventData.event;

  //       console.log("📡 Factory Event Detected");
  //       console.log(`   Type: ${event.type}`);
  //       console.log(`   Tx Hash: ${eventData.metadata.transactionHash}`);
  //       console.log("   Data:", event.data);

  //       if (
  //         event.type === "StorePOSCreated" ||
  //         event.type === "PersonalPOSCreated"
  //       ) {
  //         const posAddress = event.data.pos_address as ContractAddress;

  //         console.log("✅ POS successfully created via event listener");
  //         console.log(`   POS Address: ${posAddress}`);

  //         // Optional: stop listener after first POS creation
  //         eventListenerControl.stop = true;
  //       }
  //     },
  //   })
  //   .catch((err) => {
  //     console.error("❌ Event listener crashed:", err);
  //   });

  // =====================
  // 3. Configure Factory
  // =====================
  console.log("Adding deployed tokens to factory supported list...\n");

  await manageFactorySettings(
    FACTORY_ADDRESS,
    factoryBuilder,
    factoryAccount,
    tokenAddresses
  );

  // =====================
  // 4. Create POS
  // =====================
  console.log("Creating new POS instance...\n");

  const posAddress = await createPOSInstance(
    FACTORY_ADDRESS,
    factoryBuilder,
    "store"
  );

  // =====================
  // 5. Approvals & Checks
  // =====================
  console.log(
    "Approving POS to spend tokens and ensuring factory support...\n"
  );

  for (const token of deployedTokens) {
    try {
      const isSupported = await factoryBuilder.isSupportedToken(
        FACTORY_ADDRESS,
        token.address
      );

      if (!isSupported) {
        console.log(`   → ${token.symbol} not supported — adding`);
        await addTokenToFactory(
          token.address,
          factoryBuilder,
          factoryAccount,
          FACTORY_ADDRESS
        );
      }
    } catch (err) {
      console.warn(`   ⚠️ Issue with ${token.symbol}:`, (err as Error).message);
    }

    await delay(1000);
  }

  // =====================
  // 6. Operate POS
  // =====================
  console.log("\nOperating the POS instance...\n");

  await operatePOS(
    posAddress,
    factoryBuilder,
    storeBuilder,
    tokenAddresses,
    executor
  );

  // =====================
  // Final Output
  // =====================
  console.log("\n🎉 All operations completed successfully!");
  console.log(`Factory: ${shortenAddress(FACTORY_ADDRESS)}`);
  console.log(`POS:     ${shortenAddress(posAddress)}`);
  console.log("Tokens:");

  deployedTokens.forEach((t) =>
    console.log(`   • ${t.name} (${t.symbol}): ${shortenAddress(t.address)}`)
  );

  // Somewhere else in your app (e.g., merchant backend)
  depositDetector.on("depositDetected", async (event: DepositEvent) => {
    console.log(
      `\n🎯 Received deposit event for merchant ${event.merchantAddress}`
    );
    console.log(`   POS: ${event.posAddress}`);
    console.log(`   Token: ${event.tokenAddress}`);
    console.log(`   Amount: ${event.amount}`);

    // // Auto-register the external deposit
    // const registerCall = storeBuilder.buildRegisterExternalDeposit(
    //   event.posAddress,
    //   event.amount,
    //   event.tokenAddress,
    //   "0x...sender..." // track sender via events or off-chain
    // );

    // Sign off-chain with merchantAccount and submit
    console.log(`   → Ready to register_external_deposit (sign & send)`);
  });
}

main().catch((error) => {
  console.error("\n❌ Script failed:", error);
  process.exit(1);
});
