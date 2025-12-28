import { ContractAddress } from "@thellex/pos-sdk";
import { Call, uint256, Contract, Account, RpcProvider } from "starknet";
import { NODE_URL } from "../config";

/**
 * ERC20Manager
 *
 * Utility class to interact with standard ERC20 tokens on Starknet.
 * Provides safe transfer, approve, and balance/allowance queries.
 *
 * Used in Thellex POS flows for:
 * - Funding a Store POS with tokens (external deposit)
 * - Approving the POS to spend tokens (if needed in future)
 */
export class ERC20Manager {
  private contract: Contract;
  private readonly tokenAddress: ContractAddress;

  /**
   * @param tokenAddress - Address of the ERC20 token contract
   * @param nodeUrl - Optional RPC node URL (defaults to global config if available)
   */
  constructor(tokenAddress: ContractAddress, nodeUrl?: string) {
    const provider = new RpcProvider({ nodeUrl: nodeUrl || NODE_URL });
    const minimalAbi = [
      {
        name: "transfer",
        type: "function",
        inputs: [
          { name: "recipient", type: "ContractAddress" },
          { name: "amount", type: "u256" },
        ],
        outputs: [{ type: "bool" }],
        stateMutability: "external",
      },
      {
        name: "approve",
        type: "function",
        inputs: [
          { name: "spender", type: "ContractAddress" },
          { name: "amount", type: "u256" },
        ],
        outputs: [{ type: "bool" }],
        stateMutability: "external",
      },
      {
        name: "balanceOf",
        type: "function",
        inputs: [{ name: "account", type: "ContractAddress" }],
        outputs: [{ type: "u256" }],
        stateMutability: "view",
      },
      {
        name: "allowance",
        type: "function",
        inputs: [
          { name: "owner", type: "ContractAddress" },
          { name: "spender", type: "ContractAddress" },
        ],
        outputs: [{ type: "u256" }],
        stateMutability: "view",
      },
    ];

    this.tokenAddress = tokenAddress;
    this.contract = new Contract(minimalAbi, tokenAddress, provider);
  }

  /**
   * Transfers tokens from the signer's account to a recipient (e.g., Store POS).
   *
   * @param recipient - Destination address (e.g., Store POS contract)
   * @param amount - Amount as decimal string (e.g., "100.0")
   * @param account - Signer account (must hold the tokens)
   * @returns Transaction hash
   */
  async transfer(
    recipient: ContractAddress,
    amount: string,
    account: Account
  ): Promise<string> {
    const amountU256 = uint256.bnToUint256(amount);

    const { transaction_hash } = await account.execute({
      contractAddress: this.tokenAddress,
      entrypoint: "transfer",
      calldata: [recipient, amountU256.low, amountU256.high],
    });

    await account.waitForTransaction(transaction_hash);
    console.log(
      `Transferred ${amount} tokens to ${recipient}. Tx: ${transaction_hash}`
    );
    return transaction_hash;
  }

  /**
   * Approves a spender (e.g., Store POS) to spend tokens on behalf of the signer.
   *
   * @param spender - Address to approve (e.g., Store POS)
   * @param amount - Amount to approve as decimal string
   * @param account - Signer account
   * @returns Transaction hash
   */
  async approve(
    spender: ContractAddress,
    amount: string,
    account: Account
  ): Promise<string> {
    const amountU256 = uint256.bnToUint256(amount);

    const { transaction_hash } = await account.execute({
      contractAddress: this.tokenAddress,
      entrypoint: "approve",
      calldata: [spender, amountU256.low, amountU256.high],
    });

    await account.waitForTransaction(transaction_hash);
    console.log(`Approved ${amount} tokens for spender ${spender}`);
    return transaction_hash;
  }

  /**
   * Gets the token balance of an account.
   *
   * @param account - Address to query
   * @returns Balance as decimal string
   */
  async getBalance(account: ContractAddress): Promise<string> {
    const result = await this.contract.balanceOf(account);
    return uint256.uint256ToBN(result).toString();
  }

  /**
   * Gets the remaining allowance from owner to spender.
   *
   * @param owner - Token owner
   * @param spender - Approved spender
   * @returns Allowance as decimal string
   */
  async getAllowance(
    owner: ContractAddress,
    spender: ContractAddress
  ): Promise<string> {
    const result = await this.contract.allowance(owner, spender);
    return uint256.uint256ToBN(result).toString();
  }
}
