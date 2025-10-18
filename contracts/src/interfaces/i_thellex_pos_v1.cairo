use starknet::ContractAddress;

// -----------------
// Events
// -----------------
#[event]
#[derive(Drop, starknet::Event)]
pub enum ThellexPOSEvent {
    Initialized: Initialized,
    PaymentReceived: PaymentReceived,
    BalanceCredited: BalanceCredited,
    PaymentRejected: PaymentRejected,
    AutoRefunded: AutoRefunded,
    WithdrawalExecuted: WithdrawalExecuted,
    Bridged: Bridged,
    SwapExecuted: SwapExecuted,
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

#[derive(Drop, starknet::Event)]
pub struct Bridged {
    #[key]
    pub recipient: ContractAddress,
    pub amount: u256,
    pub token: ContractAddress,
    pub target_chain: felt252,
}

#[derive(Drop, starknet::Event)]
pub struct SwapExecuted {
    #[key]
    pub merchant: ContractAddress,
    pub from_token: ContractAddress,
    pub to_token: ContractAddress,
    pub amount_in: u256,
    pub amount_out: u256,
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
    fn auto_refunded_amount(ref self: TContractState, tx_id: felt252);

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

    // // Bridge funds to another chain
    // fn bridge_funds(
    //     ref self: TContractState,
    //     amount: u256,
    //     target_chain: felt252,
    //     recipient: ContractAddress,
    //     token: ContractAddress
    // );

    // // Swap tokens to merchant's preferred token
    // fn swap_tokens(
    //     ref self: TContractState,
    //     amount: u256,
    //     from_token: ContractAddress,
    //     to_token: ContractAddress
    // );

    // Get deposit details
    fn get_deposit(
        self: @TContractState,
        tx_id: felt252
    ) -> (ContractAddress, u256, ContractAddress, u64);

    fn balances(
      self: @TContractState,
      token: ContractAddress
    ) -> u256;

}