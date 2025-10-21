import {
  Account,
  BigNumberish,
  Call,
  GetTransactionReceiptResponse,
  TransactionStatusReceiptSets,
  Uint256,
} from "starknet";
import { ContractAddress, FactoryInitializeArgs } from "../../types";
import { EventCallbackData, ThellexFactoryEvent } from "../../types/events";

export abstract class AbstractThellexPOSFactory {
  // abstract deployFactory(
  //   account: Account,
  //   classHash: string,
  //   factoryPath: string
  // ): Promise<ContractAddress>;
  abstract buildFactoryDeployment(factoryPath: string): Promise<Call>;

  /** Build an initialize call for the factory */
  abstract buildInitializeFactoryTransaction(
    factoryAddress: ContractAddress,
    abiPath: string,
    initArgs: FactoryInitializeArgs
  ): void;

  /** Build a transaction to add a supported token */
  abstract buildAddSupportedToken(token: ContractAddress): Call | any;

  /** Build a transaction to remove a supported token */
  abstract buildRemoveSupportedToken(token: ContractAddress): Call | any;

  /** Build a transaction to create a POS instance */
  abstract buildCreatePOS(
    factoryAddress: ContractAddress,
    abiPath: string,
    owner: ContractAddress,
    posClassHash: string
  ): Call;

  /** Build a transaction to update treasury */
  abstract buildUpdateTreasury(newTreasury: ContractAddress): Call | any;

  /** Build a transaction to update fee percent */
  abstract buildUpdateFeePercent(newFeePercent: string): Call | any;

  /** Build a transaction to update tax percent */
  abstract buildUpdateTaxPercent(newTaxPercent: string): Call | any;

  /** Build a transaction to update timeout */
  abstract buildUpdateTimeout(newTimeout: string): Call | any;

  /** Build a transaction to pause/unpause the factory */
  abstract buildSetPaused(paused: boolean): Call | any;

  /** Query functions */
  abstract getTreasury(): Promise<ContractAddress>;
  abstract getFeePercent(): Promise<string>;
  abstract getTaxPercent(): Promise<string>;
  abstract getTimeout(): Promise<string>;
  abstract isSupportedToken(token: ContractAddress): Promise<boolean>;

  /** Send a prepared transaction */
  abstract sendTransaction(
    account: Account,
    transaction: Call | any
  ): Promise<GetTransactionReceiptResponse<keyof TransactionStatusReceiptSets>>;

  /**
   * Monitors on-chain events for a specific contract and invokes a callback with event data and metadata.
   * @param contractAddress The address of the contract to monitor.
   * @param eventNames Array of event names to filter (e.g., ["POSCreated", "Deposit"]).
   * @param callback Async function to handle each parsed event with metadata for database updates or other calls.
   * @param pollInterval Polling interval in milliseconds (default: 5000).
   * @param abiFileName Optional ABI file name for the contract (relative to abis/starknet/).
   * @param cancelToken Optional function to check for cancellation (returns true to stop polling).
   */
  abstract monitorEvents(
    contractAddress: string,
    eventNames: string[],
    callback: (eventData: EventCallbackData) => Promise<void>,
    pollInterval: number,
    abiFileName?: string,
    cancelToken?: () => boolean
  ): Promise<void>;
}
