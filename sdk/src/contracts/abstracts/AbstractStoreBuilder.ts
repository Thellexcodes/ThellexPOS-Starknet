import { BigNumberish, Call } from "starknet";
import { ContractAddress, WatchStoreDepositsParams } from "../../types";

/**
 * AbstractStoreBuilder
 *
 * Abstract base class defining the interface for building transactions and
 * querying state on the Thellex Store POS contract.
 *
 * The Store POS contract is a secure, role-based point-of-sale system on Starknet
 * designed and developed by Thellex, authored by Samuel Anthony.
 *
 * This builder abstraction enables clean, type-safe interaction with all
 * contract functions – including on-chain deposits, off-chain signed approvals/
 * rejections, payment requests, withdrawals, and administrative operations.
 *
 * Concrete implementations should extend BaseBuilder and implement these methods
 * using the cached Contract instance and starknet.js utilities.
 *
 * Credits:
 *   © Thellex – Protocol design and architecture
 *   Samuel Anthony – Primary contract author and developer
 */
export abstract class AbstractStoreBuilder {
  /**
   * Builds a deposit transaction call.
   * On-chain function allowing users to deposit tokens while registering a unique tx_id.
   *
   * @param storeAddress - Deployed Store POS contract address
   * @param amount - Deposit amount as decimal string (e.g., "150.0")
   * @param txId - Unique transaction identifier (felt252 as string)
   * @param token - ERC20 token contract address
   * @returns Call object ready for execution via account.execute
   */
  abstract buildDeposit(
    storeAddress: ContractAddress,
    amount: string,
    txId: string,
    token: ContractAddress
  ): Call;

  /**
   * Builds an approve_transaction call using an off-chain signature.
   * Only callable by Owner or Manager roles.
   *
   * @param storeAddress - Store POS contract address
   * @param txId - Deposit transaction ID to approve
   * @returns Call object (typically executed via signed meta-transaction)
   */
  abstract buildApproveTransaction(
    storeAddress: ContractAddress,
    txId: string
  ): Call | any;

  /**
   * Builds a reject_transaction call using an off-chain signature.
   * Triggers a full refund to the original depositor (Owner/Manager only).
   *
   * @param storeAddress - Store POS contract address
   * @param txId - Deposit transaction ID to reject
   * @returns Call object
   */
  abstract buildRejectTransaction(
    storeAddress: ContractAddress,
    txId: string
  ): Call;

  /**
   * Builds an auto_refund_signed call for timed-out deposits.
   * Allows Owner/Manager to refund (minus tax) to a custom receiver.
   *
   * @param storeAddress - Store POS contract address
   * @param txId - Timed-out deposit transaction ID
   * @param refundReceiver - Address receiving the refund amount
   * @returns Call object
   */
  abstract buildAutoRefund(
    storeAddress: ContractAddress,
    txId: string,
    refundReceiver: ContractAddress
  ): Call;

  /**
   * Builds a withdraw_to_owner call using an off-chain signature.
   * Withdraws accumulated fees/balances to the contract owner.
   *
   * @param storeAddress - Store POS contract address
   * @param amount - Amount to withdraw as decimal string
   * @param token - Token contract address
   * @returns Call object
   */
  abstract buildWithdraw(
    storeAddress: ContractAddress,
    amount: string,
    token: ContractAddress
  ): Call;

  /**
   * Builds a batch_withdraw call for multiple tokens at once.
   * Signed by Owner/Manager; useful for efficient treasury management.
   *
   * @param storeAddress - Store POS contract address
   * @param tokens - Array of token addresses
   * @param amounts - Parallel array of amounts as decimal strings
   * @param recipient - Destination address (usually owner/treasury)
   * @returns Call object
   */
  abstract buildBatchWithdraw(
    storeAddress: ContractAddress,
    tokens: ContractAddress[],
    amounts: string[],
    recipient: ContractAddress
  ): Call;

  /**
   * Builds a create_payment_request call.
   * Allows Cashier+ roles to create payable requests for customers.
   *
   * @param storeAddress - Store POS contract address
   * @param amount - Requested payment amount as decimal string
   * @param token - Token contract address
   * @param requestId - Unique request identifier (felt252 string)
   * @returns Call object
   */
  abstract buildCreatePaymentRequest(
    storeAddress: ContractAddress,
    amount: string,
    token: ContractAddress,
    requestId: string
  ): Call;

  /**
   * Builds a fulfill_payment_request call.
   * Direct on-chain payment by a customer to settle an active request.
   *
   * @param storeAddress - Store POS contract address
   * @param requestId - Payment request ID
   * @param amount - Exact amount matching the request (decimal string)
   * @param token - Exact token matching the request
   * @returns Call object
   */
  abstract buildFulfillPaymentRequest(
    storeAddress: ContractAddress,
    requestId: string,
    amount: string,
    token: ContractAddress
  ): Call;

  /**
   * Builds a register_external_deposit call using an off-chain signature.
   * Credits balance without requiring an on-chain transfer (Owner/Manager only).
   *
   * @param storeAddress - Store POS contract address
   * @param amount - Deposit amount as decimal string
   * @param token - Token contract address
   * @param sender - Address of the original depositor
   * @returns Call object
   */
  abstract buildRegisterExternalDeposit(
    storeAddress: ContractAddress,
    amount: string,
    token: ContractAddress,
    sender: ContractAddress,
    callDataOptions: {
      nonce: BigNumberish;
      deadline: BigNumberish;
      pubkey: BigNumberish;
      sig_r: BigNumberish;
      sig_s: BigNumberish;
    }
  ): Call | any;

  /**
   * Retrieves deposit details for a specific transaction ID.
   *
   * @param storeAddress - Store POS contract address
   * @param txId - Transaction/deposit ID
   * @returns Promise resolving to parsed DepositInfo
   */
  abstract getDeposit(
    storeAddress: ContractAddress,
    txId: string
  ): Promise<any>;

  /**
   * Gets the current credited balance of a token inside the Store POS.
   *
   * @param storeAddress - Store POS contract address
   * @param token - Token contract address
   * @returns Promise resolving to balance as decimal string
   */
  abstract getStoreBalance(
    storeAddress: ContractAddress,
    token: ContractAddress
  ): Promise<string>;

  /**
   * Scans and returns all pending (unapproved) deposit transaction IDs.
   *
   * @param storeAddress - Store POS contract address
   * @returns Promise resolving to array of pending tx_id strings
   */
  abstract getPendingTransactions(
    storeAddress: ContractAddress
  ): Promise<string[]>;

  /**
   * Retrieves the owner address of the Store POS contract.
   *
   * @param storeAddress - Store POS contract address
   * @returns Promise resolving to owner address
   */
  abstract getOwner(storeAddress: ContractAddress): Promise<ContractAddress>;

  /**
   * Retrieves the configured treasury address.
   *
   * @param storeAddress - Store POS contract address
   * @returns Promise resolving to treasury address
   */
  abstract getTreasury(storeAddress: ContractAddress): Promise<ContractAddress>;

  /**
   * Checks if a token is supported by the associated factory.
   *
   * @param storeAddress - Store POS contract address
   * @param token - Token to check
   * @returns Promise resolving to boolean
   */
  abstract isSupportedToken(
    storeAddress: ContractAddress,
    token: ContractAddress
  ): Promise<boolean>;

  /**
   * Checks whether the Store POS contract is currently paused.
   *
   * @param storeAddress - Store POS contract address
   * @returns Promise resolving to boolean
   */
  abstract isPaused(storeAddress: ContractAddress): Promise<boolean>;

  /**
   * Checks whether the Store POS contract has been initialized.
   *
   * @param storeAddress - Store POS contract address
   * @returns Promise resolving to boolean
   */
  abstract isInitialized(storeAddress: ContractAddress): Promise<boolean>;

  /**
   * Watches Store.balance_of(token) and detects external deposits.
   * Uses polling + internal caching.
   */
  abstract watchStoreDeposits(params: WatchStoreDepositsParams): Promise<void>;

  abstract getNonce(
    storeAddress: ContractAddress,
    signerAddress: ContractAddress
  ): Promise<string>;
}
