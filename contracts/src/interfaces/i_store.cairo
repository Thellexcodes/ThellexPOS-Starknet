use starknet::ContractAddress;

#[starknet::interface]
pub trait IStore<TState> {
    // ========================
    // CORE PAYMENT FUNCTIONS
    // ========================
    /// Anyone can pay (QR code / payment link)
    fn deposit(
      ref self: TState, 
      amount: u256, 
      tx_id: felt252, 
      token: ContractAddress,
      signer: ContractAddress,
      nonce: u64,
      deadline: u64,
      sig_r: felt252,
      sig_s: felt252
    );

    /// Manager or Owner can approve pending deposit
    fn approve_transaction(
      ref self: TState, 
      tx_id: felt252, 
      signer: ContractAddress,
      nonce: u64,
      deadline: u64,
      sig_r: felt252,
      sig_s: felt252
    );

    /// Owner only: withdraw funds directly to their safe wallet
    fn withdraw_to_owner(
        ref self: TState,
        token: ContractAddress,
        amount: u256,
        signer: ContractAddress,
        nonce: u64,
        deadline: u64,
        sig_r: felt252,
        sig_s: felt252
    );

    // ========================
    // ROLE MANAGEMENT (Owner only)
    // ========================
    fn grant_role(
        ref self: TState, 
        user: ContractAddress, 
        role: Role, 
        signer: ContractAddress,
        nonce: u64,
        deadline: u64,
        sig_r: felt252,
        sig_s: felt252
    );
    fn revoke_role(ref self: TState, user: ContractAddress);

    // ========================
    // VIEW FUNCTIONS
    // ========================
    fn owner(self: @TState) -> ContractAddress;
    fn get_role(self: @TState, user: ContractAddress) -> Role;
    fn balance_of(self: @TState, token: ContractAddress) -> u256;
    fn is_initialized(self: @TState) -> bool;

    fn get_deposit(self: @TState, tx_id: felt252) -> DepositInfo;

    // Reject a deposit
    fn reject_transaction(
      ref self: TState, 
      tx_id: felt252, 
      signer: ContractAddress,
      nonce: u64,
      deadline: u64,
      pubkey: felt252,
      sig_r: felt252,
      sig_s: felt252
    );

    // Refund unapproved deposits after timeout
    // fn auto_refund(ref self: TState, tx_id: felt252, refund_to: ContractAddress);
     fn auto_refund_signed(
        ref self: TState,
        tx_id: felt252,
        refund_to: ContractAddress,
        signer: ContractAddress,
        nonce: u64,
        deadline: u64,
        sig_r: felt252,
        sig_s: felt252
    );

    fn create_payment_request(
        ref self: TState,
        amount: u256,
        token: ContractAddress,
        request_id: felt252,
        signer: ContractAddress,
        nonce: u64,
        deadline: u64,
        sig_r: felt252,
        sig_s: felt252
    );

    fn fulfill_payment_request(
        ref self: TState,
        request_id: felt252,
        amount: u256,
        token: ContractAddress
    );

    fn register_external_deposit(
        ref self: TState,
        amount: u256,
        token: ContractAddress,
        sender: ContractAddress,
        signer: ContractAddress,
        nonce: u64,
        deadline: u64,
        sig_r: felt252,
        sig_s: felt252
    ) -> felt252;

    fn is_paused(self: @TState) -> bool;

    // Withdraw multiple amounts to different addresses
    fn batch_withdraw(
            ref self: TState,
            tokens: Array<ContractAddress>,
            amounts: Array<u256>,
            recipient: ContractAddress,
            signer: ContractAddress,
            nonce: u64,
            deadline: u64,
            pubkey: felt252,
            sig_r: felt252,
            sig_s: felt252
    );

    fn get_nonce(self: @TState, signer: ContractAddress) -> u64;

    fn test_sign_user(
            ref self: TState, 
            user: ContractAddress, 
            nonce: u64, 
            deadline: u64, 
            sig_r: felt252, 
            sig_s: felt252,
          ) -> bool;
}

// ========================
// ENUMS & STRUCTS
// ========================

#[derive(Drop, Serde, Copy,starknet::Store, PartialEq)]
pub enum Role {
    #[default]
    None,
    Cashier,
    Manager,
    Owner,
}

#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct DepositInfo {
    pub amount: u256,
    pub token: ContractAddress,
    pub sender: ContractAddress,
    pub timestamp: u64,
    pub approved: bool,
}
