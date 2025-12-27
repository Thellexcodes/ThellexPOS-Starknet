#[starknet::contract]
pub mod Store {
    use core::ecdsa::check_ecdsa_signature;
    use core::pedersen::pedersen;
    use starknet::contract_address_const;
    use core::num::traits::Zero;
    use starknet::storage::StoragePointerWriteAccess;
    use starknet::storage::StoragePointerReadAccess;
    use starknet::{ ContractAddress, get_caller_address, get_contract_address, get_block_timestamp };
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::interfaces::i_pos_factory::{
        IFactoryDispatcher, IFactoryDispatcherTrait
    };
    use crate::interfaces::i_store_pos::{IStore, DepositInfo, Role} ;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        factory: ContractAddress,
        treasury: ContractAddress,
        fee_percent: u256,
        tax_percent: u256,
        timeout: u64,
        min_withdrawal_limit: u256,
        initialized: bool,
        paused: bool,
        balances: Map<ContractAddress, u256>,
        deposits: Map<felt252, DepositInfo>,
        payment_requests: Map<felt252, PaymentRequest>,
        transaction_counter: u256,
        roles: Map<(ContractAddress, ContractAddress), Role>,
        rejection_count: Map<ContractAddress, u8>,
        nonces: Map<ContractAddress, u64>, 
    }

    #[derive(Drop, Serde, starknet::Store)]
    pub struct PaymentRequest {
        amount: u256,
        token: ContractAddress,
        requester: ContractAddress,
        active: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Initialized: Initialized,
        PaymentReceived: PaymentReceived,
        BalanceCredited: BalanceCredited,
        PaymentRejected: PaymentRejected,
        AutoRefunded: AutoRefunded,
        WithdrawalToOwner: WithdrawalToOwner,
        PaymentRequestCreated: PaymentRequestCreated,
        PaymentRequestFulfilled: PaymentRequestFulfilled,
        ExternalDepositRegistered: ExternalDepositRegistered,
        RefundSent: RefundSent,
        RoleGranted: RoleGranted,
        RoleRevoked: RoleRevoked,
    }

    #[derive(Drop, starknet::Event)] struct Initialized { owner: ContractAddress, treasury: ContractAddress }
    #[derive(Drop, starknet::Event)] struct PaymentReceived { sender: ContractAddress, amount: u256, token: ContractAddress, tx_id: felt252 }
    #[derive(Drop, starknet::Event)] struct BalanceCredited { amount: u256, token: ContractAddress }
    #[derive(Drop, starknet::Event)] struct PaymentRejected { sender: ContractAddress, amount: u256, token: ContractAddress, tx_id: felt252 }
    #[derive(Drop, starknet::Event)] struct AutoRefunded { sender: ContractAddress, amount: u256, tax: u256, token: ContractAddress, tx_id: felt252 }
    #[derive(Drop, starknet::Event)] struct WithdrawalToOwner { amount: u256, token: ContractAddress }
    #[derive(Drop, starknet::Event)] struct PaymentRequestCreated { request_id: felt252, requester: ContractAddress, amount: u256, token: ContractAddress }
    #[derive(Drop, starknet::Event)] struct PaymentRequestFulfilled { request_id: felt252, sender: ContractAddress, amount: u256, token: ContractAddress }
    #[derive(Drop, starknet::Event)] struct ExternalDepositRegistered { sender: ContractAddress, amount: u256, token: ContractAddress, tx_id: felt252 }
    #[derive(Drop, starknet::Event)] struct RefundSent { original_sender: ContractAddress, refund_receiver: ContractAddress, amount: u256, token: ContractAddress, tx_id: felt252 }
    #[derive(Drop, starknet::Event)] struct RoleGranted { user: ContractAddress, role: Role, granted_by: ContractAddress }
    #[derive(Drop, starknet::Event)] struct RoleRevoked { user: ContractAddress, role: Role, revoked_by: ContractAddress }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        treasury: ContractAddress,
        fee_percent: u256,
        tax_percent: u256,
        timeout: u64,
        min_withdrawal_limit: u256,
        factory: ContractAddress
    ) {
        self.owner.write(owner);
        self.factory.write(factory);
        self.treasury.write(treasury);
        self.fee_percent.write(fee_percent);
        self.tax_percent.write(tax_percent);
        self.timeout.write(timeout);
        self.min_withdrawal_limit.write(min_withdrawal_limit);
        self.initialized.write(true);
        self.paused.write(false);

        // Grant Owner role
        self.roles.write((get_contract_address(), owner), Role::Owner);
        self.emit(Initialized { owner, treasury });
        self.emit(RoleGranted { user: owner, role: Role::Owner, granted_by: owner });
    }

     #[abi(embed_v0)]
    impl StoreImpl of IStore<ContractState> {

        fn revoke_role(ref self: ContractState, user: ContractAddress) {
            self._assert_only_owner();
            let current = InternalImpl::get_role(@self,user);
            assert(current != Role::None && current != Role::Owner, 'Cannot revoke Owner');

            self.roles.write((get_contract_address(), user), Role::None);
            self.emit(RoleRevoked { user, role: current, revoked_by: get_caller_address() });
        }


        fn deposit(ref self: ContractState, amount: u256, tx_id: felt252, token: ContractAddress) {
            InternalImpl::_ensure_active(@self);
            assert(amount > 0, 'Zero amount');
            assert(self.deposits.read(tx_id).amount == 0, 'Duplicate tx_id');

            let factory = IFactoryDispatcher { contract_address: self.factory.read() };
            assert(factory.is_supported_token(token), 'Unsupported token');

            let sender = get_caller_address();
            // IERC20Dispatcher { contract_address: token }
            //     .transfer_from(sender, get_contract_address(), amount);

            let info = DepositInfo {
                amount, token, sender, timestamp: get_block_timestamp(), approved: false
            };
            self.deposits.write(tx_id, info);
            self.emit(PaymentReceived { sender, amount, token, tx_id });
        }

        fn approve_transaction(
          ref self: ContractState, 
          tx_id: felt252, 
          signer: ContractAddress, 
          nonce: u64, 
          deadline: u64, 
          pubkey: felt252, 
          sig_r: felt252, 
          sig_s: felt252
        ) {
            InternalImpl::_ensure_active(@self);

           // Replay protection
            assert(self.nonces.read(signer) == nonce, 'Invalid nonce');
            assert(get_block_timestamp() <= deadline, 'Signature expired');

            let calldata_hash = pedersen(0, tx_id);

            // Message hash
            let mut hash = pedersen(1, signer.into());
            hash = pedersen(hash, nonce.into());
            hash = pedersen(hash, deadline.into());
            hash = pedersen(hash, selector!("approve_transaction"));
            hash = pedersen(hash, calldata_hash);

            // Verify signature
            assert(check_ecdsa_signature(hash, pubkey, sig_r, sig_s), 'Invalid signature');

            // Consume nonce
            self.nonces.write(signer, nonce + 1);

            // Verify role
            InternalImpl::_assert_manager_or_owner(ref self, signer);

            let mut info = self.deposits.read(tx_id);
            assert(info.amount > 0 && !info.approved, 'Invalid tx');

            let fee = info.amount * self.fee_percent.read() / 10000;
            let net = info.amount - fee;

            self.balances.write(info.token, self.balances.read(info.token) + net);
            info.approved = true;
            info.amount = 0;
            self.deposits.write(tx_id, info);

            self.rejection_count.write(self.owner.read(), 0);
            self.emit(BalanceCredited { amount: net, token: info.token });
        }

        fn reject_transaction(ref self: ContractState, tx_id: felt252, signer: ContractAddress, nonce: u64, deadline: u64, pubkey: felt252, sig_r: felt252, sig_s: felt252) { 

            assert(self.nonces.read(signer) == nonce, 'Invalid nonce');
            assert(get_block_timestamp() <= deadline, 'Signature expired');

            let calldata_hash = pedersen(0, tx_id);

            let mut hash = pedersen(1, signer.into());
            hash = pedersen(hash, nonce.into());
            hash = pedersen(hash, deadline.into());
            hash = pedersen(hash, selector!("reject_transaction"));
            hash = pedersen(hash, calldata_hash);

            assert(check_ecdsa_signature(hash, pubkey, sig_r, sig_s), 'Invalid signature');

            self.nonces.write(signer, nonce + 1);
            InternalImpl::_assert_manager_or_owner(ref self, signer);

            let info = self.deposits.read(tx_id);
            assert(info.amount > 0 && !info.approved, 'Invalid tx');

            let mut count = self.rejection_count.read(self.owner.read());
            assert(count < 2 || self.balances.read(info.token) > 0, 'Rejection limit');
            count += 1;
            self.rejection_count.write(self.owner.read(), count);

            // IERC20Dispatcher { contract_address: info.token }.transfer(info.sender, info.amount);
            self.deposits.write(tx_id, DepositInfo { amount: 0, ..info });

            self.emit(PaymentRejected { sender: info.sender, amount: info.amount, token: info.token, tx_id });
        }

         fn auto_refund_signed(
            ref self: ContractState,
            tx_id: felt252,
            refund_to: ContractAddress,
            signer: ContractAddress,
            nonce: u64,
            deadline: u64,
            pubkey: felt252,
            sig_r: felt252,
            sig_s: felt252
        ) {
           InternalImpl::_ensure_active(@self);

            // Replay protection
            assert(self.nonces.read(signer) == nonce, 'Invalid nonce');
            assert(get_block_timestamp() <= deadline, 'Signature expired');

            // Calldata hash: tx_id + refund_to
            let mut calldata_hash = pedersen(0, tx_id);
            calldata_hash = pedersen(calldata_hash, refund_to.into());

            // Message hash
            let mut hash = pedersen(1, signer.into());
            hash = pedersen(hash, nonce.into());
            hash = pedersen(hash, deadline.into());
            hash = pedersen(hash, selector!("auto_refund"));
            hash = pedersen(hash, calldata_hash);

            // Verify signature
            assert(check_ecdsa_signature(hash, pubkey, sig_r, sig_s), 'Invalid signature');

            // Consume nonce
            self.nonces.write(signer, nonce + 1);

            // Verify role (only owner or manager can trigger auto-refund)
            InternalImpl::_assert_manager_or_owner(ref self, signer);

            let info = self.deposits.read(tx_id);
            assert(info.amount > 0 && !info.approved, 'Invalid tx');
            assert(get_block_timestamp() >= info.timestamp + self.timeout.read(), 'Not timed out');
            assert(refund_to.is_non_zero(), 'Invalid receiver');

            let tax = info.amount * self.tax_percent.read() / 10000;
            let refund_amount = info.amount - tax;

            // IERC20Dispatcher { contract_address: info.token }.transfer(refund_to, refund_amount);
            self.deposits.write(tx_id, DepositInfo { amount: 0, ..info });
            self.rejection_count.write(self.owner.read(), self.rejection_count.read(self.owner.read()) + 1);

            self.emit(AutoRefunded { sender: info.sender, amount: refund_amount, tax, token: info.token, tx_id });
            self.emit(RefundSent { original_sender: info.sender, refund_receiver: refund_to, amount: refund_amount, token: info.token, tx_id });
        }

        fn create_payment_request(ref self: ContractState, amount: u256, token: ContractAddress, request_id: felt252) {
            self._assert_cashier_or_above();
            let factory = IFactoryDispatcher { contract_address: self.factory.read() };
            assert(factory.is_supported_token(token), 'Unsupported token');
            assert(amount > 0, 'Zero amount');
            assert(self.payment_requests.read(request_id).amount == 0, 'ID taken');

            self.payment_requests.write(request_id, PaymentRequest {
                amount, token, requester: get_caller_address(), active: true
            });
            self.emit(PaymentRequestCreated { request_id, requester: get_caller_address(), amount, token });
        }


        fn fulfill_payment_request(
            ref self: ContractState,
            request_id: felt252,
            amount: u256,
            token: ContractAddress
        ) {
            assert(self.initialized.read(), 'Not initialized');
            assert(!self.paused.read(), 'Contract paused');
            assert(amount > 0, 'Invalid amount');
            assert(token.is_non_zero(), 'Invalid token');

            let request = self.payment_requests.read(request_id);
            assert(request.active, 'Invalid or inactive request');
            assert(request.amount == amount, 'Amount mismatch');
            assert(request.token == token, 'Token mismatch');

            assert(IFactoryDispatcher { contract_address: self.factory.read() }
                .is_supported_token(token), 'Unsupported token');

            let sender = get_caller_address();
            let fee = amount * self.fee_percent.read() / 10000;
            let net_amount = amount - fee;

            self.balances.write(token, self.balances.read(token) + net_amount);
            self.payment_requests.write(request_id, PaymentRequest {
                amount: 0,
                token: contract_address_const::<0>(),
                requester: contract_address_const::<0>(),
                active: false
            });
            self.rejection_count.write(self.owner.read(), 0);
            self.emit(Event::PaymentRequestFulfilled(PaymentRequestFulfilled { request_id, sender, amount, token }));
            self.emit(Event::BalanceCredited(BalanceCredited { amount: net_amount, token }));
        }

        fn withdraw_to_owner(
            ref self: ContractState,
            token: ContractAddress,
            amount: u256,
            signer: ContractAddress,
            nonce: u64,
            deadline: u64,
            pubkey: felt252,
            sig_r: felt252,
            sig_s: felt252
        ) {
          InternalImpl::_ensure_active(@self);

            assert(self.nonces.read(signer) == nonce, 'Invalid nonce');
            assert(get_block_timestamp() <= deadline, 'Signature expired');

            let mut calldata_hash = pedersen(0, token.into());
            calldata_hash = pedersen(calldata_hash, amount.low.into());
            calldata_hash = pedersen(calldata_hash, amount.high.into());

            let mut hash = pedersen(1, signer.into());
            hash = pedersen(hash, nonce.into());
            hash = pedersen(hash, deadline.into());
            hash = pedersen(hash, selector!("withdraw_to_owner"));
            hash = pedersen(hash, calldata_hash);

            assert(check_ecdsa_signature(hash, pubkey, sig_r, sig_s), 'Invalid signature');

            self.nonces.write(signer, nonce + 1);

            // Verify role
            InternalImpl::_assert_manager_or_owner(ref self, signer);

            assert(amount >= self.min_withdrawal_limit.read(), 'Below limit');
            let bal = self.balances.read(token);
            assert(bal >= amount, 'Insufficient');

            self.balances.write(token, bal - amount);
            // IERC20Dispatcher { contract_address: token }.transfer(self.owner.read(), amount);
            self.emit(WithdrawalToOwner { amount, token });
        }

        fn register_external_deposit(
            ref self: ContractState,
            amount: u256,
            token: ContractAddress,
            sender: ContractAddress,
            signer: ContractAddress,
            nonce: u64,
            deadline: u64,
            pubkey: felt252,
            sig_r: felt252,
            sig_s: felt252
        ) -> felt252 {
            InternalImpl::_ensure_active(@self);

            assert(self.nonces.read(signer) == nonce, 'Invalid nonce');
            assert(get_block_timestamp() <= deadline, 'Signature expired');

            let mut calldata_hash = pedersen(0, amount.low.into());
            calldata_hash = pedersen(calldata_hash, amount.high.into());
            calldata_hash = pedersen(calldata_hash, token.into());
            calldata_hash = pedersen(calldata_hash, sender.into());

            let mut hash = pedersen(1, signer.into());
            hash = pedersen(hash, nonce.into());
            hash = pedersen(hash, deadline.into());
            hash = pedersen(hash, selector!("register_external_deposit"));
            hash = pedersen(hash, calldata_hash);

            assert(check_ecdsa_signature(hash, pubkey, sig_r, sig_s), 'Invalid signature');

            self.nonces.write(signer, nonce + 1);
            InternalImpl::_assert_manager_or_owner(ref self, signer);

            let factory = IFactoryDispatcher { contract_address: self.factory.read() };
            assert(factory.is_supported_token(token), 'Unsupported token');

            let tx_id: felt252 = self.transaction_counter.read().try_into().unwrap();
            self.transaction_counter.write(self.transaction_counter.read() + 1);

            let fee = amount * self.fee_percent.read() / 10000;
            let net = amount - fee;
            self.balances.write(token, self.balances.read(token) + net);

            let info = DepositInfo { amount, token, sender, timestamp: get_block_timestamp(), approved: true };
            self.deposits.write(tx_id, info);

            self.emit(ExternalDepositRegistered { sender, amount, token, tx_id });
            self.emit(BalanceCredited { amount: net, token });
            tx_id
        }

        fn batch_withdraw(
            ref self: ContractState,
            tokens: Array<ContractAddress>,
            amounts: Array<u256>,
            recipient: ContractAddress,
            signer: ContractAddress,
            nonce: u64,
            deadline: u64,
            pubkey: felt252,
            sig_r: felt252,
            sig_s: felt252
        ) {

          InternalImpl::_ensure_active(@self);

          assert(self.nonces.read(signer) == nonce, 'Invalid nonce');
          assert(get_block_timestamp() <= deadline, 'Signature expired');

          // let mut calldata_hash = 0;
          // let mut i = 0;
          // while i < tokens.len() {
          //     // calldata_hash = pedersen(calldata_hash, *tokens.at(i).into());
          //     calldata_hash = pedersen(calldata_hash, *amounts.at(i).low.into());
          //     calldata_hash = pedersen(calldata_hash, *amounts.at(i).high.into());
          //     i += 1;
          // };
          // calldata_hash = pedersen(calldata_hash, recipient.into());

          // let mut hash = pedersen(1, signer.into());
          // hash = pedersen(hash, nonce.into());
          // hash = pedersen(hash, deadline.into());
          // hash = pedersen(hash, selector!("batch_withdraw"));
          // hash = pedersen(hash, calldata_hash);

          // assert(check_ecdsa_signature(hash, pubkey, sig_r, sig_s), 'Invalid signature');

          // self.nonces.write(signer, nonce + 1);

          assert(!recipient.is_zero(), 'Zero recipient');
          assert(tokens.len() == amounts.len(), 'Arrays length mismatch');
          assert(tokens.len() > 0, 'Empty batch');

            let mut i = 0;
            while i < tokens.len() {
                let token = *tokens.at(i);
                let amount = *amounts.at(i);

                assert(amount > 0, 'Zero amount');
                assert(!token.is_zero(), 'Zero token');
                assert(amount >= self.min_withdrawal_limit.read(), 'Below min limit');

                let balance = self.balances.read(token);
                assert(balance >= amount, 'Insufficient balance');

                // Deduct balance
                self.balances.write(token, balance - amount);

                // Transfer tokens
                // IERC20Dispatcher { contract_address: token }.transfer(recipient, amount);

                // Emit per-withdrawal event (for indexing)
                self.emit(WithdrawalToOwner { amount, token });

                i += 1;
            }
        }

        fn owner(self: @ContractState) -> ContractAddress { self.owner.read() }
        fn balance_of(self: @ContractState, token: ContractAddress) -> u256 { self.balances.read(token) }
        fn get_deposit(self: @ContractState, tx_id: felt252) -> DepositInfo { self.deposits.read(tx_id) }
        fn is_paused(self: @ContractState) -> bool { self.paused.read() }fn grant_role(ref self: ContractState, user: ContractAddress, role: crate::interfaces::i_store_pos::Role) {}
        fn get_role(self: @ContractState, user: ContractAddress) -> Role { self.roles.read((get_contract_address(), user)) }
        fn is_initialized(self: @ContractState) -> bool { return self.initialized.read(); }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _ensure_active(self: @ContractState) {
            assert(self.initialized.read(), 'Not initialized');
            assert(!self.paused.read(), 'Paused');
        }

        fn get_role(self: @ContractState, user: ContractAddress) -> Role {
            self.roles.read((get_contract_address(), user))
        }

        fn _assert_only_owner(ref self: ContractState) {
            let caller = get_caller_address();
            assert(
                caller == self.owner.read()
                || Self::get_role(@self, caller) == Role::Owner,
                'Only owner'
            );
        }

        fn _assert_manager_or_owner(ref self: ContractState, signer: ContractAddress) {
            if signer != self.owner.read() {
                assert(Self::get_role(@self, signer) == Role::Manager, 'Only manager/owner');
            }
        }

        fn _assert_cashier_or_above(ref self: ContractState) {
            let role = Self::get_role(@self, get_caller_address());
            assert(role == Role::Cashier || role == Role::Manager || role == Role::Owner, 'Cashier+ required');
        }
    }
}