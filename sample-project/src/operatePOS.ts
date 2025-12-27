// src/operatePOS.ts
import { ThellexPOSBuilder, ContractAddress } from "@thellex/pos-sdk";
import { ThellexPOSFactoryBuilder } from "@thellex/pos-sdk";
import { Account } from "starknet";
import { TOKEN_ADDRESS, FACTORY_ACCOUNT_ADDRESS } from "./config";

export async function operatePOS(
  posAddress: ContractAddress,
  factoryBuilder: ThellexPOSFactoryBuilder,
  factoryAccount: Account
) {
  console.log("\n💳 Operating POS instance...");

  const posBuilder = new ThellexPOSBuilder(factoryBuilder);
  const token = TOKEN_ADDRESS;

  // Deposit
  const depositTx = posBuilder.buildDeposit(posAddress, "1000", "tx001", token);
  await factoryBuilder.sendTransaction(factoryAccount, depositTx);
  console.log("   → Deposit submitted (tx001)");

  // Approve
  const approveTx = posBuilder.buildApproveTransaction(posAddress, "tx001");
  await factoryBuilder.sendTransaction(factoryAccount, approveTx);
  console.log("   → tx001 approved");

  // Another deposit for reject test
  const deposit2Tx = posBuilder.buildDeposit(posAddress, "500", "tx002", token);
  await factoryBuilder.sendTransaction(factoryAccount, deposit2Tx);

  // Reject
  const rejectTx = posBuilder.buildRejectTransaction(posAddress, "tx002");
  await factoryBuilder.sendTransaction(factoryAccount, rejectTx);
  console.log("   → tx002 rejected");

  // Withdraw
  const withdrawTx = posBuilder.buildWithdraw(
    posAddress,
    FACTORY_ACCOUNT_ADDRESS,
    "500",
    token
  );
  await factoryBuilder.sendTransaction(factoryAccount, withdrawTx);
  console.log("   → Funds withdrawn");
}
