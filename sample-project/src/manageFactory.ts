// src/manageFactory.ts
import { FactoryBuilder, ContractAddress } from "@thellex/pos-sdk";
import { Account } from "starknet";

export async function manageFactorySettings(
  factoryAddress: ContractAddress,
  factoryBuilder: FactoryBuilder,
  factoryAccount: Account,
  tokenAddresses: ContractAddress[] = []
) {
  console.log("\n⚙️ Managing Factory Settings");

  const factoryFilename = "pos_Factory.contract_class.json";

  // === 1. Add Supported Tokens ===
  if (tokenAddresses.length > 0) {
    console.log(
      `\nAdding ${tokenAddresses.length} token(s) to supported list...`
    );

    for (const tokenAddress of tokenAddresses) {
      const isAlreadySupported = await factoryBuilder.isSupportedToken(
        factoryAddress,
        tokenAddress,
        factoryFilename
      );

      if (isAlreadySupported) {
        console.log(
          `   → Token ${shortenAddress(
            tokenAddress
          )} already supported (skipping)`
        );
        continue;
      }

      const addTx = factoryBuilder.buildAddSupportedToken(
        factoryAddress,
        tokenAddress,
        factoryFilename
      );

      await factoryBuilder.sendTransaction(factoryAccount, addTx);
      console.log(`   → Token added: ${shortenAddress(tokenAddress)}`);
    }
  } else {
    console.log("   ⚠️  No tokens provided to add");
  }

  // === 2. Update Factory Parameters ===
  console.log("\nUpdating factory parameters...");

  const updates = [
    {
      name: "Treasury",
      tx: factoryBuilder.buildUpdateTreasury(
        factoryAddress,
        "0x2222222222222222222222222222222222222222", // New treasury
        factoryFilename
      ),
    },
    {
      name: "Fee Percent (7%)",
      tx: factoryBuilder.buildUpdateFeePercent(
        factoryAddress,
        700,
        factoryFilename
      ),
    },
    {
      name: "Tax Percent (3%)",
      tx: factoryBuilder.buildUpdateTaxPercent(
        factoryAddress,
        300,
        factoryFilename
      ),
    },
    {
      name: "Timeout (2 hours)",
      tx: factoryBuilder.buildUpdateTimeout(
        factoryAddress,
        7200,
        factoryFilename
      ),
    },
    {
      name: "Pause Factory",
      tx: factoryBuilder.buildSetPaused(factoryAddress, false, factoryFilename),
    },
  ];

  for (const { name, tx } of updates) {
    await factoryBuilder.sendTransaction(factoryAccount, tx);
    console.log(`   → ${name} updated`);
  }

  // === 3. Query & Display Final State ===
  console.log("\nFetching current factory state...");

  const [treasury, feePercent, taxPercent, timeout] = await Promise.all([
    factoryBuilder.getTreasury(factoryAddress, factoryFilename),
    factoryBuilder.getFeePercent(factoryAddress, factoryFilename),
    factoryBuilder.getTaxPercent(factoryAddress, factoryFilename),
    factoryBuilder.getTimeout(factoryAddress, factoryFilename),
    factoryBuilder.getPaused(factoryAddress, factoryFilename), // assuming you have this getter
  ]);

  // Check support for first token if any
  const sampleToken = tokenAddresses[0];
  const sampleSupported = sampleToken
    ? await factoryBuilder.isSupportedToken(
        factoryAddress,
        sampleToken,
        factoryFilename
      )
    : false;

  console.log("\n✅ Final Factory State:");
  const timeoutSeconds =
    typeof timeout === "number" ? timeout : parseInt(`${timeout}`, 10);

  console.table({
    Treasury: shortenAddress(treasury),
    "Fee Percent": `${feePercent / 100}%`,
    "Tax Percent": `${taxPercent / 100}%`,
    Timeout: `${timeoutSeconds} seconds (~${Math.round(
      timeoutSeconds / 3600
    )} hours)`,
    // Paused: isPaused ? "Yes" : "No",
    "Sample Token Supported": sampleToken
      ? `${shortenAddress(sampleToken)} → ${sampleSupported ? "Yes" : "No"}`
      : "N/A",
  });
}

// Helper: shorten address for clean logs
function shortenAddress(address: string | undefined): string {
  if (!address) return "None";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
