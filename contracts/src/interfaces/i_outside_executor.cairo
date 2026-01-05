use starknet::ContractAddress;

#[starknet::interface]
pub trait IOutsideExecutor<TContractState> {
    fn execute_meta_transaction(
        ref self: TContractState,
        user_pubkey: ContractAddress,
        to: ContractAddress,
        selector: felt252,
        calldata: Span<felt252>,
        nonce: felt252,
        sig_r: felt252,
        sig_s: felt252,
        y_parity: bool,
    );

    fn get_nonce(self: @TContractState, user: ContractAddress) -> felt252;
}