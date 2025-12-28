import path from "path";
import { Call, uint256 } from "starknet";
import { BaseBuilder } from "../core/BaseBuilder";
import { BuildCreatePOSArgs, ContractAddress } from "../types";
import { AbstractFactoryBuilder } from "./abstracts/AbstractFactoryBuilder";

/**
 * FactoryBuilder
 *
 * Concrete implementation of AbstractFactoryBuilder.
 * Provides complete interaction with the Thellex Factory contract using BaseBuilder utilities.
 *
 * Credits:
 *   © Thellex – Protocol design and architecture
 *   Samuel Anthony – Primary author of the Factory and POS contracts
 */
export class FactoryBuilder
  extends BaseBuilder
  implements AbstractFactoryBuilder
{
  private readonly FACTORY_ABI_PATH = "pos_Factory.contract_class.json";

  // ===========================================================================
  // Deployment & Initialization
  // ===========================================================================

  /**
   * Builds a UDC deployment call for the Factory contract.
   * The Factory constructor only accepts the POS class hash.
   */
  buildDeployFactory(classHash: string, salt: string = "0"): Call {
    // POS class hash is pre-configured in BaseBuilder (or can be passed separately)
    const posClassHash =
      this.factoryClassHash ??
      this.computeClassHash(
        path.join(this.contractsPath, "store_pos.json") // adjust filename as needed
      );

    return {
      contractAddress: this.udcAddress,
      entrypoint: "deployContract",
      calldata: [
        classHash, // class_hash
        salt, // salt
        "0", // unique = false (deterministic if salt used)
        [posClassHash], // constructor calldata: [pos_class_hash]
      ],
    };
  }

  buildInitializeFactory(
    factoryAddress: ContractAddress,
    treasury: ContractAddress,
    feePercent: number,
    taxPercent: number,
    timeout: number,
    minWithdrawalLimit: string
  ): Call {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);

    return contract.populate("initialize", {
      treasury,
      fee_percent: uint256.bnToUint256(feePercent),
      tax_percent: uint256.bnToUint256(taxPercent),
      timeout,
      min_withdrawal_limit: uint256.bnToUint256(minWithdrawalLimit),
    });
  }

  // ===========================================================================
  // POS Creation
  // ===========================================================================

  /**
   * Builds a call to create a new POS instance via the Factory.
   * Supports both Personal POS (one per owner) and Store POS (multiple per merchant).
   *
   * @param factoryAddress - The deployed Factory contract address
   * @param type - Type of POS to create ("personal" or "store")
   * @param owner - Required for personal POS: the owner address
   * @param merchant - Required for store POS: the merchant address controlling the POS
   * @param storeName - Required for store POS: human-readable name (ByteArray string)
   * @returns Populated Call object for the selected creation function
   * @throws Error if required parameters are missing for the selected type
   */
  buildCreatePOS({
    factoryAddress,
    type,
    owner,
    merchant,
    storeName,
  }: BuildCreatePOSArgs): Call {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);

    if (type === "personal") {
      if (!owner) {
        throw new Error("owner address is required for personal POS creation");
      }
      return contract.populate("create_personal_pos", { ownerAddress: owner });
    }

    if (type === "store") {
      if (!merchant || storeName === undefined) {
        throw new Error(
          "merchant and storeName are required for store POS creation"
        );
      }
      // starknet.js automatically serializes string to ByteArray for ByteArray-typed args
      return contract.populate("create_store_pos", {
        store_name: storeName,
        merchant,
      });
    }

    throw new Error(`Invalid POS type: ${type}. Must be "personal" or "store"`);
  }

  // ===========================================================================
  // Admin Functions
  // ===========================================================================

  buildAddSupportedToken(
    factoryAddress: ContractAddress,
    token: ContractAddress
  ): Call {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    return contract.populate("add_supported_token", { token });
  }

  buildRemoveSupportedToken(
    factoryAddress: ContractAddress,
    token: ContractAddress
  ): Call {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    return contract.populate("remove_supported_token", { token });
  }

  buildUpdateTreasury(
    factoryAddress: ContractAddress,
    newTreasury: ContractAddress
  ): Call {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    return contract.populate("update_treasury", { new_treasury: newTreasury });
  }

  buildUpdateFeePercent(
    factoryAddress: ContractAddress,
    newFeePercent: number
  ): Call {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    return contract.populate("update_fee_percent", {
      new_fee_percent: uint256.bnToUint256(newFeePercent),
    });
  }

  buildUpdateTaxPercent(
    factoryAddress: ContractAddress,
    newTaxPercent: number
  ): Call {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    return contract.populate("update_tax_percent", {
      new_tax_percent: uint256.bnToUint256(newTaxPercent),
    });
  }

  buildUpdateTimeout(
    factoryAddress: ContractAddress,
    newTimeout: number
  ): Call {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    return contract.populate("update_timeout", { new_timeout: newTimeout });
  }

  buildUpdateMinWithdrawalLimit(
    factoryAddress: ContractAddress,
    newLimit: string
  ): Call {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    return contract.populate("update_min_withdrawal_limit", {
      new_limit: uint256.bnToUint256(newLimit),
    });
  }

  buildSetPaused(factoryAddress: ContractAddress, paused: boolean): Call {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    return contract.populate("set_paused", { paused });
  }

  buildSetPOSClassHash(
    factoryAddress: ContractAddress,
    newClassHash: string
  ): Call {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    return contract.populate("set_pos_class_hash", {
      class_hash: newClassHash,
    });
  }

  // ===========================================================================
  // View / Query Functions
  // ===========================================================================

  async getPersonalPOS(
    factoryAddress: ContractAddress,
    owner: ContractAddress
  ): Promise<ContractAddress> {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    const result = await contract.personal_pos_of(owner);
    return result as ContractAddress;
  }

  async isStorePOS(
    factoryAddress: ContractAddress,
    merchant: ContractAddress,
    posAddress: ContractAddress
  ): Promise<boolean> {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    const result = await contract.is_store_pos(merchant, posAddress);
    return Boolean(result);
  }

  async getTreasury(factoryAddress: ContractAddress): Promise<ContractAddress> {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    const result = await contract.get_treasury();
    return result as ContractAddress;
  }

  async getFeePercent(factoryAddress: ContractAddress): Promise<number> {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    const result = await contract.get_fee_percent();
    return Number(uint256.uint256ToBN(result));
  }

  async getTaxPercent(factoryAddress: ContractAddress): Promise<number> {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    const result = await contract.get_tax_percent();
    return Number(uint256.uint256ToBN(result));
  }

  async getTimeout(factoryAddress: ContractAddress): Promise<number> {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    const result = await contract.get_timeout();
    return Number(result);
  }

  async getMinWithdrawalLimit(
    factoryAddress: ContractAddress
  ): Promise<string> {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    const result = await contract.get_min_withdrawal_limit();
    return uint256.uint256ToBN(result).toString();
  }

  async isPaused(factoryAddress: ContractAddress): Promise<boolean> {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    const result = await contract.is_paused();
    return Boolean(result);
  }

  async isSupportedToken(
    factoryAddress: ContractAddress,
    token: ContractAddress
  ): Promise<boolean> {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    const result = await contract.is_supported_token(token);
    return Boolean(result);
  }

  async isInitialized(factoryAddress: ContractAddress): Promise<boolean> {
    const contract = this.getContract(factoryAddress, this.FACTORY_ABI_PATH);
    // Note: If there's no direct view function, we can infer via treasury != 0
    try {
      const treasury = await this.getTreasury(factoryAddress);
      return !treasury; // treasury is set only on initialization
    } catch {
      return false;
    }
  }
}
