use starknet::ContractAddress;

#[starknet::contract]
mod OutsideExecutor {
    use starknet::storage::StorageMapWriteAccess;
    use starknet::storage::StorageMapReadAccess;
    use starknet::storage::StoragePointerReadAccess;
    use starknet::storage::StoragePointerWriteAccess;
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::syscalls::call_contract_syscall;
    use starknet::SyscallResultTrait;
    use core::ecdsa::recover_public_key;
    use core::pedersen::pedersen;
    use core::array::SpanTrait;
    use starknet::storage::Map;
    use crate::interfaces::i_outside_executor::IOutsideExecutor;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        nonce: Map<ContractAddress, felt252>,
    }

    #[derive(Drop, starknet::Event)]
    struct PreValidationLog {
        #[key]
        pub recovered_pubkey: felt252,
        pub user_pubkey: ContractAddress,
        pub to: ContractAddress,
        pub selector: felt252,
        pub nonce: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct ExecutionLog {
        #[key]
        pub to: ContractAddress,
        pub selector: felt252,
        pub success: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
      ExecutionLog: ExecutionLog
    }

    fn build_message_hash(
        user: ContractAddress,
        to: ContractAddress,
        selector: felt252,
        calldata: Span<felt252>,
        nonce: felt252,
    ) -> felt252 {
        let mut hash = pedersen(user.into(), to.into());
        hash = pedersen(hash, selector);
        hash = pedersen(hash, pedersen_hash_span(calldata));
        pedersen(hash, nonce)
    }

    fn pedersen_hash_span(mut data: Span<felt252>) -> felt252 {
        let mut hash = 0;
        loop {
            match data.pop_front() {
                Option::Some(value) => { hash = pedersen(hash, *value); },
                Option::None => { break hash; }
            }
        }
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
    }

    #[abi(embed_v0)]
    impl OutsideExecutorImpl of IOutsideExecutor<ContractState> {
        fn execute_meta_transaction(
            ref self: ContractState,
            user_pubkey: ContractAddress,
            to: ContractAddress,
            selector: felt252,
            calldata: Span<felt252>,
            nonce: felt252,
            sig_r: felt252,
            sig_s: felt252,
            y_parity: bool,
        ) {
            assert(get_caller_address() == self.owner.read(), 'UNAUTHORIZED');

            let current_nonce = self.nonce.read(user_pubkey);
            assert(current_nonce == nonce, 'INVALID_NONCE');
            self.nonce.write(user_pubkey, nonce + 1);
            let message_hash = build_message_hash(user_pubkey, to, selector, calldata, nonce);
            let recovered_pubkey = recover_public_key(message_hash, sig_r, sig_s, y_parity).unwrap();

            assert(recovered_pubkey == user_pubkey.into(), 'INVALID_SIGNATURE');

            let _result = call_contract_syscall(
                address: to,
                entry_point_selector: selector,
                calldata: calldata
            ).unwrap_syscall();

            self.emit(Event::ExecutionLog(ExecutionLog {
                to: to,
                selector: selector,
                success: true
            }));
        }

        fn get_nonce(self: @ContractState, user: ContractAddress) -> felt252 {
            self.nonce.read(user)
        }
    }
}