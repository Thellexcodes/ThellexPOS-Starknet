import EventEmitter from "events";

export const depositDetector = new EventEmitter();

export enum SELECTORS {
  // ========================
  // CORE PAYMENT FUNCTIONS
  // ========================
  deposit = "deposit",

  approve_transaction = "approve_transaction",

  withdraw_to_owner = "withdraw_to_owner",

  // ========================
  // ROLE MANAGEMENT
  // ========================
  grant_role = "grant_role",
  revoke_role = "revoke_role",

  // ========================
  // VIEW FUNCTIONS
  // ========================
  owner = "owner",
  get_role = "get_role",
  balance_of = "balance_of",
  is_initialized = "is_initialized",
  get_deposit = "get_deposit",

  // ========================
  // TRANSACTION CONTROL
  // ========================
  reject_transaction = "reject_transaction",

  auto_refund_signed = "auto_refund_signed",

  // ========================
  // PAYMENT REQUESTS
  // ========================
  create_payment_request = "create_payment_request",
  fulfill_payment_request = "fulfill_payment_request",

  register_external_deposit = "register_external_deposit",

  // ========================
  // SYSTEM / STATE
  // ========================
  is_paused = "is_paused",

  batch_withdraw = "batch_withdraw",

  get_nonce = "get_nonce",

  // ========================
  // SIGNATURE / TESTING
  // ========================
  test_sign_user = "test_sign_user",
}
