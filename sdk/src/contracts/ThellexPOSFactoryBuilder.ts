import fs from "fs";
import path from "path";
import { Call, CallData, Contract, Result, uint256 } from "starknet";
import { BaseBuilder } from "../core/BaseBuilder";
import { ContractAddress, FactoryInitializeArgs } from "../types";
import { AbstractThellexPOSFactory } from "./abstracts/ThellexPOSFactory";

export class ThellexPOSFactoryBuilder
  extends BaseBuilder
  implements AbstractThellexPOSFactory
{
  // Build deployment for factory contract
  async buildFactoryDeployment(
    contractPath: string,
    constructorArgs: any[] = []
  ): Promise<Call> {
    const fullPath = path.join(this.contractsPath, contractPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Contract not found at ${fullPath}`);
    }

    const contractJson = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    const classHash = this.computeClassHash(fullPath);

    const callData = new CallData(contractJson.abi);
    const constructorCalldata = callData.compile(
      "constructor",
      constructorArgs
    );

    return {
      contractAddress: "0x1", // deploy to system address
      entrypoint: "deploy_contract",
      calldata: [classHash, ...constructorCalldata],
    };
  }

  // Initialize factory
  async buildInitializeFactoryTransaction(
    factoryAddress: ContractAddress,
    abiPath: string,
    initArgs: FactoryInitializeArgs
  ): Promise<Call> {
    const { feePercent, taxPercent, timeout } = initArgs;
    const contract = this.getContract(
      factoryAddress,
      `${this.contractsPath}/${abiPath}`
    );

    const feeUint256 = uint256.bnToUint256(feePercent);
    const taxUint256 = uint256.bnToUint256(taxPercent);

    return contract.populate("initialize", [
      this.treasuryAddress,
      feeUint256,
      taxUint256,
      timeout,
    ]);
  }

  // Create POS
  async buildCreatePOS(
    abiPath: string,
    factoryAddress: ContractAddress,
    owner: ContractAddress,
    posClassHash: string
  ): Promise<Call> {
    const contract = this.getContract(
      factoryAddress,
      `${this.contractsPath}/${abiPath}`
    );
    return contract.populate("create_pos", [owner, posClassHash]);
  }

  // Add a supported token
  buildAddSupportedToken(
    factoryAddress: ContractAddress,
    token: ContractAddress,
    abiPath: string
  ): Call {
    const contract = this.getContract(
      factoryAddress,
      `${this.contractsPath}/${abiPath}`
    );
    return contract.populate("add_supported_token", [token]);
  }

  // Remove a supported token
  buildRemoveSupportedToken(
    factoryAddress: ContractAddress,
    token: ContractAddress,
    abiPath: string
  ): Call {
    const contract = this.getContract(
      factoryAddress,
      `${this.contractsPath}/${abiPath}`
    );
    return contract.populate("remove_supported_token", [token]);
  }

  // Update treasury address
  buildUpdateTreasury(
    factoryAddress: ContractAddress,
    newTreasury: ContractAddress,
    abiPath: string
  ): Call {
    const contract = this.getContract(
      factoryAddress,
      `${this.contractsPath}/${abiPath}`
    );
    return contract.populate("update_treasury", [newTreasury]);
  }

  // Update fee percent
  buildUpdateFeePercent(
    factoryAddress: ContractAddress,
    newFeePercent: number,
    abiPath: string
  ): Call {
    const contract = this.getContract(
      factoryAddress,
      `${this.contractsPath}/${abiPath}`
    );
    const feeUint256 = uint256.bnToUint256(newFeePercent);
    return contract.populate("update_fee_percent", [feeUint256]);
  }

  // Update tax percent
  buildUpdateTaxPercent(
    factoryAddress: ContractAddress,
    newTaxPercent: number,
    abiPath: string
  ): Call {
    const contract = this.getContract(
      factoryAddress,
      `${this.contractsPath}/${abiPath}`
    );
    const taxUint256 = uint256.bnToUint256(newTaxPercent);
    return contract.populate("update_tax_percent", [taxUint256]);
  }

  // Update timeout
  buildUpdateTimeout(
    factoryAddress: ContractAddress,
    newTimeout: number,
    abiPath: string
  ): Call {
    const contract = this.getContract(
      factoryAddress,
      `${this.contractsPath}/${abiPath}`
    );
    return contract.populate("update_timeout", [newTimeout]);
  }

  // Pause/unpause factory
  buildSetPaused(
    factoryAddress: ContractAddress,
    paused: boolean,
    abiPath: string
  ): Call {
    const contract = this.getContract(
      factoryAddress,
      `${this.contractsPath}/${abiPath}`
    );
    return contract.populate("set_paused", [paused]);
  }

  // Query functions
  async getTreasury(
    factoryAddress: ContractAddress,
    abiPath: string
  ): Promise<ContractAddress> {
    const contract = this.getContract(
      factoryAddress,
      `${this.contractsPath}/${abiPath}`
    );
    const res = await contract.call("get_treasury");
    return "0x";
  }

  async getFeePercent(
    factoryAddress: ContractAddress,
    abiPath: string
  ): Promise<number> {
    const contract = this.getContract(
      factoryAddress,
      `${this.contractsPath}/${abiPath}`
    );
    const res = await contract.call("get_fee_percent");
    return 1;
  }

  async getTaxPercent(
    factoryAddress: ContractAddress,
    abiPath: string
  ): Promise<number> {
    const contract = this.getContract(
      factoryAddress,
      `${this.contractsPath}/${abiPath}`
    );
    const res = await contract.call("get_tax_percent");
    return 1;
  }

  async getTimeout(
    factoryAddress: ContractAddress,
    abiPath: string
  ): Promise<Result> {
    const contract = this.getContract(
      factoryAddress,
      `${this.contractsPath}/${abiPath}`
    );
    const res = await contract.call("get_timeout");
    return res;
  }

  async isSupportedToken(
    factoryAddress: ContractAddress,
    token: ContractAddress,
    abiPath: string
  ): Promise<boolean> {
    const contract = this.getContract(
      factoryAddress,
      `${this.contractsPath}/${abiPath}`
    );
    const res = await contract.call("is_supported_token", [token]);
    return true;
  }
}
