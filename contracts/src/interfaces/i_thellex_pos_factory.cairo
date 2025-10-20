use starknet::{ContractAddress, ClassHash};

#[event]
#[derive(Drop, starknet::Event)]
pub enum ThellexPOSFactoryEvent {
    POSCreated: POSCreated,
    TokenSupportUpdated: TokenSupportUpdated,
    FactoryInitialized: FactoryInitialized
}

#[derive(Drop, starknet::Event)]
pub struct POSCreated {
    #[key]
    pub merchant: ContractAddress,
    pub pos_address: ContractAddress,
}

#[derive(Drop, starknet::Event)]
pub struct TokenSupportUpdated {
    #[key]
    pub token: ContractAddress,
    pub supported: bool,
}

#[derive(Drop, starknet::Event)]
pub struct FactoryInitialized {
    pub treasury: ContractAddress,
    pub fee_percent: u256,
    pub tax_percent: u256,
    pub timeout: u64,
    pub admin: ContractAddress,
}


#[starknet::interface]
pub trait IThellexPOSFactory<TContractState> {
     // Initialize the factory with treasury, fee, tax, and timeout
    fn initialize(
        ref self: TContractState,
        treasury: ContractAddress,
        fee_percent: u256,
        tax_percent: u256,
        timeout: u64
    );

    // Deploy a new ThellexPOSV1 contract for a merchant
    fn create_pos(
        ref self: TContractState,
        owner: ContractAddress,
        deposit_address: ContractAddress,
        pos_class_hash: ClassHash,
    ) -> ContractAddress;

    // Update treasury address for new POS instances
    fn update_treasury(ref self: TContractState, new_treasury: ContractAddress);

    // Update fee percentage for new POS instances
    fn update_fee_percent(ref self: TContractState, new_fee_percent: u256);

    // Update tax percentage for auto-refunded amounts
    fn update_tax_percent(ref self: TContractState, new_tax_percent: u256);

    // Update timeout period for auto-refunded amounts
    fn update_timeout(ref self: TContractState, new_timeout: u64);

    // Pause or unpause POS creation
    fn set_paused(ref self: TContractState, paused: bool);

    // Get current treasury address
    fn get_treasury(self: @TContractState) -> ContractAddress;

    // Get current fee percentage
    fn get_fee_percent(self: @TContractState) -> u256;

    // Get current tax percentage
    fn get_tax_percent(self: @TContractState) -> u256;

    // Get current timeout period
    fn get_timeout(self: @TContractState) -> u64;

    fn add_supported_token(ref self: TContractState, token: ContractAddress); 

    fn remove_supported_token(ref self: TContractState, token: ContractAddress);

    fn is_supported_token(
        self: @TContractState,
        token: ContractAddress
    ) -> bool;
}