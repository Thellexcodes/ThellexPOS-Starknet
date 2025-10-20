import { Account, Call } from "starknet";
import { ContractAddress } from "../../types";
import { ThellexPOSEvent } from "../../types/events";

export abstract class AbstractThellexPOS {
  abstract initializePOSContract(posAddress: ContractAddress): void;

  abstract buildDeposit(
    posAddress: ContractAddress,
    amount: string,
    txId: string,
    token: ContractAddress
  ): Call;

  abstract buildApproveTransaction(
    posAddress: ContractAddress,
    txId: string
  ): Call;

  abstract buildRejectTransaction(
    posAddress: ContractAddress,
    txId: string
  ): Call;

  abstract buildAutoRefund(
    posAddress: ContractAddress,
    txId: string,
    refundReceiver: ContractAddress
  ): Call;

  abstract buildWithdraw(
    posAddress: ContractAddress,
    recipient: ContractAddress,
    amount: string,
    token: ContractAddress
  ): Call;

  abstract getDeposit(posAddress: ContractAddress, txId: string): Promise<any>;
}
