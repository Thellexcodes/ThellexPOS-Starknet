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
  MERCHANT_ADDRESS,
  MERCHANT_PRIVATE_KEY,
  merchantAccount,
} from "./config";
import { shortenAddress } from "./utils/shortenAddress";

const UINT256_MAX =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

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
  console.log("Deploying and initializing POS Factory...\n");

  const { factoryBuilder, factoryAccount, storeBuilder } =
    await deployAndInitializeFactory();

  const factoryAddress: ContractAddress =
    "0x7c183c3336b62234ff8ceb5d985f0247eace1ef0651853941ed77794c087621";

  // =====================
  // 📡 START EVENT LISTENER (NON-BLOCKING)
  // =====================
  const eventListenerControl = { stop: false };

  // factoryBuilder
  //   .monitorEvents({
  //     contractAddress: factoryAddress,
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
    factoryAddress,
    factoryBuilder,
    factoryAccount,
    tokenAddresses
  );

  // =====================
  // 4. Create POS
  // =====================
  console.log("Creating new POS instance...\n");

  const posAddress = await createPOSInstance(
    factoryAddress,
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
        factoryAddress,
        token.address
      );

      if (!isSupported) {
        console.log(`   → ${token.symbol} not supported — adding`);
        await addTokenToFactory(
          token.address,
          factoryBuilder,
          factoryAccount,
          factoryAddress
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

  await operatePOS(posAddress, factoryBuilder, storeBuilder, tokenAddresses);

  // =====================
  // Final Output
  // =====================
  console.log("\n🎉 All operations completed successfully!");
  console.log(`Factory: ${shortenAddress(factoryAddress)}`);
  console.log(`POS:     ${shortenAddress(posAddress)}`);
  console.log("Tokens:");

  deployedTokens.forEach((t) =>
    console.log(`   • ${t.name} (${t.symbol}): ${shortenAddress(t.address)}`)
  );
}

main().catch((error) => {
  console.error("\n❌ Script failed:", error);
  process.exit(1);
});
