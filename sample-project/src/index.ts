// src/main.ts
import { dump } from "./utils/dump";
import { deployERC20, DeployERC20Result } from "./token/deployERC20";
import { deployAndInitializeFactory } from "./deployFactory";
import { manageFactorySettings } from "./manageFactory";
import { createPOSInstance } from "./createPOS";
import { operatePOS } from "./operatePOS";
import { ERC20Manager } from "./token/manageERC20";
import { addTokenToFactory } from "./token/addToFactory";
import { ContractAddress } from "@thellex/pos-sdk";
import { delay } from "./utils/delay";
import { Account } from "starknet";
import {
  MERCHANT_ADDRESS,
  MERCHANT_PRIVATE_KEY,
  merchantAccount,
} from "./config";

const UINT256_MAX =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

async function main() {
  console.log("🚀 Starting Thellex POS Full Deployment & Demo\n");

  // === 1. Deploy Multiple ERC20 Tokens Sequentially ===
  console.log(
    "Deploying test ERC20 tokens (sequentially to respect nonce)...\n"
  );

  const tokenConfigs = [
    {
      name: "StarkToken",
      symbol: "STRK",
      supply: "10000000000000000000000",
      decimals: 18,
    },
    // { name: "USDC Mock", symbol: "USDC", supply: "1000000000", decimals: 6 },
    // {
    //   name: "DAI Mock",
    //   symbol: "DAI",
    //   supply: "5000000000000000000000",
    //   decimals: 18,
    // },
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

  // === 2. Deploy & Initialize Factory ===
  console.log("Deploying and initializing POS Factory...\n");
  const { factoryBuilder, factoryAccount, storeClassHash } =
    await deployAndInitializeFactory();

  // Use your known factory address (or fetch from deploy response if dynamic)
  const factoryAddress =
    "0x7c183c3336b62234ff8ceb5d985f0247eace1ef0651853941ed77794c087621";

  // === 3. Add Tokens to Factory Supported List ===
  console.log("Adding deployed tokens to factory supported list...\n");
  await manageFactorySettings(
    factoryAddress,
    factoryBuilder,
    factoryAccount,
    tokenAddresses
  );

  // === 4. Create POS Instance ===
  console.log("Creating new POS instance...\n");
  const posAddress = await createPOSInstance(
    factoryAddress,
    factoryBuilder,
    factoryAccount,
    merchantAccount,
    storeClassHash,
    "store"
  );
  return;

  // === 5. Approve POS to Spend Tokens + Double-Check Factory Support ===
  console.log(
    "Approving POS to spend tokens and ensuring factory support...\n"
  );

  for (const token of deployedTokens) {
    const mgr = new ERC20Manager(token.address);

    try {
      // Approve max amount so POS can pull funds on deposit
      await mgr.approve(posAddress, UINT256_MAX, factoryAccount);
      console.log(`   → Approved ${token.symbol} for POS spending`);

      // Redundant but safe: ensure token is supported (in case manageFactory skipped)
      const isSupported = await factoryBuilder.isSupportedToken(
        factoryAddress,
        token.address as ContractAddress,
        "pos_Factory.contract_class.json"
      );

      if (!isSupported) {
        console.log(`   → ${token.symbol} not supported yet — adding now`);
        await addTokenToFactory(
          token.address as ContractAddress,
          factoryBuilder,
          factoryAccount,
          factoryAddress
        );
      }
    } catch (err) {
      console.warn(
        `   ⚠️  Issue with ${token.symbol}:`,
        (err as Error).message
      );
    }

    await delay(1000); // Respect nonce again
  }

  // === 6. Operate the POS (deposits, approve, reject, withdraw) ===
  console.log("\nOperating the POS instance...\n");
  await operatePOS(posAddress, factoryBuilder, factoryAccount);

  console.log("\n🎉 All operations completed successfully!");
  console.log(`Factory: ${shortenAddress(factoryAddress)}`);
  console.log(`POS:     ${shortenAddress(posAddress)}`);
  console.log("Tokens:");
  deployedTokens.forEach((t) =>
    console.log(`   • ${t.name} (${t.symbol}): ${shortenAddress(t.address)}`)
  );
}

// Helper to shorten addresses in logs
function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

main().catch((error) => {
  console.error("\n❌ Script failed:", error);
  process.exit(1);
});
