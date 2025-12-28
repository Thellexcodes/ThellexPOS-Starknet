import { BigNumberish } from "starknet";
import { EventCallbackData, EventName, POSEvent } from "./events";

export type ContractAddress = `0x${string}`;

export type Felt252 = BigNumberish;

export interface ChainConfig {
  nodeUrl: string;
  privateKey: string;
  accountAddress: string;
}

export interface FactoryInitializeArgs {
  treasury: string; // ContractAddress
  feePercent: bigint | number; // u256
  taxPercent: bigint | number; // u256
  timeout: bigint | number; // u64
  minWithdrawalLimit: bigint | number; // u256
}

export interface BaseBuilderConfigArgs {
  treasuryAddress: ContractAddress;
  nodeUrl: string;
  contractsPath: string;
  factoryContractPath?: string;
  udcAddress: ContractAddress;
}

export interface POSConstructorArgs {
  owner: ContractAddress;
  treasury: string;
  fee_percent: number;
  tax_percent: number;
  timeout: number;
  factory_address: ContractAddress;
}

export type POSType = "personal" | "store";

export interface MonitorEventsOptions<T extends EventName> {
  contractAddress: string;
  eventNames: T[];
  callback: (
    eventData: EventCallbackData<Extract<POSEvent, { type: T }>>
  ) => Promise<void>;

  abiFilePath?: string;
  pollInterval?: number;
  cancelToken?: () => boolean;
}

export interface BuildCreatePOSArgs {
  factoryAddress: ContractAddress;
  type: "personal" | "store";
  owner?: ContractAddress;
  merchant?: ContractAddress;
  storeName?: string;
}
