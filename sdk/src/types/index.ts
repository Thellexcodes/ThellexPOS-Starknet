import { BigNumberish } from "starknet";

export type ContractAddress = `0x${string}`;

export type Felt252 = BigNumberish;

export interface ChainConfig {
  nodeUrl: string;
  privateKey: string;
  accountAddress: string;
}

export interface FactoryInitializeArgs {
  feePercent: bigint | number; // e.g., 500 for 5%
  taxPercent: bigint | number; // e.g., 200 for 2%
  timeout: number; // in seconds
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
