export class TransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionError";
  }
}

export class InvalidChainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidChainError";
  }
}