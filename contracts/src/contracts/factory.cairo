#[starknet::contract]
pub mod Factory {
    use starknet::SyscallResultTrait;
    use starknet::storage::StoragePointerReadAccess;
    use starknet::storage::StoragePointerWriteAccess;
    use core::num::traits::Zero;
    use crate::interfaces::i_pos_factory::IFactory;
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_tx_info, class_hash::ClassHash, syscalls::deploy_syscall};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};

    #[storage]
    struct Storage {
        treasury: ContractAddress,
        fee_percent: u256,
        tax_percent: u256,
        timeout: u64,
        min_withdrawal_limit: u256,
        initialized: bool,
        paused: bool,
        pos_class_hash: ClassHash,
        personal_pos_of: Map<ContractAddress, ContractAddress>,
        store_pos_of: Map<(ContractAddress, ContractAddress), bool>,
        admins: Map<ContractAddress, bool>,
        supported_tokens: Map<ContractAddress, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        FactoryInitialized: FactoryInitialized,
        PersonalPOSCreated: PersonalPOSCreated,
        StorePOSCreated: StorePOSCreated,
        TokenSupportUpdated: TokenSupportUpdated,
        Paused: Paused,
        Unpaused: Unpaused,
    }

    #[derive(Drop, starknet::Event)]
    struct FactoryInitialized { admin: ContractAddress, treasury: ContractAddress }
    #[derive(Drop, starknet::Event)]
    struct PersonalPOSCreated { ownerAddress: ContractAddress, pos_address: ContractAddress }
    #[derive(Drop, starknet::Event)]
    struct StorePOSCreated { merchant: ContractAddress, pos_address: ContractAddress, store_name: ByteArray }
    #[derive(Drop, starknet::Event)]
    struct TokenSupportUpdated { token: ContractAddress, supported: bool }
    #[derive(Drop, starknet::Event)]
    struct Paused { account: ContractAddress }
    #[derive(Drop, starknet::Event)]
    struct Unpaused { account: ContractAddress }

    #[constructor]
    fn constructor(ref self: ContractState, pos_class_hash: ClassHash) {
        self.pos_class_hash.write(pos_class_hash);
        self.initialized.write(false);
        self.paused.write(false);
    }

    #[abi(embed_v0)]
    impl FactoryImpl of IFactory<ContractState> {
        // ======================== INITIALIZATION ========================
        fn initialize(
            ref self: ContractState,
            treasury: ContractAddress,
            fee_percent: u256,
            tax_percent: u256,
            timeout: u64,
            min_withdrawal_limit: u256
        ) {
            assert(!self.initialized.read(), 'Already initialized');
            assert(treasury.is_non_zero(), 'Invalid treasury');
            assert(fee_percent <= 10000, 'Fee too high');
            assert(tax_percent <= 10000, 'Tax too high');
            assert(timeout > 0, 'Invalid timeout');
            assert(min_withdrawal_limit > 0, 'Invalid min limit');

            self.treasury.write(treasury);
            self.fee_percent.write(fee_percent);
            self.tax_percent.write(tax_percent);
            self.timeout.write(timeout);
            self.min_withdrawal_limit.write(min_withdrawal_limit);
            self.paused.write(false); 
            self.admins.write(get_caller_address(), true);
            self.initialized.write(true);

            self.emit(FactoryInitialized { admin: get_caller_address(), treasury });
        }


        // ======================== POS CREATION ========================
        fn create_personal_pos(ref self: ContractState, ownerAddress: ContractAddress) -> ContractAddress {
            InternalImpl::assert_initialized_and_not_paused(@self);

            assert(self.personal_pos_of.read(ownerAddress).is_zero(), 'Personal POS exists');

            let pos_addr = InternalImpl::deploy_pos(ref self, ownerAddress, 0.into());
            self.personal_pos_of.write(ownerAddress, pos_addr);

            self.emit(PersonalPOSCreated { ownerAddress, pos_address: pos_addr });
            pos_addr
        }

        fn create_store_pos(ref self: ContractState, store_name: ByteArray, merchant: ContractAddress) -> ContractAddress {
            InternalImpl::assert_initialized_and_not_paused(@self);

            let salt = get_tx_info().unbox().nonce; 
            let pos_addr = InternalImpl::deploy_pos(ref self, merchant, salt.into());

            self.store_pos_of.write((merchant, pos_addr), true);
            self.emit(StorePOSCreated { merchant, pos_address: pos_addr, store_name });

            pos_addr
        }

        // ======================== VIEW FUNCTIONS ========================
        fn personal_pos_of(self: @ContractState, merchant: ContractAddress) -> ContractAddress {
            self.personal_pos_of.read(merchant)
        }

        fn is_store_pos(self: @ContractState, merchant: ContractAddress, pos: ContractAddress) -> bool {
            self.store_pos_of.read((merchant, pos))
        }

        fn get_fee_percent(self: @ContractState) -> u256 { self.fee_percent.read() }
        fn get_tax_percent(self: @ContractState) -> u256 { self.tax_percent.read() }
        fn get_timeout(self: @ContractState) -> u64 { self.timeout.read() }
        fn is_paused(self: @ContractState) -> bool { self.paused.read() }
        fn get_min_withdrawal_limit(self: @ContractState) -> u256 { self.min_withdrawal_limit.read() }
        fn get_treasury(self: @ContractState) -> ContractAddress { self.treasury.read() }
        fn is_supported_token(self: @ContractState, token: ContractAddress) -> bool {
            self.supported_tokens.read(token)
        }

        // ======================== ADMIN FUNCTIONS ========================
        fn add_supported_token(ref self: ContractState, token: ContractAddress) {
            InternalImpl::only_admin(@self);
            assert(token.is_non_zero(), 'Zero token');
            self.supported_tokens.write(token, true);
            self.emit(TokenSupportUpdated { token, supported: true });
        }

        fn remove_supported_token(ref self: ContractState, token: ContractAddress) {
            InternalImpl::only_admin(@self);
            self.supported_tokens.write(token, false);
            self.emit(TokenSupportUpdated { token, supported: false });
        }

        fn update_treasury(ref self: ContractState, new_treasury: ContractAddress) {
            InternalImpl::only_admin(@self);
            assert(new_treasury.is_non_zero(), 'Zero treasury');
            self.treasury.write(new_treasury);
        }

        fn update_fee_percent(ref self: ContractState, new_fee_percent: u256) {
            InternalImpl::only_admin(@self);
            assert(new_fee_percent <= 10000, 'Fee too high');
            self.fee_percent.write(new_fee_percent);
        }

        fn update_tax_percent(ref self: ContractState, new_tax_percent: u256) {
            InternalImpl::only_admin(@self);
            assert(new_tax_percent <= 10000, 'Tax too high');
            self.tax_percent.write(new_tax_percent);
        }

        fn update_timeout(ref self: ContractState, new_timeout: u64) {
            InternalImpl::only_admin(@self);
            assert(new_timeout > 0, 'Invalid timeout');
            self.timeout.write(new_timeout);
        }

        fn update_min_withdrawal_limit(ref self: ContractState, new_limit: u256) {
            InternalImpl::only_admin(@self);
            assert(new_limit > 0, 'Invalid limit');
            self.min_withdrawal_limit.write(new_limit);
        }

        fn set_paused(ref self: ContractState, paused: bool) {
            InternalImpl::only_admin(@self);
            self.paused.write(paused);
            if paused { self.emit(Paused { account: get_caller_address() }); }
            else { self.emit(Unpaused { account: get_caller_address() }); }
        }

        fn set_pos_class_hash(ref self: ContractState, class_hash: ClassHash) {
            InternalImpl::only_admin(@self);
            assert(!class_hash.is_zero(), 'Zero class hash');
            self.pos_class_hash.write(class_hash);
        }
    }

    // / ======================== INTERNAL METHODS (now as extensions) ========================
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_initialized_and_not_paused(self: @ContractState) {
            assert(self.initialized.read(), 'Not initialized');
            assert(!self.paused.read(), 'Factory paused');
        }

        fn only_admin(self: @ContractState) {
            assert(self.admins.read(get_caller_address()), 'Only admin');
        }

        fn deploy_pos(ref self: ContractState, merchant: ContractAddress, salt: felt252) -> ContractAddress {
            let mut calldata: Array<felt252> = array![
                merchant.into(),
                self.treasury.read().into(),
                self.fee_percent.read().low.into(),
                self.fee_percent.read().high.into(),
                self.tax_percent.read().low.into(),
                self.tax_percent.read().high.into(),
                self.timeout.read().into(),
                self.min_withdrawal_limit.read().low.into(),
                self.min_withdrawal_limit.read().high.into(),
                get_contract_address().into(),
            ];

            let (addr, _) = deploy_syscall(
                self.pos_class_hash.read(),
                salt,
                calldata.span(),
                false
            ).unwrap_syscall();

            addr
        }
    }
}