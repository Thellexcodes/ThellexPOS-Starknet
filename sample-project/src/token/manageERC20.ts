// src/token/manageERC20.ts
import { Account, RpcProvider, Contract } from "starknet";
import {
  NODE_URL,
  FACTORY_ACCOUNT_ADDRESS,
  FACTORY_PRIVATE_KEY,
} from "../config";

export class ERC20Manager {
  private contract: Contract;

  constructor(tokenAddress: string) {
    const provider = new RpcProvider({ nodeUrl: NODE_URL });
    const abi = [
      // Minimal ABI needed
      {
        name: "transfer",
        type: "function",
        inputs: [
          { name: "recipient", type: "ContractAddress" },
          { name: "amount", type: "u256" },
        ],
        outputs: [{ type: "bool" }],
      },
      {
        name: "approve",
        type: "function",
        inputs: [
          { name: "spender", type: "ContractAddress" },
          { name: "amount", type: "u256" },
        ],
        outputs: [{ type: "bool" }],
      },
      {
        name: "balance_of",
        type: "function",
        inputs: [{ name: "account", type: "ContractAddress" }],
        outputs: [{ type: "u256" }],
      },
      {
        name: "allowance",
        type: "function",
        inputs: [
          { name: "owner", type: "ContractAddress" },
          { name: "spender", type: "ContractAddress" },
        ],
        outputs: [{ type: "u256" }],
      },
    ];

    this.contract = new Contract(abi, tokenAddress, provider);
  }

  async transfer(recipient: string, amount: string, account: Account) {
    const { transaction_hash } = await account.execute({
      contractAddress: this.contract.address,
      entrypoint: "transfer",
      calldata: [recipient, amount, "0"],
    });
    await account.waitForTransaction(transaction_hash);
    console.log(`Transferred ${amount} tokens to ${recipient}`);
  }

  async approve(spender: string, amount: string, account: Account) {
    const { transaction_hash } = await account.execute({
      contractAddress: this.contract.address,
      entrypoint: "approve",
      calldata: [spender, amount, "0"],
    });
    await account.waitForTransaction(transaction_hash);
    console.log(`Approved ${amount} for spender ${spender}`);
  }

  async getBalance(account: string): Promise<string> {
    const balance = await this.contract.call("balance_of", [account]);
    return balance.toString();
  }

  async getAllowance(owner: string, spender: string): Promise<string> {
    const allowance = await this.contract.call("allowance", [owner, spender]);
    return allowance.toString();
  }
}
