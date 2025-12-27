import {
  Account,
  BigNumberish,
  Call,
  GetTransactionReceiptResponse,
  Result,
  TransactionStatusReceiptSets,
  Uint256,
} from "starknet";
import { ContractAddress, FactoryInitializeArgs, POSType } from "../../types";
import { EventCallbackData, EventName, POSEvent } from "../../types/events";

export abstract class AbstractFactory {
  /** Build a deployment call for a contract */
  abstract buildFactoryDeployment(
    contractPath: string,
    constructorArgs?: any[]
  ): Promise<Call>;

  /** Build an initialize call for the factory */
  abstract buildInitializeFactoryTransaction(
    factoryAddress: ContractAddress,
    abiPath: string,
    initArgs: FactoryInitializeArgs
  ): Promise<Call>;

  /** Build a transaction to add a supported token */
  abstract buildAddSupportedToken(
    factoryAddress: ContractAddress,
    token: ContractAddress,
    abiPath: string
  ): Call;

  /** Build a transaction to remove a supported token */
  abstract buildRemoveSupportedToken(
    factoryAddress: ContractAddress,
    token: ContractAddress,
    abiPath: string
  ): Call;

  /** Build a transaction to create a POS instance */
  abstract buildCreatePOS(
    abiPath: string,
    factoryAddress: ContractAddress,
    options: {
      type: POSType;
      owner?: ContractAddress; // required for personal POS
      merchant?: ContractAddress; // required for store POS
      storeName?: string; // required for store POS
    }
  ): Promise<Call>;

  /** Build a transaction to update treasury */
  abstract buildUpdateTreasury(
    factoryAddress: ContractAddress,
    newTreasury: ContractAddress,
    abiPath: string
  ): Call;

  /** Build a transaction to update fee percent */
  abstract buildUpdateFeePercent(
    factoryAddress: ContractAddress,
    newFeePercent: number,
    abiPath: string
  ): Call;

  /** Build a transaction to update tax percent */
  abstract buildUpdateTaxPercent(
    factoryAddress: ContractAddress,
    newTaxPercent: number,
    abiPath: string
  ): Call;

  /** Build a transaction to update timeout */
  abstract buildUpdateTimeout(
    factoryAddress: ContractAddress,
    newTimeout: number,
    abiPath: string
  ): Call;

  /** Build a transaction to pause/unpause the factory */
  abstract buildSetPaused(
    factoryAddress: ContractAddress,
    paused: boolean,
    abiPath: string
  ): Call;

  /** Query functions */
  abstract getTreasury(
    factoryAddress: ContractAddress,
    abiPath: string
  ): Promise<ContractAddress>;
  abstract getFeePercent(
    factoryAddress: ContractAddress,
    abiPath: string
  ): Promise<number>;
  abstract getTaxPercent(
    factoryAddress: ContractAddress,
    abiPath: string
  ): Promise<number>;
  abstract getTimeout(
    factoryAddress: ContractAddress,
    abiPath: string
  ): Promise<Result>;

  abstract getPaused(
    factoryAddress: ContractAddress,
    abiPath: string
  ): Promise<Result>;

  abstract isSupportedToken(
    factoryAddress: ContractAddress,
    token: ContractAddress,
    abiPath: string
  ): Promise<boolean>;

  /** Send a prepared transaction */
  abstract sendTransaction(
    account: Account,
    transaction: Call
  ): Promise<GetTransactionReceiptResponse<keyof TransactionStatusReceiptSets>>;

  /**
   * Monitors on-chain events for a specific contract and invokes a callback with event data and metadata.
   * @param contractAddress The address of the contract to monitor.
   * @param eventNames Array of event names to filter (e.g., ["POSCreated", "Deposit"]).
   * @param callback Async function to handle each parsed event with metadata for database updates or other calls.
   * @param pollInterval Polling interval in milliseconds (default: 5000).
   * @param abiFilePath Optional ABI file path for the contract.
   * @param cancelToken Optional function to check for cancellation (returns true to stop polling).
   */
  abstract monitorEvents<T extends EventName>(
    contractAddress: string,
    eventNames: T[],
    callback: (
      eventData: EventCallbackData<Extract<POSEvent, { type: T }>>
    ) => Promise<void>,
    pollInterval?: number,
    abiFilePath?: string,
    cancelToken?: () => boolean
  ): Promise<void>;
}
