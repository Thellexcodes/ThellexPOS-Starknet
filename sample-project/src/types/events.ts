import { ContractAddress } from "@thellex/pos-sdk";

export interface DepositEvent {
  merchantAddress: ContractAddress;
  posAddress: ContractAddress;
  tokenAddress: ContractAddress;
  amount: string; // decimal string
  delta: bigint;
  newBalance: bigint;
  timestamp: number;
}
