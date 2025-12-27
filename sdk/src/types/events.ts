import { Uint256 } from "starknet";
import { ContractAddress } from ".";

// -----------------------
// Factory Events
// -----------------------
export interface FactoryInitializedEvent {
  admin: string; // ContractAddress
  treasury: string; // ContractAddress
}

export interface PersonalPOSCreatedEvent {
  ownerAddress: string; // ContractAddress
  pos_address: string; // ContractAddress
}

export interface StorePOSCreatedEvent {
  merchant: string; // ContractAddress
  pos_address: string; // ContractAddress
  store_name: string; // ByteArray → decoded as string
}

export interface TokenSupportUpdatedEvent {
  token: string; // ContractAddress
  supported: boolean;
}

export interface PausedEvent {
  account: string; // ContractAddress (who paused)
}

export interface UnpausedEvent {
  account: string; // ContractAddress (who unpaused)
}

export type FactoryEvent =
  | { type: "FactoryInitialized"; data: FactoryInitializedEvent }
  | { type: "PersonalPOSCreated"; data: PersonalPOSCreatedEvent }
  | { type: "StorePOSCreated"; data: StorePOSCreatedEvent }
  | { type: "TokenSupportUpdated"; data: TokenSupportUpdatedEvent }
  | { type: "Paused"; data: PausedEvent }
  | { type: "Unpaused"; data: UnpausedEvent };

// -----------------------
// POS (Store) Events
// -----------------------
export interface InitializedEvent {
  owner: string; // ContractAddress
  treasury: string; // ContractAddress
}

export interface PaymentReceivedEvent {
  sender: string;
  amount: { low: bigint; high: bigint }; // u256
  token: string;
  tx_id: string; // felt252 → hex string
}

export interface BalanceCreditedEvent {
  amount: { low: bigint; high: bigint };
  token: string;
}

export interface PaymentRejectedEvent {
  sender: string;
  amount: { low: bigint; high: bigint };
  token: string;
  tx_id: string;
}

export interface AutoRefundedEvent {
  sender: string;
  amount: { low: bigint; high: bigint };
  tax: { low: bigint; high: bigint };
  token: string;
  tx_id: string;
}

export interface WithdrawalToOwnerEvent {
  amount: { low: bigint; high: bigint };
  token: string;
}

export interface PaymentRequestCreatedEvent {
  request_id: string; // felt252
  requester: string;
  amount: { low: bigint; high: bigint };
  token: string;
}

export interface PaymentRequestFulfilledEvent {
  request_id: string;
  sender: string;
  amount: { low: bigint; high: bigint };
  token: string;
}

export interface ExternalDepositRegisteredEvent {
  sender: string;
  amount: { low: bigint; high: bigint };
  token: string;
  tx_id: string;
}

export interface RefundSentEvent {
  original_sender: string;
  refund_receiver: string;
  amount: { low: bigint; high: bigint };
  token: string;
  tx_id: string;
}

export interface RoleGrantedEvent {
  user: string;
  role: string; // Role enum → felt252 → usually hex string
  granted_by: string;
}

export interface RoleRevokedEvent {
  user: string;
  role: string;
  revoked_by: string;
}

export type StoreEvent =
  | { type: "Initialized"; data: InitializedEvent }
  | { type: "PaymentReceived"; data: PaymentReceivedEvent }
  | { type: "BalanceCredited"; data: BalanceCreditedEvent }
  | { type: "PaymentRejected"; data: PaymentRejectedEvent }
  | { type: "AutoRefunded"; data: AutoRefundedEvent }
  | { type: "WithdrawalToOwner"; data: WithdrawalToOwnerEvent }
  | { type: "PaymentRequestCreated"; data: PaymentRequestCreatedEvent }
  | { type: "PaymentRequestFulfilled"; data: PaymentRequestFulfilledEvent }
  | { type: "ExternalDepositRegistered"; data: ExternalDepositRegisteredEvent }
  | { type: "RefundSent"; data: RefundSentEvent }
  | { type: "RoleGranted"; data: RoleGrantedEvent }
  | { type: "RoleRevoked"; data: RoleRevokedEvent };

// -----------------------
// Unified Event Types
// -----------------------
export type POSEvent = FactoryEvent | StoreEvent;

// Extract valid event type strings for use in monitorEvents
export type EventName = POSEvent["type"];

// -----------------------
// Event Callback Interface
// -----------------------
export interface EventCallbackData<T extends POSEvent = POSEvent> {
  event: T;
  metadata: {
    transactionHash: string;
    blockNumber: number;
    blockTimestamp: number;
    eventIndex: number;
  };
}
