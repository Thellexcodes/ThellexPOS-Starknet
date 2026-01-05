import {
  RpcProvider,
  Contract,
  Account,
  ec,
  hash,
  num,
  BigNumberish,
  Provider,
} from "starknet";
import fs from "fs";
import path from "path";
import { BaseBuilder } from "../core/BaseBuilder";
import { FactoryBuilder } from "./FactoryBuilder";
import { ContractAddress } from "../types";

/**
 * Executor for trusted meta-transactions using OutsideExecutor contract.
 * Separates signing (user-side) from submission (backend-side).
 */
export class Executor extends BaseBuilder {
  private executorContract: Contract | undefined;
  private executorAddress: ContractAddress;

  constructor(arg: FactoryBuilder | any, executorAddress: ContractAddress) {
    // Handle both FactoryBuilder instance and raw config
    const config = arg instanceof FactoryBuilder ? arg.cloneConfig() : arg;
    super(config);
    this.executorAddress = executorAddress;
  }

  /**
   * Lazily loads the OutsideExecutor contract
   */
  private getExecutorContract(): Contract {
    if (this.executorContract) {
      return this.executorContract;
    }

    const artifactPath = path.join(this.contractsPath, "OutsideExecutor.json");
    if (!fs.existsSync(artifactPath)) {
      throw new Error(`OutsideExecutor artifact not found at ${artifactPath}`);
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    const abi = artifact.abi;

    this.executorContract = new Contract(
      abi,
      this.executorAddress,
      this.provider
    );
    return this.executorContract;
  }

  /**
   * Gets current nonce for a user from the executor contract
   */
  async getNonce(user: ContractAddress): Promise<string> {
    const contract = this.getExecutorContract();
    const result = await contract.get_nonce(user);
    return num.toHex(result as BigNumberish);
  }

  /**
   * Builds the exact message hash that matches Cairo's build_message_hash
   */
  private buildMessageHash(
    params:
      | {
          user: string;
          to: string;
          selector: string;
          calldata: string[];
          nonce: string;
        }
      | any
  ): string | any {
    // let h = hash.pedersen([params.user, params.to]);
    // h = hash.pedersen([h, params.selector]);
    // // Hash calldata sequentially
    // let calldataHash = "0";
    // for (const value of params.calldata) {
    //   calldataHash = hash.pedersen([calldataHash, value]);
    // }
    // h = hash.pedersen([h, calldataHash]);
    // // Final nonce
    // return hash.pedersen([h, params.nonce]);
  }

  /**
   * USER-SIDE: Signs a meta-transaction off-chain
   * Can be safely exposed to frontend
   */
  async signMetaTransaction(params: {
    userAccount: Account;
    to: ContractAddress;
    entrypoint: string;
    calldata: BigNumberish[];
    nonce?: string;
  }): Promise<
    | {
        user: ContractAddress;
        to: ContractAddress;
        selector: string;
        calldata: string[];
        nonce: string;
        sig_r: string;
        sig_s: string;
        y_parity: boolean;
      }
    | any
  > {
    // const user = params.userAccount.address;
    // const selector = hash.getSelectorFromName(params.entrypoint);
    // const nonce = params.nonce || (await this.getNonce(user));
    // const calldataStr = params.calldata.map((v) => num.toHex(v));
    // const messageHash = this.buildMessageHash({
    //   user,
    //   to: params.to,
    //   selector,
    //   calldata: calldataStr,
    //   nonce,
    // });
    // const { r, s, recovery } = ec.sign(
    //   params.userAccount.privateKey,
    //   messageHash
    // );
    // const y_parity = recovery === 1;
    // return {
    //   user,
    //   to: params.to,
    //   selector,
    //   calldata: calldataStr,
    //   nonce,
    //   sig_r: num.toHex(r),
    //   sig_s: num.toHex(s),
    //   y_parity,
    // };
  }

  /**
   * BACKEND-SIDE: Submits a pre-signed meta-transaction
   * Only trusted backend should have access
   */
  async submitMetaTransaction(
    backendAccount: Account,
    signedTx: {
      user: ContractAddress;
      to: ContractAddress;
      selector: string;
      calldata: string[];
      nonce: string;
      sig_r: string;
      sig_s: string;
      y_parity: boolean;
    }
  ): Promise<any> {
    const contract = this.getExecutorContract();
    contract.connect(backendAccount);

    const call = contract.populate("execute_meta_transaction", {
      user_pubkey: signedTx.user,
      to: signedTx.to,
      selector: signedTx.selector,
      calldata: signedTx.calldata,
      nonce: signedTx.nonce,
      sig_r: signedTx.sig_r,
      sig_s: signedTx.sig_s,
      y_parity: signedTx.y_parity,
    });

    console.log(`Submitting meta-tx to ${signedTx.to} -> ${signedTx.selector}`);
    const tx = await backendAccount.execute(call);
    console.log(`Meta-tx hash: ${tx.transaction_hash}`);

    const receipt = await this.provider.waitForTransaction(
      tx.transaction_hash,
      {
        retryInterval: 2000,
      }
    );

    console.log(
      `Meta-tx confirmed. Status: ${receipt.isSuccess() ? "Success" : "Failed"}`
    );
    return receipt;
  }

  /**
   * Convenience: Full flow (for backend testing)
   * Not for production frontend use
   */
  async signAndSubmit(
    userAccount: Account,
    backendAccount: Account,
    targetCall: {
      to: ContractAddress;
      entrypoint: string;
      calldata: BigNumberish[];
    }
  ) {
    const signed = await this.signMetaTransaction({
      userAccount,
      to: targetCall.to,
      entrypoint: targetCall.entrypoint,
      calldata: targetCall.calldata,
    });

    return this.submitMetaTransaction(backendAccount, {
      user: signed.user,
      to: signed.to,
      selector: signed.selector,
      calldata: signed.calldata,
      nonce: signed.nonce,
      sig_r: signed.sig_r,
      sig_s: signed.sig_s,
      y_parity: signed.y_parity,
    });
  }
}
