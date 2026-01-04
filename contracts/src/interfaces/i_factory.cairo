use starknet::{ContractAddress, ClassHash};

#[derive(Drop, starknet::Event)]
pub struct FactoryInitialized {
    #[key]
    pub admin: ContractAddress,
    pub treasury: ContractAddress,
    pub fee_percent: u256,
    pub tax_percent: u256,
    pub timeout: u64,
}

#[derive(Drop, starknet::Event)]
pub struct PersonalPOSCreated {
    #[key]
    pub merchant: ContractAddress,
    pub pos_address: ContractAddress,
}

#[derive(Drop, starknet::Event)]
pub struct POSCreated {
    #[key]
    pub merchant: ContractAddress,
    #[key]
    pub pos_address: ContractAddress,
    pub store_name: ByteArray,
}

#[derive(Drop, starknet::Event)]
pub struct TokenSupportUpdated {
    #[key]
    pub token: ContractAddress,
    pub supported: bool,
}

#[starknet::interface]
pub trait IFactory<TState> {
    // ========================
    // INITIALIZATION
    // ========================
    fn initialize(
        ref self: TState,
        treasury: ContractAddress,
        fee_percent: u256,
        tax_percent: u256,
        timeout: u64,
        min_withdrawal_limit: u256
    );

    // ========================
    // POS CREATION
    // ========================
    /// Creates merchant's personal POS (can only be done once)
    fn create_personal_pos(ref self: TState, ownerAddress: ContractAddress) -> ContractAddress;

    /// Creates a new physical store POS (unlimited)
    fn create_store_pos(ref self: TState, store_name: ByteArray, merchant: ContractAddress) -> ContractAddress;

    // ========================
    // VIEW FUNCTIONS
    // ========================
    fn personal_pos_of(self: @TState, merchant: ContractAddress) -> ContractAddress;
    fn is_store_pos(self: @TState, merchant: ContractAddress, pos: ContractAddress) -> bool;

    fn get_fee_percent(self: @TState) -> u256;
    fn get_tax_percent(self: @TState) -> u256;
    fn get_timeout(self: @TState) -> u64;
    fn is_paused(self: @TState) -> bool;
    fn get_min_withdrawal_limit(self: @TState) -> u256;
    fn get_treasury(self: @TState) -> ContractAddress;

    fn is_supported_token(self: @TState, token: ContractAddress) -> bool;

    // ========================
    // ADMIN FUNCTIONS
    // ========================
    fn add_supported_token(ref self: TState, token: ContractAddress);
    fn remove_supported_token(ref self: TState, token: ContractAddress);
    fn update_treasury(ref self: TState, new_treasury: ContractAddress);
    fn update_fee_percent(ref self: TState, new_fee_percent: u256);
    fn update_tax_percent(ref self: TState, new_tax_percent: u256);
    fn update_timeout(ref self: TState, new_timeout: u64);
    fn update_min_withdrawal_limit(ref self: TState, new_limit: u256);
    fn set_paused(ref self: TState, paused: bool);

    // Optional: for upgrades
    fn set_pos_class_hash(ref self: TState, class_hash: ClassHash);
}