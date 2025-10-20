use starknet::ContractAddress;

#[event]
#[derive(Drop, starknet::Event)]
pub enum ThellexPOSEvent {
    Initialized: Initialized,
    PaymentReceived: PaymentReceived,
    BalanceCredited: BalanceCredited,
    PaymentRejected: PaymentRejected,
    AutoRefunded: AutoRefunded,
    WithdrawalExecuted: WithdrawalExecuted,
    PaymentRequestCreated: PaymentRequestCreated,
    PaymentRequestFulfilled: PaymentRequestFulfilled,
    ExternalDepositRegistered: ExternalDepositRegistered,
    RefundSent: RefundSent
}

#[derive(Drop, starknet::Event)]
pub struct Initialized {
    #[key]
    pub owner: ContractAddress,
    pub deposit_address: ContractAddress,
    pub treasury: ContractAddress,
    pub fee_percent: u256,
    pub tax_percent: u256,
    pub timeout: u64,
}

#[derive(Drop, starknet::Event)]
pub struct PaymentReceived {
    #[key]
    pub sender: ContractAddress,
    pub amount: u256,
    pub token: ContractAddress,
    pub tx_id: felt252,
}

#[derive(Drop, starknet::Event)]
pub struct BalanceCredited {
    #[key]
    pub merchant: ContractAddress,
    pub amount: u256,
    pub token: ContractAddress,
}

#[derive(Drop, starknet::Event)]
pub struct PaymentRejected {
    #[key]
    pub sender: ContractAddress,
    pub amount: u256,
    pub token: ContractAddress,
    pub tx_id: felt252,
}

#[derive(Drop, starknet::Event)]
pub struct AutoRefunded {
    #[key]
    pub sender: ContractAddress,
    pub amount: u256,
    pub tax: u256,
    pub token: ContractAddress,
    pub tx_id: felt252,
}

#[derive(Drop, starknet::Event)]
pub struct WithdrawalExecuted {
    #[key]
    pub recipient: ContractAddress,
    pub amount: u256,
    pub token: ContractAddress,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct PaymentRequest {
    pub amount: u256,
    pub token: ContractAddress,
    pub requester: ContractAddress,
    pub active: bool,
}

#[derive(Drop, starknet::Event)]
pub struct PaymentRequestCreated {
    #[key]
    pub request_id: felt252,
    pub requester: ContractAddress,
    pub amount: u256,
    pub token: ContractAddress,
}

    #[derive(Drop, starknet::Event)]
pub struct PaymentRequestFulfilled {
    #[key]
    pub request_id: felt252,
    pub sender: ContractAddress,
    pub amount: u256,
    pub token: ContractAddress,
}

#[derive(Drop, starknet::Event)]
pub struct ExternalDepositRegistered {
    #[key]
    pub sender: ContractAddress,
    pub amount: u256,
    pub token: ContractAddress,
    pub tx_id: felt252,
}

#[derive(Drop, starknet::Event)]
pub struct RefundSent{
    pub original_sender: ContractAddress,
    pub refund_receiver: ContractAddress,
    pub amount: u256,
    pub token: ContractAddress,
    pub tx_id: felt252 
}

#[starknet::interface]
pub trait IThellexPOSV1<TContractState> {
    // Initialize the POS contract
    fn initialize(
        ref self: TContractState,
        owner: ContractAddress,
        deposit_address: ContractAddress,
        treasury: ContractAddress,
        fee_percent: u256,
        tax_percent: u256,
        timeout: u64,
        factory_address: ContractAddress
    );

    // Record a payment
    fn deposit(
        ref self: TContractState,
        amount: u256,
        tx_id: felt252,
        token: ContractAddress
    );

    // fn on_tokenreceived(
    //     ref self: TContractState,
    //     sender: ContractAddress,
    //     amount: u256,
    //     token: ContractAddress
    // );

    // Approve a deposit
    fn approve_transaction(ref self: TContractState, tx_id: felt252);

    // Reject a deposit
    fn reject_transaction(ref self: TContractState, tx_id: felt252);

    // Refund unapproved deposits after timeout
    fn auto_refunded_amount(ref self: TContractState, tx_id: felt252, refund_receiver: ContractAddress);

    // Withdraw funds to a Starknet address
    fn withdraw_funds(
        ref self: TContractState,
        recipient: ContractAddress,
        amount: u256,
        token: ContractAddress
    );

    // Withdraw multiple amounts to different addresses
    fn batch_withdraw(
        ref self: TContractState,
        recipients: Array<ContractAddress>,
        amounts: Array<u256>,
        tokens: Array<ContractAddress>
    );

    // Get deposit details
    fn get_deposit(
        self: @TContractState,
        tx_id: felt252
    ) -> (ContractAddress, u256, ContractAddress, u64);

    fn balances(
      self: @TContractState,
      token: ContractAddress
    ) -> u256;

    fn register_external_deposit(
        ref self: TContractState,
        amount: u256,
        token: ContractAddress,
        sender: ContractAddress
    ) -> felt252;

    fn create_payment_request(
        ref self: TContractState,
        amount: u256,
        token: ContractAddress,
        request_id: felt252
    );

    fn fulfill_payment_request(
        ref self: TContractState,
        request_id: felt252,
        amount: u256,
        token: ContractAddress
    );
}