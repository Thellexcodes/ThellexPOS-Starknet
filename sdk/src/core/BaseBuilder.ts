import {
  RpcProvider,
  Contract,
  Account,
  hash,
  Provider,
  Call,
  TransactionStatusReceiptSets,
  GetTransactionReceiptResponse,
  WebSocketChannel,
  num,
  events,
  CallData,
} from "starknet";
import fs from "fs";
import { join } from "path";
import { POSEvent, EventName } from "../types/events";
import { Utils } from "../utils/utils";
import {
  BaseBuilderConfigArgs,
  ContractAddress,
  MonitorEventsOptions,
} from "../types";

export abstract class BaseBuilder {
  // Core configuration and provider
  protected config: BaseBuilderConfigArgs;
  protected provider: Provider;
  // Cached contracts to avoid repeated instantiation
  protected contracts: Map<string, Contract> = new Map();
  // Paths and pre-computed values
  public contractsPath: string;
  public factoryClassHash?: string;
  public factoryAddress?: string;
  public treasuryAddress: ContractAddress;
  public udcAddress: ContractAddress;
  // Tracks active WebSocket event subscriptions per contract address
  private activeSubscriptions: Map<
    string,
    { channel: WebSocketChannel; subscription: any }
  > = new Map();

  /**
   * Initializes the base builder with configuration.
   * Sets up the RPC provider and optionally pre-computes the factory class hash.
   */
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
   * Returns an existing Contract instance if the address was already loaded.
   */
  getContract(address: string, abiPath: string): Contract {
    if (this.contracts.has(address)) {
      return this.contracts.get(address)!;
    }

    const contractArtifact = JSON.parse(
      fs.readFileSync(`${this.contractsPath}/${abiPath}`, "utf-8")
    );

    const contractAbi = contractArtifact.abi;

    const contract = new Contract(contractAbi, address, this.provider);
    this.contracts.set(address, contract);
    return contract;
  }

  /**
   * Sends a transaction on-chain using a signer account.
   * Executes the call and waits for the transaction receipt.
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
   * Efficient real-time event monitor using WebSocket subscription.
   * Subscribes to specific events on a contract and invokes the callback for each emitted event.
   * Supports cancellation and prevents duplicate subscriptions.
   */
  async monitorEvents<T extends EventName>({
    contractAddress,
    eventNames,
    callback,
    abiFilePath,
    pollInterval = 4000, // unused in current WebSocket implementation
    cancelToken,
  }: MonitorEventsOptions<T>): Promise<void> {
    const normalizedAddress = contractAddress.toLowerCase();

    // Prevent duplicate monitoring – throws to allow SDK users to handle it
    if (this.activeSubscriptions.has(normalizedAddress)) {
      throw new Error(
        `Already monitoring events for ${this.shortenAddress(contractAddress)}.`
      );
    }

    // -------------------- Load ABI --------------------
    const fullPath = join(this.contractsPath, `${abiFilePath}`);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`ABI file not found: ${fullPath}`);
    }

    const artifact = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    const abi = artifact.abi;

    // -------------------- Contract caching --------------------
    let contract: Contract;
    if (this.contracts.has(normalizedAddress)) {
      contract = this.contracts.get(normalizedAddress)!;
    } else {
      contract = new Contract(abi, contractAddress, this.provider);
      this.contracts.set(normalizedAddress, contract);
    }

    // -------------------- Event keys for subscription --------------------
    const keys: string[][] = eventNames.map((name) => [
      num.toHex(hash.starknetKeccak(name)),
    ]);

    // -------------------- WebSocket channel --------------------
    const channel = new WebSocketChannel({
      nodeUrl: this.normalizeWsUrl(this.config.nodeUrl),
      autoReconnect: true,
      reconnectOptions: { retries: 10, delay: 2000 },
      requestTimeout: 60000,
      maxBufferSize: 1000,
    });

    let subscription: any | null = null;

    try {
      // -------------------- Connect --------------------
      await channel.waitForConnection();

      // Small delay to avoid race conditions on some nodes
      await new Promise((r) => setTimeout(r, 500));

      // -------------------- Subscribe --------------------
      subscription = await channel.subscribeEvents(contractAddress, keys);
      this.activeSubscriptions.set(normalizedAddress, {
        channel,
        subscription,
      });

      // -------------------- Event handling --------------------
      subscription.on(async (eventData: any) => {
        if (cancelToken && cancelToken()) return;

        // Skip subscription-level errors silently
        if (eventData?.error) {
          return;
        }

        // Raw event in format expected by parseEvents
        const rawEvent = {
          from_address: eventData.from_address,
          keys: eventData.keys,
          data: eventData.data,
        };

        // Get ABI helpers for parsing
        const abiEvents = events.getAbiEvents(abi);
        const abiStructs = CallData.getAbiStruct(abi);
        const abiEnums = CallData.getAbiEnum(abi);

        // Parse the event using starknet.js utilities
        const parsedEvents = events.parseEvents(
          [rawEvent as any],
          abiEvents,
          abiStructs,
          abiEnums
        );

        if (parsedEvents.length === 0) {
          return;
        }

        const parsed = parsedEvents[0];
        const [eventName, eventDataObj] = Object.entries(parsed)[0] as [
          string,
          any
        ];

        const normalizedData = Utils.normalizeEventData(eventDataObj);
        const type = Utils.getEventType(eventName);

        // Invoke user-provided callback with structured event data
        await callback({
          event: {
            type,
            data: normalizedData as any,
          } as Extract<POSEvent, { type: T }>,
          metadata: {
            transactionHash: eventData.transaction_hash,
            blockNumber: eventData.block_number ?? -1,
            blockTimestamp:
              eventData.block_timestamp ?? Math.floor(Date.now() / 1000),
            eventIndex: -1,
          },
        });
      });

      // Keep the monitor alive indefinitely until cancelled or errored
      await new Promise(() => {});
    } catch (error: any) {
      // Cleanup on failure
      if (subscription) {
        try {
          await subscription.unsubscribe();
        } catch {}
      }
      channel.disconnect();

      this.activeSubscriptions.delete(normalizedAddress);
      throw error;
    }
  }

  /**
   * Unsubscribes from events for a specific contract address.
   * Performs best-effort cleanup of subscription and WebSocket channel.
   */
  async unsubscribeFromEvents(contractAddress: string): Promise<void> {
    const normalizedAddress = contractAddress.toLowerCase();
    const sub = this.activeSubscriptions.get(normalizedAddress);

    if (!sub) return;

    try {
      if (sub.subscription) {
        await sub.subscription.unsubscribe();
      }
    } catch (e) {
      // Silent – best effort
    }

    try {
      sub.channel.disconnect();
      await sub.channel.waitForDisconnection();
    } catch (e) {
      // Silent – best effort
    }

    this.activeSubscriptions.delete(normalizedAddress);
  }

  /**
   * Unsubscribes from all active event monitors.
   * Waits for all unsubscriptions to settle.
   */
  async unsubscribeFromAllEvents(): Promise<void> {
    const promises = Array.from(this.activeSubscriptions.keys()).map((addr) =>
      this.unsubscribeFromEvents(addr)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Retrieves the latest block number from the network.
   */
  async getLatestBlockNumber(): Promise<number> {
    const block = await this.provider.getBlock("latest");
    return block.block_number;
  }

  /**
   * Utility sleep function.
   */
  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Shortens a Starknet address for display purposes.
   */
  shortenAddress(addr: string): string {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  /**
   * Normalizes an HTTP/HTTPS node URL to a WebSocket URL ending with /ws.
   */
  normalizeWsUrl(url: string): string {
    let wsUrl = url;

    if (!wsUrl.startsWith("ws")) {
      wsUrl = wsUrl
        .replace(/^http:\/\//, "ws://")
        .replace(/^https:\/\//, "wss://");
    }

    if (!wsUrl.endsWith("/ws")) {
      wsUrl = `${wsUrl.replace(/\/$/, "")}/ws`;
    }

    return wsUrl;
  }
}
