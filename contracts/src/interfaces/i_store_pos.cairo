use starknet::ContractAddress;

#[starknet::interface]
pub trait IStore<TState> {
    // ========================
    // CORE PAYMENT FUNCTIONS
    // ========================
    /// Anyone can pay (QR code / payment link)
    fn deposit(ref self: TState, amount: u256, tx_id: felt252, token: ContractAddress);

    /// Manager or Owner can approve pending deposit
    fn approve_transaction(
      ref self: TState, 
      tx_id: felt252, 
      signer: ContractAddress,
      nonce: u64,
      deadline: u64,
      pubkey: felt252,
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
        pubkey: felt252,
        sig_r: felt252,
        sig_s: felt252
    );

    // ========================
    // ROLE MANAGEMENT (Owner only)
    // ========================
    fn grant_role(ref self: TState, user: ContractAddress, role: Role);
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
        pubkey: felt252,
        sig_r: felt252,
        sig_s: felt252
    );

    fn create_payment_request(
        ref self: TState,
        amount: u256,
        token: ContractAddress,
        request_id: felt252
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
        pubkey: felt252,
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

// use starknet::ContractAddress;
// #[event]
// #[derive(Drop, starknet::Event)]
// pub enum ThellexPOSEvent {
//     Initialized: Initialized,
//     PaymentReceived: PaymentReceived,
//     BalanceCredited: BalanceCredited,
//     PaymentRejected: PaymentRejected,
//     AutoRefunded: AutoRefunded,
//     WithdrawalExecuted: WithdrawalExecuted,
//     PaymentRequestCreated: PaymentRequestCreated,
//     PaymentRequestFulfilled: PaymentRequestFulfilled,
//     ExternalDepositRegistered: ExternalDepositRegistered,
//     RefundSent: RefundSent
// }

// #[derive(Drop, starknet::Event)]
// pub struct Initialized {
//     pub owner: ContractAddress,
//     pub treasury: ContractAddress,
//     pub fee_percent: u256,
//     pub tax_percent: u256,
//     pub timeout: u64,
// }

// #[derive(Drop, starknet::Event)]
// pub struct PaymentReceived {
//     #[key]
//     pub sender: ContractAddress,
//     pub amount: u256,
//     pub token: ContractAddress,
//     pub tx_id: felt252,
// }

// #[derive(Drop, starknet::Event)]
// pub struct BalanceCredited {
//     // pub merchant: ContractAddress,
//     pub amount: u256,
//     pub token: ContractAddress,
// }

// #[derive(Drop, starknet::Event)]
// pub struct PaymentRejected {
//     pub sender: ContractAddress,
//     pub amount: u256,
//     pub token: ContractAddress,
//     pub tx_id: felt252,
// }

// #[derive(Drop, starknet::Event)]
// pub struct AutoRefunded {
//     pub sender: ContractAddress,
//     pub amount: u256,
//     pub tax: u256,
//     pub token: ContractAddress,
//     pub tx_id: felt252,
// }

// #[derive(Drop, starknet::Event)]
// pub struct WithdrawalExecuted {
//     pub recipient: ContractAddress,
//     pub amount: u256,
//     pub token: ContractAddress,
// }

// #[derive(Copy, Drop, Serde, starknet::Store)]
// pub struct PaymentRequest {
//     pub amount: u256,
//     pub token: ContractAddress,
//     pub requester: ContractAddress,
//     pub active: bool,
// }

// #[derive(Drop, starknet::Event)]
// pub struct PaymentRequestCreated {
//     pub request_id: felt252,
//     pub requester: ContractAddress,
//     pub amount: u256,
//     pub token: ContractAddress,
// }

// #[derive(Drop, starknet::Event)]
// pub struct PaymentRequestFulfilled {
//     pub request_id: felt252,
//     pub sender: ContractAddress,
//     pub amount: u256,
//     pub token: ContractAddress,
// }

// #[derive(Drop, starknet::Event)]
// pub struct ExternalDepositRegistered {
//     pub sender: ContractAddress,
//     pub amount: u256,
//     pub token: ContractAddress,
//     pub tx_id: felt252,
// }

// #[derive(Drop, starknet::Event)]
// pub struct RefundSent{
//     pub original_sender: ContractAddress,
//     pub refund_receiver: ContractAddress,
//     pub amount: u256,
//     pub token: ContractAddress,
//     pub tx_id: felt252 
// }

// #[starknet::interface]
// pub trait IThellexPOSV1<TContractState> {
//     // Initialize the POS contract
//     fn initialize(
//         ref self: TContractState,
//         owner: ContractAddress,
//         treasury: ContractAddress,
//         fee_percent: u256,
//         tax_percent: u256,
//         timeout: u64,
//         min_withdrawal_limit: u256,
//         factory_address: ContractAddress
//     );

//     // Record a payment
//     fn deposit(
//         ref self: TContractState,
//         amount: u256,
//         tx_id: felt252,
//         token: ContractAddress
//     );

//     // fn on_tokenreceived(
//     //     ref self: TContractState,
//     //     sender: ContractAddress,
//     //     amount: u256,
//     //     token: ContractAddress
//     // );

//     // Approve a deposit
//     fn approve_transaction(ref self: TContractState, tx_id: felt252);

//     // Reject a deposit
//     fn reject_transaction(ref self: TContractState, tx_id: felt252);

//     // Refund unapproved deposits after timeout
//     fn auto_refunded_amount(ref self: TContractState, tx_id: felt252, refund_receiver: ContractAddress);

//     // Withdraw funds to a Starknet address
//     fn withdraw_funds(
//         ref self: TContractState,
//         recipient: ContractAddress,
//         amount: u256,
//         token: ContractAddress
//     );

//     // Withdraw multiple amounts to different addresses
//     fn batch_withdraw(
//         ref self: TContractState,
//         recipients: Array<ContractAddress>,
//         amounts: Array<u256>,
//         tokens: Array<ContractAddress>
//     );

//     // Get deposit details
//     fn get_deposit(
//         self: @TContractState,
//         tx_id: felt252
//     ) -> (ContractAddress, u256, ContractAddress, u64);

//     fn balances(
//       self: @TContractState,
//       token: ContractAddress
//     ) -> u256;

//     fn register_external_deposit(
//         ref self: TContractState,
//         amount: u256,
//         token: ContractAddress,
//         sender: ContractAddress
//     ) -> felt252;

//     fn create_payment_request(
//         ref self: TContractState,
//         amount: u256,
//         token: ContractAddress,
//         request_id: felt252
//     );

//     fn fulfill_payment_request(
//         ref self: TContractState,
//         request_id: felt252,
//         amount: u256,
//         token: ContractAddress
//     );

//     fn get_min_withdrawal_limit(ref self: TContractState) -> u256;
// }