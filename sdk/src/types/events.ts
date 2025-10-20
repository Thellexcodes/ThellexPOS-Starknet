import { Uint256 } from "starknet";
import { ContractAddress } from ".";

// -----------------------
// Factory Events
// -----------------------
export interface Initialized {
  owner: string;
  deposit_address: ContractAddress;
  treasury: ContractAddress;
  fee_percent: Uint256;
  tax_percent: Uint256;
  timeout: number;
}

export interface FactoryInitializedEvent {
  treasury: string;
  fee_percent: { low: number; high: number };
  tax_percent: { low: number; high: number };
  timeout: number;
  admin: string;
}

export interface POSCreatedEvent {
  merchant: ContractAddress;
  pos_address: ContractAddress;
}

export interface TokenSupportUpdatedEvent {
  token: ContractAddress;
  supported: boolean;
}

export type ThellexFactoryEvent =
  | { type: "FactoryInitialized"; data: FactoryInitializedEvent }
  | { type: "POSCreated"; data: POSCreatedEvent }
  | { type: "TokenSupportUpdated"; data: TokenSupportUpdatedEvent };

// -----------------------
// POS Events
// -----------------------
export interface PaymentReceived {
  sender: ContractAddress;
  amount: Uint256;
  token: ContractAddress;
  tx_id: string;
}

export interface BalanceCredited {
  merchant: ContractAddress;
  amount: Uint256;
  token: ContractAddress;
}

export interface PaymentRejected {
  sender: ContractAddress;
  amount: Uint256;
  token: ContractAddress;
  tx_id: string;
}

export interface AutoRefunded {
  sender: ContractAddress;
  amount: Uint256;
  tax: Uint256;
  token: ContractAddress;
  tx_id: string;
}

export interface WithdrawalExecuted {
  recipient: ContractAddress;
  amount: Uint256;
  token: ContractAddress;
}

export interface PaymentRequestCreated {
  request_id: string;
  requester: ContractAddress;
  amount: Uint256;
  token: ContractAddress;
}

export interface PaymentRequestFulfilled {
  request_id: string;
  sender: ContractAddress;
  amount: Uint256;
  token: ContractAddress;
}

export interface ExternalDepositRegistered {
  sender: ContractAddress;
  amount: Uint256;
  token: ContractAddress;
  tx_id: string;
}

export interface RefundSent {
  original_sender: ContractAddress;
  refund_receiver: ContractAddress;
  amount: Uint256;
  token: ContractAddress;
  tx_id: string;
}

export interface DepositEvent {
  sender: ContractAddress;
  amount: Uint256;
  token: ContractAddress;
  tx_id: string;
  timestamp: number;
}

export interface RefundSentEvent {
  original_sender: ContractAddress;
  refund_receiver: ContractAddress;
  amount: Uint256;
  token: ContractAddress;
  tx_id: string;
}

export type ThellexPOSEvent =
  | { type: "Deposit"; data: DepositEvent }
  | { type: "RefundSent"; data: RefundSentEvent };

// -----------------------
// Event Callback Interface
// -----------------------
export interface EventCallbackData<
  T extends ThellexFactoryEvent | ThellexPOSEvent =
    | ThellexFactoryEvent
    | ThellexPOSEvent
> {
  event: T;
  metadata: {
    transactionHash: string;
    blockNumber: number;
    blockTimestamp: number;
    eventIndex: number;
  };
}
