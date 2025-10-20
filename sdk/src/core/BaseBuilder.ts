import {
  RpcProvider,
  Contract,
  Account,
  hash,
  Provider,
  json,
  Call,
  TransactionStatusReceiptSets,
  GetTransactionReceiptResponse,
  uint256,
} from "starknet";
import fs from "fs";
import { join } from "path";
import {
  EventCallbackData,
  ThellexFactoryEvent,
  ThellexPOSEvent,
} from "../types/events";
import { BaseBuilderConfigArgs, ContractAddress } from "../types";

export abstract class BaseBuilder {
  protected provider: Provider;
  protected contracts: Map<string, Contract> = new Map();
  public contractsPath: string;
  public factoryClassHash?: string;
  public factoryAddress?: string;
  public treasuryAddress: ContractAddress;
  public udcAddress: ContractAddress;

  constructor(config: BaseBuilderConfigArgs) {
    this.provider = new RpcProvider({ nodeUrl: config.nodeUrl });
    this.contractsPath = config.contractsPath;
    this.treasuryAddress = config.treasuryAddress;
    this.udcAddress = config.udcAddress;

    if (config.factoryContractPath) {
      const fullPath = join(this.contractsPath, config.factoryContractPath);
      this.factoryClassHash = this.computeClassHash(fullPath);
    }
  }

  /**
   * Loads a contract ABI and caches it for reuse.
   */
  protected getContract(address: string, abiPath: string): Contract {
    if (this.contracts.has(address)) {
      return this.contracts.get(address)!;
    }

    const contractArtifact = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
    const contractAbi = contractArtifact.abi;

    const contract = new Contract(contractAbi, address, this.provider);
    this.contracts.set(address, contract);
    return contract;
  }

  /**
   * Sends a transaction on-chain using a signer account.
   */
  async sendTransaction(
    account: Account,
    transaction: Call
  ): Promise<
    GetTransactionReceiptResponse<keyof TransactionStatusReceiptSets>
  > {
    const tx = await account.execute(transaction);
    const receipt = await this.provider.waitForTransaction(tx.transaction_hash);
    return receipt;
  }

  /**
   * Computes the class hash for a compiled Starknet contract JSON.
   * @param contractInput Absolute or relative path to the compiled contract JSON or the contract JSON object.
   * @returns The computed class hash as a string.
   */
  computeClassHash(contractInput: string | object): string {
    let contractJson: any;

    // If input is a string (file path), read and parse the JSON
    if (typeof contractInput === "string") {
      const contractJsonPath = contractInput;
      if (!fs.existsSync(contractJsonPath)) {
        throw new Error(`Contract JSON not found at ${contractJsonPath}`);
      }
      contractJson = JSON.parse(fs.readFileSync(contractJsonPath, "utf-8"));
    } else {
      contractJson = contractInput;
    }

    try {
      if (contractJson.program) {
        // Cairo 0 contract
        return hash.computeCompiledClassHash(contractJson.program);
      } else if (contractJson.sierra_program || contractJson.contract_class) {
        // Cairo 1 contract
        const contractClass = contractJson.contract_class || {
          sierra_program: contractJson.sierra_program,
          contract_class_version: contractJson.contract_class_version,
          entry_points_by_type: contractJson.entry_points_by_type,
          abi: contractJson.abi,
        };
        return hash.computeContractClassHash(contractClass);
      } else {
        throw new Error(
          "Invalid compiled contract JSON: Missing 'program' or 'sierra_program'/'contract_class'"
        );
      }
    } catch (error: any) {
      throw new Error(`Failed to compute class hash: ${error.message}`);
    }
  }

  async monitorEvents<T extends ThellexFactoryEvent | ThellexPOSEvent>(
    contractAddress: string,
    eventNames: T["type"][],
    callback: (eventData: EventCallbackData) => Promise<void>,
    pollInterval = 5000,
    abiFilePath?: string,
    cancelToken?: () => boolean
  ): Promise<void> {
    // Load the contract ABI
    let contract: Contract;
    if (this.contracts.has(contractAddress)) {
      contract = this.contracts.get(contractAddress)!;
    } else if (abiFilePath) {
      if (!fs.existsSync(abiFilePath)) {
        throw new Error(`ABI file not found at ${abiFilePath}`);
      }
      const contractArtifact = JSON.parse(
        fs.readFileSync(abiFilePath, "utf-8")
      );
      const contractAbi = contractArtifact.abi;
      contract = new Contract(contractAbi, contractAddress, this.provider);
      this.contracts.set(contractAddress, contract);
    } else {
      throw new Error("ABI file path required for new contract monitoring");
    }

    let lastBlockNumber: number | null = null;

    while (true) {
      if (cancelToken && cancelToken()) {
        console.log("Event monitoring cancelled");
        break;
      }

      try {
        const latestBlock = await this.provider.getBlock("latest");
        const currentBlockNumber = latestBlock.block_number;
        const blockTimestamp = latestBlock.timestamp;

        if (lastBlockNumber === null) lastBlockNumber = currentBlockNumber - 1;

        if (currentBlockNumber > lastBlockNumber) {
          for (
            let blockNum = lastBlockNumber + 1;
            blockNum <= currentBlockNumber;
            blockNum++
          ) {
            const block = await this.provider.getBlock(blockNum);
            const txReceipts: any[] = await Promise.all(
              block.transactions.map((txHash: string) =>
                this.provider.getTransactionReceipt(txHash)
              )
            );

            for (const receipt of txReceipts) {
              if (!receipt.events || receipt.events.length === 0) continue;

              for (
                let eventIndex = 0;
                eventIndex < receipt.events.length;
                eventIndex++
              ) {
                const rawEvent = receipt.events[eventIndex];

                if (
                  rawEvent.from_address.toLowerCase() !==
                  contractAddress.toLowerCase()
                )
                  continue;

                // Filter and decode only the events requested
                const eventAbi = (contract.abi as any)
                  .filter((entry: any) => entry.type === "event")
                  .find((e: any) =>
                    eventNames.some((name) => e.name.endsWith(name))
                  );

                if (!eventAbi) continue;

                const decoded: Record<string, any> = {};
                rawEvent.data.forEach((val: string, idx: number) => {
                  const field =
                    eventAbi.members?.[idx] || eventAbi.inputs?.[idx];
                  if (!field) return;
                  const name = field.name;

                  if (
                    field.type === "core::integer::u256" ||
                    field.type?.startsWith("Uint256")
                  ) {
                    decoded[name] = uint256.uint256ToBN({
                      low: BigInt(val),
                      high: BigInt(0),
                    });
                  } else {
                    decoded[name] = val;
                  }
                });

                await callback({
                  event: {
                    type: eventAbi.name.split("::").pop()!,
                    data: decoded as any,
                  },
                  metadata: {
                    transactionHash: receipt.transaction_hash,
                    blockNumber: receipt.block_number,
                    blockTimestamp,
                    eventIndex,
                  },
                });
              }
            }
          }
          lastBlockNumber = currentBlockNumber;
        }
      } catch (err: any) {
        console.error(
          `Error monitoring events for ${contractAddress}: ${err.message}`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }
}
