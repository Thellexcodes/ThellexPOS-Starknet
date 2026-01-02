import { Call, uint256 } from "starknet";
import {
  BaseBuilderConfigArgs,
  ContractAddress,
  WatchStoreDepositsParams,
} from "../types";
import { FactoryBuilder } from "./FactoryBuilder";
import { AbstractStoreBuilder } from "./abstracts/AbstractStoreBuilder";
import { BaseBuilder } from "../core/BaseBuilder";
import { makeStoreCacheKey, storeBalanceCache } from "./constants";

/**
 * StoreBuilder
 *
 * Concrete implementation of AbstractStoreBuilder for interacting with
 * deployed Thellex Store POS contracts (point-of-sale payment terminals).
 *
 * This class leverages BaseBuilder for provider access, contract caching,
 * ABI loading, and utility methods. All Store POS instances share the same ABI.
 *
 * Credits:
 *   © Thellex – Protocol design, architecture, and ecosystem
 *   Samuel Anthony – Primary author of the Store POS and Factory contracts
 */
export class StoreBuilder extends BaseBuilder implements AbstractStoreBuilder {
  /** Relative path to the compiled Store POS ABI JSON file */
  private readonly STORE_ABI_PATH = "pos_Store.contract_class.json";

  /**
   * Constructs a new StoreBuilder instance.
   * Inherits configuration (nodeUrl, contractsPath, etc.) from BaseBuilder.
   *
   * @param config - BaseBuilder configuration object
   */
  // constructor(config?: BaseBuilderConfigArgs) {
  //   super(config!!);
  // }
  constructor(arg: FactoryBuilder) {
    super(arg instanceof FactoryBuilder ? arg.cloneConfig() : arg);
  }

  // ===========================================================================
  // Transaction Building – On-chain & Signed Actions
  // ===========================================================================

  /**
   * Builds an on-chain deposit call.
   * User transfers tokens to the Store POS and registers a unique tx_id.
   *
   * @param storeAddress - Deployed Store POS contract address
   * @param amount - Deposit amount as decimal string (e.g., "250.0")
   * @param txId - Unique transaction identifier (felt252 as string)
   * @param token - ERC20 token contract address
   * @returns Populated Call object
   */
  buildDeposit(
    storeAddress: ContractAddress,
    amount: string,
    txId: string,
    token: ContractAddress
  ): Call {
    const contract = this.getContract(storeAddress, this.STORE_ABI_PATH);

    return contract.populate("deposit", {
      amount: uint256.bnToUint256(amount),
      tx_id: txId,
      token,
    });
  }

  /**
   * Placeholder for building an approve_transaction call.
   * This function requires an off-chain EIP-712 signature from Owner/Manager.
   * Full implementation needs nonce, deadline, and signature parameters.
   *
   * @param storeAddress - Store POS contract address
   * @param txId - Deposit transaction ID to approve
   */
  async buildApproveTransaction(storeAddress: ContractAddress, txId: string) {
    const contract = this.getContract(storeAddress, this.STORE_ABI_PATH);
  }

  /**
   * Placeholder for building a reject_transaction call.
   * Requires off-chain signature from Owner/Manager.
   *
   * @param storeAddress - Store POS contract address
   * @param txId - Deposit transaction ID to reject
   */
  buildRejectTransaction(storeAddress: ContractAddress, txId: string): Call {
    throw new Error(
      "reject_transaction requires off-chain signature (signer, nonce, deadline, pubkey, sig_r, sig_s)."
    );
  }

  /**
   * Placeholder for building an auto_refund_signed call.
   * Allows Owner/Manager to refund a timed-out deposit (minus tax) to a custom receiver.
   *
   * @param storeAddress - Store POS contract address
   * @param txId - Timed-out deposit transaction ID
   * @param refundReceiver - Address receiving the refund
   */
  buildAutoRefund(
    storeAddress: ContractAddress,
    txId: string,
    refundReceiver: ContractAddress
  ): Call {
    throw new Error(
      "auto_refund_signed requires off-chain signature (signer, nonce, deadline, pubkey, sig_r, sig_s)."
    );
  }

  /**
   * Builds a withdraw_to_owner call (off-chain signed by Owner/Manager).
   * Withdraws accumulated balance for a specific token.
   *
   * @param storeAddress - Store POS contract address
   * @param amount - Amount to withdraw as decimal string
   * @param token - Token contract address
   * @returns Populated Call object
   */
  buildWithdraw(
    storeAddress: ContractAddress,
    amount: string,
    token: ContractAddress
  ): Call {
    const contract = this.getContract(storeAddress, this.STORE_ABI_PATH);

    return contract.populate("withdraw_to_owner", {
      token,
      amount: uint256.bnToUint256(amount),
    });
  }

  /**
   * Builds a batch_withdraw call to withdraw multiple tokens in one transaction.
   *
   * @param storeAddress - Store POS contract address
   * @param tokens - Array of token contract addresses
   * @param amounts - Parallel array of amounts as decimal strings
   * @param recipient - Destination address (typically owner or treasury)
   * @returns Populated Call object
   */
  buildBatchWithdraw(
    storeAddress: ContractAddress,
    tokens: ContractAddress[],
    amounts: string[],
    recipient: ContractAddress
  ): Call {
    const contract = this.getContract(storeAddress, this.STORE_ABI_PATH);

    const amountsUint256 = amounts.map((a) => uint256.bnToUint256(a));

    return contract.populate("batch_withdraw", {
      tokens,
      amounts: amountsUint256,
      recipient,
    });
  }

  /**
   * Builds a create_payment_request call (Cashier+ role).
   * Creates a payable request that customers can fulfill directly.
   *
   * @param storeAddress - Store POS contract address
   * @param amount - Requested amount as decimal string
   * @param token - Token contract address
   * @param requestId - Unique request identifier (felt252 string)
   * @returns Populated Call object
   */
  buildCreatePaymentRequest(
    storeAddress: ContractAddress,
    amount: string,
    token: ContractAddress,
    requestId: string
  ): Call {
    const contract = this.getContract(storeAddress, this.STORE_ABI_PATH);

    return contract.populate("create_payment_request", {
      amount: uint256.bnToUint256(amount),
      token,
      request_id: requestId,
    });
  }

  /**
   * Builds a fulfill_payment_request call.
   * Customer pays directly on-chain to settle an active payment request.
   *
   * @param storeAddress - Store POS contract address
   * @param requestId - Payment request ID
   * @param amount - Exact amount matching the request (decimal string)
   * @param token - Exact token matching the request
   * @returns Populated Call object
   */
  buildFulfillPaymentRequest(
    storeAddress: ContractAddress,
    requestId: string,
    amount: string,
    token: ContractAddress
  ): Call {
    const contract = this.getContract(storeAddress, this.STORE_ABI_PATH);

    return contract.populate("fulfill_payment_request", {
      request_id: requestId,
      amount: uint256.bnToUint256(amount),
      token,
    });
  }

  /**
   * Placeholder for register_external_deposit (off-chain signed by Owner/Manager).
   * Credits balance without requiring on-chain token transfer.
   *
   * @param storeAddress - Store POS contract address
   * @param amount - Deposit amount as decimal string
   * @param token - Token contract address
   * @param sender - Original depositor address
   */
  async buildRegisterExternalDeposit(
    storeAddress: ContractAddress,
    amount: string,
    token: ContractAddress,
    sender: ContractAddress
  ) {
    const contract = this.getContract(storeAddress, this.STORE_ABI_PATH);
    const amountU256 = uint256.bnToUint256(amount);

    return contract.populate("register_external_deposit", {
      amount: amountU256,
      token,
      sender,
      signer: "0x0",
      nonce: "0",
      deadline: "0",
      pubkey: "0x0",
      sig_r: "0x0",
      sig_s: "0x0",
    });
  }

  // ===========================================================================
  // State Query Methods
  // ===========================================================================

  /**
   * Retrieves detailed information about a specific deposit.
   *
   * @param storeAddress - Store POS contract address
   * @param txId - Transaction/deposit ID
   * @returns Parsed deposit info object
   */
  async getDeposit(storeAddress: ContractAddress, txId: string): Promise<any> {
    const contract = this.getContract(storeAddress, this.STORE_ABI_PATH);
    const result = await contract.get_deposit(txId);

    return {
      amount: uint256.uint256ToBN(result.amount).toString(),
      token: result.token as ContractAddress,
      sender: result.sender as ContractAddress,
      timestamp: Number(result.timestamp),
      approved: Boolean(result.approved),
    };
  }

  /**
   * Gets the current credited balance of a token inside the Store POS.
   *
   * @param storeAddress - Store POS contract address
   * @param token - Token contract address
   * @returns Balance as decimal string
   */
  async getStoreBalance(
    storeAddress: ContractAddress,
    token: ContractAddress
  ): Promise<string> {
    const contract = this.getContract(storeAddress, this.STORE_ABI_PATH);
    const result = await contract.balance_of(token);
    return uint256.uint256ToBN(result).toString();
  }

  /**
   * Retrieves pending (unapproved) deposit transaction IDs.
   * Not directly available on-chain – requires event monitoring or off-chain indexing.
   *
   * @param storeAddress - Store POS contract address
   */
  async getPendingTransactions(
    storeAddress: ContractAddress
  ): Promise<string[]> {
    throw new Error(
      "Pending transactions cannot be queried directly on-chain. Use event monitoring via monitorEvents()."
    );
  }

  /**
   * Gets the owner address of the Store POS contract.
   *
   * @param storeAddress - Store POS contract address
   * @returns Owner address
   */
  async getOwner(storeAddress: ContractAddress) {
    const contract = this.getContract(storeAddress, this.STORE_ABI_PATH);
    const result = await contract.owner();
    return result as ContractAddress;
  }

  /**
   * Gets the treasury address configured in the Store POS.
   *
   * @param storeAddress - Store POS contract address
   * @returns Treasury address
   */
  async getTreasury(storeAddress: ContractAddress) {
    const contract = this.getContract(storeAddress, this.STORE_ABI_PATH);
    const result = await contract.treasury();
    return result as ContractAddress;
  }

  /**
   * Checks if a token is supported (whitelisted by the factory).
   *
   * @param storeAddress - Store POS contract address
   * @param token - Token address to check
   * @returns true if supported
   */
  async isSupportedToken(
    storeAddress: ContractAddress,
    token: ContractAddress
  ) {
    // Token support is managed at factory level
    // We need factory address – attempt to read from contract if exposed
    try {
      const contract = this.getContract(storeAddress, this.STORE_ABI_PATH);
      const factoryAddr = await contract.factory(); // assuming factory() view exists
      const factoryContract = this.getContract(factoryAddr, "factory.json");
      const supported = await factoryContract.is_supported_token(token);
      return Boolean(supported);
    } catch {
      throw new Error(
        "Unable to determine token support – factory address not accessible."
      );
    }
  }

  /**
   * Checks if the Store POS contract is currently paused.
   *
   * @param storeAddress - Store POS contract address
   * @returns true if paused
   */
  async isPaused(storeAddress: ContractAddress) {
    const contract = this.getContract(storeAddress, this.STORE_ABI_PATH);
    const result = await contract.is_paused();
    return Boolean(result);
  }

  /**
   * Checks if the Store POS contract has been successfully initialized.
   *
   * @param storeAddress - Store POS contract address
   * @returns true if initialized
   */
  async isInitialized(storeAddress: ContractAddress) {
    const contract = this.getContract(storeAddress, this.STORE_ABI_PATH);
    const result = await contract.is_initialized();
    return Boolean(result);
  }

  /**
   * Polls Store contract balance_of(token)
   * Detects external deposits without events
   */
  async watchStoreDeposits(params: {
    merchantAddress: ContractAddress;
    storeAddress: ContractAddress;
    tokenAddress: ContractAddress;
    pollIntervalMs?: number;
    onDeposit: (info: {
      delta: bigint;
      newBalance: bigint;
      previousBalance: bigint;
    }) => Promise<void> | void;
  }): Promise<void> {
    const {
      merchantAddress,
      storeAddress,
      tokenAddress,
      pollIntervalMs = 7000,
      onDeposit,
    } = params;

    const cacheKey = makeStoreCacheKey(
      merchantAddress,
      storeAddress,
      tokenAddress
    );

    // --------------------------------------------------
    // 1. INITIAL SNAPSHOT
    // --------------------------------------------------
    const initialRaw = await this.getContract(
      storeAddress,
      this.STORE_ABI_PATH
    ).balance_of(tokenAddress);
    const initialBalance = BigInt(initialRaw);

    storeBalanceCache.set(cacheKey, initialBalance);

    console.log("\n🔍 STORE BALANCE SNAPSHOT");
    console.log(`   Merchant: ${merchantAddress}`);
    console.log(`   Store: ${storeAddress}`);
    console.log(`   Token: ${tokenAddress}`);
    console.log(`   Raw balance: ${initialBalance.toString()}`);
    console.log(`   Poll interval: ${pollIntervalMs}ms\n`);

    // --------------------------------------------------
    // 2. POLLING LOOP
    // --------------------------------------------------
    setInterval(async () => {
      try {
        const previousBalance = storeBalanceCache.get(cacheKey) ?? BigInt(0);

        const currentRaw = await this.getContract(
          storeAddress,
          this.STORE_ABI_PATH
        ).balance_of(tokenAddress);
        const currentBalance = BigInt(currentRaw);

        if (currentBalance === previousBalance) {
          return;
        }

        const delta = currentBalance - previousBalance;

        // Update cache immediately (idempotent safety)
        storeBalanceCache.set(cacheKey, currentBalance);

        if (delta <= BigInt(0)) {
          return;
        }

        console.log("\n📈 STORE EXTERNAL DEPOSIT DETECTED");
        console.log(`   Merchant: ${merchantAddress}`);
        console.log(`   Store: ${storeAddress}`);
        console.log(`   Token: ${tokenAddress}`);
        console.log(`   Delta: +${delta.toString()}`);
        console.log(`   New balance: ${currentBalance.toString()}`);
        console.log(`   Time: ${new Date().toLocaleString()}\n`);

        await onDeposit({
          delta,
          newBalance: currentBalance,
          previousBalance,
        });
      } catch (err: any) {
        console.error("⚠️ Store polling error:", err.message);
      }
    }, pollIntervalMs);
  }

  async getNonce(
    storeAddress: ContractAddress,
    signerAddress: ContractAddress
  ) {
    const contract = this.getContract(storeAddress, this.STORE_ABI_PATH);

    try {
      const result = await contract.get_nonce(signerAddress);
      return BigInt(result).toString();
    } catch (error: any) {
      console.error("Failed to fetch nonce:", error.message);
      throw new Error(`Could not retrieve nonce for ${signerAddress}`);
    }
  }
}
