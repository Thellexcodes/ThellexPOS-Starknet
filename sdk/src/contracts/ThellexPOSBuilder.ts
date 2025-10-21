import { Call, num, uint256 } from "starknet";
import { BaseBuilder } from "../core/BaseBuilder";
import { ContractAddress } from "../types";
import { AbstractThellexPOS } from "./abstracts/ThellexPOS";
import { ThellexPOSFactoryBuilder } from "./ThellexPOSFactoryBuilder";

export class ThellexPOSBuilder implements AbstractThellexPOS {
  private factoryBuilder: ThellexPOSFactoryBuilder;

  constructor(factoryBuilder: ThellexPOSFactoryBuilder) {
    this.factoryBuilder = factoryBuilder;
  }

  async initializePOSContract(posAddress: ContractAddress): Promise<void> {
    this.factoryBuilder.getContract(posAddress, "ThellexPOSV1");
  }

  buildDeposit(
    posAddress: ContractAddress,
    amount: string,
    txId: string,
    token: ContractAddress
  ): Call {
    return {
      contractAddress: posAddress,
      entrypoint: "deposit",
      calldata: [...Object.values(uint256.bnToUint256(amount)), txId, token],
    };
  }

  buildApproveTransaction(posAddress: ContractAddress, txId: string): Call {
    return {
      contractAddress: posAddress,
      entrypoint: "approve_transaction",
      calldata: [txId],
    };
  }

  buildRejectTransaction(posAddress: ContractAddress, txId: string): Call {
    return {
      contractAddress: posAddress,
      entrypoint: "reject_transaction",
      calldata: [txId],
    };
  }

  buildAutoRefund(
    posAddress: ContractAddress,
    txId: string,
    refundReceiver: ContractAddress
  ): Call {
    return {
      contractAddress: posAddress,
      entrypoint: "auto_refunded_amount",
      calldata: [txId, refundReceiver],
    };
  }

  buildWithdraw(
    posAddress: ContractAddress,
    recipient: ContractAddress,
    amount: string,
    token: ContractAddress
  ): Call {
    return {
      contractAddress: posAddress,
      entrypoint: "withdraw_funds",
      calldata: [
        recipient,
        ...Object.values(uint256.bnToUint256(amount)),
        token,
      ],
    };
  }

  async getDeposit(posAddress: ContractAddress, txId: string) {
    // const contract = this.getContract(posAddress, "ThellexPOSV1");
    // const result = await contract.get_deposit(txId);
    // return {
    //   sender: num.toHex(result.sender),
    //   amount: uint256.uint256ToBN(result.amount).toString(),
    //   token: num.toHex(result.token),
    //   txId: num.toHex(result.tx_id),
    //   timestamp: result.timestamp.toString(),
    // };
  }
}
