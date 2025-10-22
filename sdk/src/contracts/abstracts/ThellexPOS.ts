import { Call } from "starknet";
import { ContractAddress } from "../../types";

/**
 * Abstract base class defining the structure and
 * required methods for any Thellex POS builder.
 */
export abstract class AbstractThellexPOS {
  /**
   * Build a deposit transaction call.
   */
  abstract buildDeposit(
    posAddress: ContractAddress,
    amount: string,
    txId: string,
    token: ContractAddress
  ): Call;

  /**
   * Build a transaction approval call.
   */
  abstract buildApproveTransaction(
    posAddress: ContractAddress,
    txId: string
  ): Call;

  /**
   * Build a transaction rejection call.
   */
  abstract buildRejectTransaction(
    posAddress: ContractAddress,
    txId: string
  ): Call;

  /**
   * Build an automatic refund call.
   */
  abstract buildAutoRefund(
    posAddress: ContractAddress,
    txId: string,
    refundReceiver: ContractAddress
  ): Call;

  /**
   * Build a withdrawal transaction call.
   */
  abstract buildWithdraw(
    posAddress: ContractAddress,
    recipient: ContractAddress,
    amount: string,
    token: ContractAddress
  ): Call;

  /**
   * Fetch deposit information for a specific transaction ID.
   */
  abstract getDeposit(posAddress: ContractAddress, txId: string): Promise<any>;

  /**
   * Get POS token balance.
   */
  abstract getPOSBalance(
    posAddress: ContractAddress,
    token: ContractAddress
  ): Promise<string>;

  /**
   * Get all pending transaction IDs.
   */
  abstract getPendingTransactions(
    posAddress: ContractAddress
  ): Promise<string[]>;

  /**
   * Get the POS contract owner.
   */
  abstract getOwner(posAddress: ContractAddress): Promise<ContractAddress>;

  /**
   * Get the treasury address for the POS contract.
   */
  abstract getTreasury(posAddress: ContractAddress): Promise<ContractAddress>;

  /**
   * Check if a token is supported by the POS contract.
   */
  abstract isSupportedToken(
    posAddress: ContractAddress,
    token: ContractAddress
  ): Promise<boolean>;
}
