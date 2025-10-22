import { Call, uint256 } from "starknet";
import { ContractAddress } from "../types";
import { AbstractThellexPOS } from "./abstracts/ThellexPOS";
import { ThellexPOSFactoryBuilder } from "./ThellexPOSFactoryBuilder";

export class ThellexPOSBuilder extends AbstractThellexPOS {
  private factoryBuilder: ThellexPOSFactoryBuilder;

  constructor(factoryBuilder: ThellexPOSFactoryBuilder) {
    super();
    this.factoryBuilder = factoryBuilder;
  }

  /**
   * Build a deposit transaction
   */
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

  /**
   * Build a transaction approval call
   */
  buildApproveTransaction(posAddress: ContractAddress, txId: string): Call {
    return {
      contractAddress: posAddress,
      entrypoint: "approve_transaction",
      calldata: [txId],
    };
  }

  /**
   * Build a transaction rejection call
   */
  buildRejectTransaction(posAddress: ContractAddress, txId: string): Call {
    return {
      contractAddress: posAddress,
      entrypoint: "reject_transaction",
      calldata: [txId],
    };
  }

  /**
   * Build an automatic refund call
   */
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

  /**
   * Build a withdrawal transaction call
   */
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

  /**
   * Retrieve deposit details from a POS contract
   */
  async getDeposit(posAddress: ContractAddress, txId: string): Promise<any> {
    const contract = await this.factoryBuilder.getContract(
      posAddress,
      "ThellexPOSV1"
    );
    const result = await contract.call("get_deposit", [txId]);

    // return {
    //   sender: num.toHex(result.sender),
    //   amount: uint256.uint256ToBN(result.amount).toString(),
    //   token: num.toHex(result.token),
    //   txId: num.toHex(result.tx_id),
    //   timestamp: BigInt(result.timestamp).toString(),
    //   approved: Boolean(result.approved),
    //   refunded: Boolean(result.refunded),
    // };
  }

  /**
   * Get balance of a given token for the POS contract
   */
  async getPOSBalance(
    posAddress: ContractAddress,
    token: ContractAddress
  ): Promise<string | any> {
    const contract = await this.factoryBuilder.getContract(
      posAddress,
      "ThellexPOSV1"
    );
    const result = await contract.call("get_balance", [token]);
    // return uint256.uint256ToBN(result.balance).toString();
  }

  /**
   * Get all pending transactions on the POS
   */
  async getPendingTransactions(posAddress: ContractAddress): Promise<any> {
    const contract = await this.factoryBuilder.getContract(
      posAddress,
      "ThellexPOSV1"
    );
    const result = await contract.call("get_pending_transactions", []);
    // return result.tx_ids.map((id: string) => num.toHex(id));
  }

  /**
   * Get owner of the POS contract
   */
  async getOwner(posAddress: ContractAddress): Promise<ContractAddress | any> {
    const contract = await this.factoryBuilder.getContract(
      posAddress,
      "ThellexPOSV1"
    );
    const result = await contract.call("get_owner", []);
    // return result.owner;
  }

  /**
   * Get current treasury address used by the POS contract
   */
  async getTreasury(
    posAddress: ContractAddress
  ): Promise<ContractAddress | any> {
    const contract = await this.factoryBuilder.getContract(
      posAddress,
      "ThellexPOSV1"
    );
    const result = await contract.call("get_treasury", []);
    // return result.treasury;
  }

  /**
   * Check if a token is supported by the POS contract
   */
  async isSupportedToken(
    posAddress: ContractAddress,
    token: ContractAddress
  ): Promise<boolean | any> {
    const contract = await this.factoryBuilder.getContract(
      posAddress,
      "ThellexPOSV1"
    );
    const result = await contract.call("is_supported_token", [token]);
    // return Boolean(result.supported);
  }
}
