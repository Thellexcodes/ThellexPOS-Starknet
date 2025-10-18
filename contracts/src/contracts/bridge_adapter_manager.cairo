
#[starknet::contract]
mod BridgeAdapterManager {
    use starknet::storage::{StorageMapReadAccess, Map};
    use core::num::traits::Zero;
    use starknet::ContractAddress;

    // --------------------
    // Storage
    // --------------------
    #[storage]
    struct Storage {
        supported_chains: Map<felt252, bool>,
    }

    // --------------------
    // Sub-event definitions
    // --------------------
    #[derive(Drop, starknet::Event)]
    enum BridgeAdapterManagerEvent {
        Bridged: Bridged,
    }

    #[derive(Drop, starknet::Event)]
    struct Bridged {
        #[key]
        recipient: ContractAddress,
        amount: u256,
        token: ContractAddress,
        target_chain: felt252,
    }

    // --------------------
    // Root Event enum (required)
    // --------------------
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        BridgeAdapterManagerEvent: BridgeAdapterManagerEvent,
    }

    // --------------------
    // External function
    // --------------------
    #[external(v0)]
    fn bridge_funds(
        ref self: ContractState,
        caller: ContractAddress,
        amount: u256,
        target_chain: felt252,
        recipient: ContractAddress,
        token: ContractAddress,
    ) {
        assert(amount > 0, 'Invalid amount');
        assert(recipient.is_non_zero(), 'Invalid recipient');
        assert(token.is_non_zero(), 'Invalid token');
        assert(self.supported_chains.read(target_chain), 'Unsupported chain');

        // ✅ Proper event emission
        self.emit(BridgeAdapterManagerEvent::Bridged(Bridged {
            recipient,
            amount,
            token,
            target_chain,
        }));
    }
}
