import fs from "fs";
import path from "path";
import { Call, CallData, Contract, uint256 } from "starknet";
import { BaseBuilder } from "../core/BaseBuilder";
import { ContractAddress, FactoryInitializeArgs } from "../types";
import { AbstractThellexPOSFactory } from "./abstracts/ThellexPOSFactory";

export class ThellexPOSFactoryBuilder
  extends BaseBuilder
  implements AbstractThellexPOSFactory
{
  protected contracts: Map<string, Contract> | any;

  /**
   * Builds a deployment call for a contract.
   * @param contractPath Relative path to the compiled contract JSON file (relative to contractsPath).
   * @param constructorArgs Optional arguments for the contract constructor.
   * @returns A Call object that can be signed and executed.
   */
  async buildFactoryDeployment(
    contractPath: string,
    constructorArgs: any[] = []
  ) {
    const fullPath = path.join(this.contractsPath, contractPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Contract not found at ${fullPath}`);
    }

    const contractJson = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    const classHash = this.computeClassHash(fullPath);

    // Build the constructor calldata
    const callData = new CallData(contractJson.abi);
    const constructorCalldata = callData.compile(
      "constructor",
      constructorArgs
    );

    const call: Call = {
      contractAddress: "0x1",
      entrypoint: "deploy_contract",
      calldata: [classHash, ...constructorCalldata],
    };

    return call;
  }

  /**
   * Builds the initialize transaction for the factory contract without sending it.
   * Returns a transaction object that can later be signed and sent.
   */
  async buildInitializeFactoryTransaction(
    factoryAddress: ContractAddress,
    abiPath: string,
    initArgs: FactoryInitializeArgs
  ): Promise<Call> {
    // Destructure input args
    const { feePercent, taxPercent, timeout } = initArgs;

    // Get the contract instance
    const contract = this.getContract(
      factoryAddress,
      `${this.contractsPath}/${abiPath}`
    );

    // Convert fee and tax to uint256 format if needed
    const feeUint256 = uint256.bnToUint256(feePercent);
    const taxUint256 = uint256.bnToUint256(taxPercent);

    // Build the initialize transaction call
    const tx: Call = contract.populate("initialize", [
      this.treasuryAddress,
      feeUint256,
      taxUint256,
      timeout,
    ]);

    return tx;
  }

  buildInitialize(): Call {
    throw new Error("Method not implemented.");
  }
  buildAddSupportedToken(token: ContractAddress): Call {
    throw new Error("Method not implemented.");
  }
  buildRemoveSupportedToken(token: ContractAddress): Call {
    throw new Error("Method not implemented.");
  }
  buildCreatePOS(
    owner: ContractAddress,
    depositAddress: ContractAddress,
    posClassHash: string
  ): Call {
    throw new Error("Method not implemented.");
  }
  buildUpdateTreasury(newTreasury: ContractAddress): Call {
    throw new Error("Method not implemented.");
  }
  buildUpdateFeePercent(newFeePercent: string): Call {
    throw new Error("Method not implemented.");
  }
  buildUpdateTaxPercent(newTaxPercent: string): Call {
    throw new Error("Method not implemented.");
  }
  buildUpdateTimeout(newTimeout: string): Call {
    throw new Error("Method not implemented.");
  }
  buildSetPaused(paused: boolean): Call {
    throw new Error("Method not implemented.");
  }
  getTreasury(): Promise<ContractAddress> {
    throw new Error("Method not implemented.");
  }
  getFeePercent(): Promise<string> {
    throw new Error("Method not implemented.");
  }
  getTaxPercent(): Promise<string> {
    throw new Error("Method not implemented.");
  }
  getTimeout(): Promise<string> {
    throw new Error("Method not implemented.");
  }
  isSupportedToken(token: ContractAddress): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
}
