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
  FactoryEvent,
  StoreEvent,
  POSEvent,
  EventName,
} from "../types/events";
import { BaseBuilderConfigArgs, ContractAddress } from "../types";

export abstract class BaseBuilder {
  protected config: BaseBuilderConfigArgs;
  protected provider: Provider;
  protected contracts: Map<string, Contract> = new Map();
  public contractsPath: string;
  public factoryClassHash?: string;
  public factoryAddress?: string;
  public treasuryAddress: ContractAddress;
  public udcAddress: ContractAddress;

  constructor(config: BaseBuilderConfigArgs) {
    this.config = config;
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
  getContract(address: string, abiPath: string): Contract {
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

  /**
   * Efficient real-time event monitor using getBlockWithReceipts (single RPC call per block)
   * Minimal CPU/RAM usage, fast detection, auto-cancel support.
   */
  async monitorEvents<T extends EventName>(
    contractAddress: string,
    eventNames: T[],
    callback: (
      eventData: EventCallbackData<Extract<POSEvent, { type: T }>>
    ) => Promise<void>,
    pollInterval = 4000,
    abiFilePath?: string,
    cancelToken?: () => boolean
  ): Promise<void> {
    // Normalize address for comparison
    const normalizedAddress = contractAddress.toLowerCase();

    // Load and cache contract with ABI
    let contract: Contract;
    if (this.contracts.has(normalizedAddress)) {
      contract = this.contracts.get(normalizedAddress)!;
    } else if (abiFilePath) {
      const fullPath = join(this.contractsPath, abiFilePath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`ABI file not found: ${fullPath}`);
      }
      const artifact = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      contract = new Contract(artifact.abi, contractAddress, this.provider);
      this.contracts.set(normalizedAddress, contract);
    } else {
      throw new Error("ABI file path required for first-time monitoring");
    }

    let lastProcessedBlock = await this.getLatestBlockNumber();

    console.log(
      `🚀 Event monitor started for ${this.shortenAddress(contractAddress)}`
    );
    console.log(`   Listening for: ${eventNames.join(", ")}`);

    while (!(cancelToken && cancelToken())) {
      try {
        const latestBlockNumber = await this.getLatestBlockNumber();

        if (latestBlockNumber <= lastProcessedBlock) {
          await this.sleep(pollInterval);
          continue;
        }

        // Process only new blocks
        for (
          let blockNum = lastProcessedBlock + 1;
          blockNum <= latestBlockNumber;
          blockNum++
        ) {
          try {
            // ONE efficient RPC call: gets events directly
            const block = await this.provider.getBlockWithReceipts(blockNum);
            console.log({ block });

            //   for (const receipt of block.transaction_receipts) {
            //   if (!("events" in receipt) || !receipt.events?.length) continue;

            //   for (let i = 0; i < receipt.events.length; i++) {
            //     const rawEvent = receipt.events[i];

            //     // Fast address filter
            //     if (rawEvent.from_address.toLowerCase() !== normalizedAddress)
            //       continue;

            //     try {
            //       const parsed = contract.parseEvent(rawEvent);

            //       // Fast name check
            //       if (!eventNames.includes(parsed.name as T["type"])) continue;

            //       // Fire callback
            //       await callback({
            //         event: {
            //           type: parsed.name as T["type"],
            //           data: parsed.data,
            //         },
            //         metadata: {
            //           transactionHash: receipt.transaction_hash,
            //           blockNumber: blockNum,
            //           blockTimestamp:
            //             block.block_timestamp ??
            //             block.timestamp ??
            //             Date.now() / 1000,
            //           eventIndex: i,
            //         },
            //       });
            //     } catch (parseErr) {
            //       // Silently skip malformed events — rare but possible on devnet
            //     }
            //   }
            // }
          } catch (blockErr: any) {
            // Single block failure shouldn't stop monitoring
            console.warn(
              `Failed to process block ${blockNum}: ${blockErr.message}`
            );
          }
        }

        // Update only after successful processing
        lastProcessedBlock = latestBlockNumber;
      } catch (networkErr: any) {
        console.warn(
          `Network error during monitoring: ${networkErr.message}. Retrying...`
        );
        await this.sleep(pollInterval * 1.5); // Backoff slightly on error
      }
    }

    console.log(
      `🛑 Event monitor stopped for ${this.shortenAddress(contractAddress)}`
    );
  }

  // Helper: efficient latest block fetch (cached where possible)
  async getLatestBlockNumber(): Promise<number> {
    const block = await this.provider.getBlock("latest");
    return block.block_number;
  }

  // Efficient sleep utility
  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Optional: address shortener for logs
  shortenAddress(addr: string): string {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  // async monitorEvents<T extends FactoryEvent | StoreEvent>(
  //   contractAddress: string,
  //   eventNames: T["type"][],
  //   callback: (eventData: EventCallbackData) => Promise<void>,
  //   pollInterval = 5000,
  //   abiFilePath?: string,
  //   cancelToken?: () => boolean
  // ): Promise<void> {
  //   // Load the contract ABI
  //   let contract: Contract;
  //   if (this.contracts.has(contractAddress)) {
  //     contract = this.contracts.get(contractAddress)!;
  //   } else if (abiFilePath) {
  //     if (!fs.existsSync(abiFilePath)) {
  //       throw new Error(`ABI file not found at ${abiFilePath}`);
  //     }
  //     const contractArtifact = JSON.parse(
  //       fs.readFileSync(abiFilePath, "utf-8")
  //     );
  //     const contractAbi = contractArtifact.abi;
  //     contract = new Contract(contractAbi, contractAddress, this.provider);
  //     this.contracts.set(contractAddress, contract);
  //   } else {
  //     throw new Error("ABI file path required for new contract monitoring");
  //   }

  //   let lastBlockNumber: number | null = null;

  //   while (true) {
  //     if (cancelToken && cancelToken()) {
  //       console.log("Event monitoring cancelled");
  //       break;
  //     }

  //     try {
  //       const latestBlock = await this.provider.getBlock("latest");
  //       const currentBlockNumber = latestBlock.block_number;
  //       const blockTimestamp = latestBlock.timestamp;

  //       if (lastBlockNumber === null) lastBlockNumber = currentBlockNumber - 1;

  //       if (currentBlockNumber > lastBlockNumber) {
  //         for (
  //           let blockNum = lastBlockNumber + 1;
  //           blockNum <= currentBlockNumber;
  //           blockNum++
  //         ) {
  //           const block = await this.provider.getBlock(blockNum);
  //           const txReceipts: any[] = await Promise.all(
  //             block.transactions.map((txHash: string) =>
  //               this.provider.getTransactionReceipt(txHash)
  //             )
  //           );

  //           for (const receipt of txReceipts) {
  //             if (!receipt.events || receipt.events.length === 0) continue;

  //             for (
  //               let eventIndex = 0;
  //               eventIndex < receipt.events.length;
  //               eventIndex++
  //             ) {
  //               const rawEvent = receipt.events[eventIndex];

  //               if (
  //                 rawEvent.from_address.toLowerCase() !==
  //                 contractAddress.toLowerCase()
  //               )
  //                 continue;

  //               // Filter only requested events
  //               const eventAbi = (contract.abi as any)
  //                 .filter((entry: any) => entry.type === "event")
  //                 .find((e: any) =>
  //                   eventNames.some((name) => e.name.endsWith(name))
  //                 );
  //               if (!eventAbi) continue;

  //               const decoded: Record<string, any> = {};

  //               // Decode key fields
  //               if (rawEvent.keys && rawEvent.keys.length > 0) {
  //                 eventAbi.members?.forEach((field: any, idx: number) => {
  //                   if (field.key) {
  //                     decoded[field.name] = rawEvent.keys[idx];
  //                   }
  //                 });
  //               }

  //               // Decode data fields (non-key)
  //               rawEvent.data.forEach((val: string, idx: number) => {
  //                 const field =
  //                   eventAbi.members?.[idx] || eventAbi.inputs?.[idx];
  //                 if (!field || field.key) return; // skip key fields here
  //                 const name = field.name;

  //                 if (
  //                   field.type === "core::integer::u256" ||
  //                   field.type?.startsWith("Uint256")
  //                 ) {
  //                   decoded[name] = uint256.uint256ToBN({
  //                     low: BigInt(val),
  //                     high: BigInt(0),
  //                   });
  //                 } else {
  //                   decoded[name] = val;
  //                 }
  //               });

  //               await callback({
  //                 event: {
  //                   type: eventAbi.name.split("::").pop()!,
  //                   data: decoded as any,
  //                 },
  //                 metadata: {
  //                   transactionHash: receipt.transaction_hash,
  //                   blockNumber: receipt.block_number,
  //                   blockTimestamp,
  //                   eventIndex,
  //                 },
  //               });
  //             }
  //           }
  //         }
  //         lastBlockNumber = currentBlockNumber;
  //       }
  //     } catch (err: any) {
  //       console.error(
  //         `Error monitoring events for ${contractAddress}: ${err.message}`
  //       );
  //     }

  //     await new Promise((resolve) => setTimeout(resolve, pollInterval));
  //   }
  // }
}
