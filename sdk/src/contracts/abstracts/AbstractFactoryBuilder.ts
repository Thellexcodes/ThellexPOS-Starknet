import { Call } from "starknet";
import { BuildCreatePOSArgs, ContractAddress } from "../../types";

/**
 * AbstractFactoryBuilder
 *
 * Abstract base class defining the interface for interacting with the
 * Thellex Factory contract on Starknet.
 *
 * The Factory contract manages deployment and configuration of Personal and Store POS
 * instances, supports token whitelisting, and handles global parameters like fees,
 * taxes, timeout, and treasury.
 *
 * This builder abstraction provides clean, type-safe methods for:
 * - Deploying the Factory itself
 * - Initializing the Factory
 * - Creating new POS instances (Personal or Store)
 * - Admin configuration (tokens, fees, treasury, pause, etc.)
 * - Querying factory state
 *
 * Credits:
 *   © Thellex – Protocol design, architecture, and ecosystem
 *   Samuel Anthony – Primary author and developer of the Factory and POS contracts
 */
export abstract class AbstractFactoryBuilder {
  /**
   * Builds a call to deploy the Factory contract.
   *
   * @param classHash - Precomputed class hash of the compiled Factory contract
   * @param salt - Optional salt for deterministic deployment (felt252 as string)
   * @returns Call object for deployment (typically via UDC or account.deploy)
   */
  abstract buildDeployFactory(classHash: string, salt?: string): Call;

  /**
   * Builds the initialize transaction for a deployed Factory.
   * Must be called once after deployment by an admin.
   *
   * @param factoryAddress - Address of the deployed Factory contract
   * @param treasury - Treasury address receiving fees
   * @param feePercent - Fee percentage in basis points (e.g., 100 = 1%)
   * @param taxPercent - Auto-refund tax percentage in basis points
   * @param timeout - Deposit timeout in seconds before auto-refund eligibility
   * @param minWithdrawalLimit - Minimum amount required for withdrawals
   * @returns Call object
   */
  abstract buildInitializeFactory(
    factoryAddress: ContractAddress,
    treasury: ContractAddress,
    feePercent: number,
    taxPercent: number,
    timeout: number,
    minWithdrawalLimit: string
  ): Call;

  /**
   * Builds a call to create a new POS instance via the Factory.
   * Supports both Personal POS (one per owner) and Store POS (multiple per merchant).
   *
   * @param factoryAddress - The deployed Factory contract address
   * @param type - Type of POS to create ("personal" or "store")
   * @param owner - Required when type is "personal": the owner address that will control the POS
   * @param merchant - Required when type is "store": the merchant address that will control the POS
   * @param storeName - Required when type is "store": human-readable name of the store (serialized as ByteArray)
   * @returns Populated Call object targeting the appropriate factory entrypoint
   * @throws Error if the type is invalid or required parameters are missing
   */
  abstract buildCreatePOS(params: BuildCreatePOSArgs): Call;

  /**
   * Builds a call to add a token to the supported whitelist.
   * Only callable by factory admin.
   *
   * @param factoryAddress - Factory contract address
   * @param token - ERC20 token address to support
   * @returns Call object
   */
  abstract buildAddSupportedToken(
    factoryAddress: ContractAddress,
    token: ContractAddress
  ): Call;

  /**
   * Builds a call to remove a token from the supported whitelist.
   * Only callable by factory admin.
   *
   * @param factoryAddress - Factory contract address
   * @param token - ERC20 token address to remove
   * @returns Call object
   */
  abstract buildRemoveSupportedToken(
    factoryAddress: ContractAddress,
    token: ContractAddress
  ): Call;

  /**
   * Builds a call to update the treasury address.
   * Only callable by factory admin.
   *
   * @param factoryAddress - Factory contract address
   * @param newTreasury - New treasury address
   * @returns Call object
   */
  abstract buildUpdateTreasury(
    factoryAddress: ContractAddress,
    newTreasury: ContractAddress
  ): Call;

  /**
   * Builds a call to update the global fee percentage (in basis points).
   * Only callable by factory admin.
   *
   * @param factoryAddress - Factory contract address
   * @param newFeePercent - New fee in basis points (max 10000 = 100%)
   * @returns Call object
   */
  abstract buildUpdateFeePercent(
    factoryAddress: ContractAddress,
    newFeePercent: number
  ): Call;

  /**
   * Builds a call to update the global tax percentage (in basis points).
   * Only callable by factory admin.
   *
   * @param factoryAddress - Factory contract address
   * @param newTaxPercent - New tax in basis points (max 10000 = 100%)
   * @returns Call object
   */
  abstract buildUpdateTaxPercent(
    factoryAddress: ContractAddress,
    newTaxPercent: number
  ): Call;

  /**
   * Builds a call to update the deposit timeout period.
   * Only callable by factory admin.
   *
   * @param factoryAddress - Factory contract address
   * @param newTimeout - New timeout in seconds
   * @returns Call object
   */
  abstract buildUpdateTimeout(
    factoryAddress: ContractAddress,
    newTimeout: number
  ): Call;

  /**
   * Builds a call to update the minimum withdrawal limit.
   * Only callable by factory admin.
   *
   * @param factoryAddress - Factory contract address
   * @param newLimit - New minimum withdrawal amount as decimal string
   * @returns Call object
   */
  abstract buildUpdateMinWithdrawalLimit(
    factoryAddress: ContractAddress,
    newLimit: string
  ): Call;

  /**
   * Builds a call to pause or unpause the factory.
   * Prevents new POS creation when paused.
   *
   * @param factoryAddress - Factory contract address
   * @param paused - true to pause, false to unpause
   * @returns Call object
   */
  abstract buildSetPaused(
    factoryAddress: ContractAddress,
    paused: boolean
  ): Call;

  /**
   * Builds a call to update the POS class hash used for deployments.
   * Only callable by factory admin.
   *
   * @param factoryAddress - Factory contract address
   * @param newClassHash - New declared class hash for POS contracts
   * @returns Call object
   */
  abstract buildSetPOSClassHash(
    factoryAddress: ContractAddress,
    newClassHash: string
  ): Call;

  // ======================== VIEW / QUERY METHODS ========================

  /**
   * Retrieves the personal POS address for a given owner.
   *
   * @param factoryAddress - Factory contract address
   * @param owner - Owner address
   * @returns Promise resolving to personal POS address (zero if none)
   */
  abstract getPersonalPOS(
    factoryAddress: ContractAddress,
    owner: ContractAddress
  ): Promise<ContractAddress>;

  /**
   * Checks if a given POS address belongs to a merchant as a store POS.
   *
   * @param factoryAddress - Factory contract address
   * @param merchant - Merchant address
   * @param posAddress - POS address to check
   * @returns Promise resolving to boolean
   */
  abstract isStorePOS(
    factoryAddress: ContractAddress,
    merchant: ContractAddress,
    posAddress: ContractAddress
  ): Promise<boolean>;

  /**
   * Gets the current treasury address.
   *
   * @param factoryAddress - Factory contract address
   * @returns Promise resolving to treasury address
   */
  abstract getTreasury(
    factoryAddress: ContractAddress
  ): Promise<ContractAddress>;

  /**
   * Gets the current fee percentage (in basis points).
   *
   * @param factoryAddress - Factory contract address
   * @returns Promise resolving to fee percent (number)
   */
  abstract getFeePercent(factoryAddress: ContractAddress): Promise<number>;

  /**
   * Gets the current tax percentage (in basis points).
   *
   * @param factoryAddress - Factory contract address
   * @returns Promise resolving to tax percent (number)
   */
  abstract getTaxPercent(factoryAddress: ContractAddress): Promise<number>;

  /**
   * Gets the current deposit timeout in seconds.
   *
   * @param factoryAddress - Factory contract address
   * @returns Promise resolving to timeout (number)
   */
  abstract getTimeout(factoryAddress: ContractAddress): Promise<number>;

  /**
   * Gets the current minimum withdrawal limit.
   *
   * @param factoryAddress - Factory contract address
   * @returns Promise resolving to limit as decimal string
   */
  abstract getMinWithdrawalLimit(
    factoryAddress: ContractAddress
  ): Promise<string>;

  /**
   * Checks if the factory is currently paused.
   *
   * @param factoryAddress - Factory contract address
   * @returns Promise resolving to boolean
   */
  abstract isPaused(factoryAddress: ContractAddress): Promise<boolean>;

  /**
   * Checks if a token is supported (whitelisted).
   *
   * @param factoryAddress - Factory contract address
   * @param token - Token address to check
   * @returns Promise resolving to boolean
   */
  abstract isSupportedToken(
    factoryAddress: ContractAddress,
    token: ContractAddress
  ): Promise<boolean>;

  /**
   * Checks if the factory has been initialized.
   *
   * @param factoryAddress - Factory contract address
   * @returns Promise resolving to boolean
   */
  abstract isInitialized(factoryAddress: ContractAddress): Promise<boolean>;
}
