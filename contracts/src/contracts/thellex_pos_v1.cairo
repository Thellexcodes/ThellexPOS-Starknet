use starknet::{
    storage::{StoragePointerWriteAccess, StoragePointerReadAccess}
};
use thellexpos::interfaces::i_thellex_pos_v1::IThellexPOSV1;

#[starknet::contract]
pub mod ThellexPOSV1 {
    use crate::interfaces::i_thellex_pos_factory::IThellexPOSFactoryDispatcherTrait;
    use crate::interfaces::i_thellex_pos_factory::IThellexPOSFactoryDispatcher;
    use starknet::contract_address_const;
    use super::StoragePointerWriteAccess;
    use super::StoragePointerReadAccess;
    use starknet::{
        ContractAddress, get_caller_address, get_block_timestamp,
        storage::{Map, StorageMapWriteAccess, StorageMapReadAccess}
    };
    use core::num::traits::Zero;
    use super::IThellexPOSV1;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        deposit_address: ContractAddress,
        treasury: ContractAddress,
        fee_percent: u256,
        tax_percent: u256,
        timeout: u64,
        initialized: bool,
        paused: bool,
        deposits: Map<felt252, u256>,
        deposit_senders: Map<felt252, ContractAddress>,
        deposit_tokens: Map<felt252, ContractAddress>,
        deposit_timestamps: Map<felt252, u64>,
        balances: Map<ContractAddress, u256>,
        pending_payments: Map<felt252, u256>,
        payment_senders: Map<felt252, ContractAddress>,
        payment_tokens: Map<felt252, ContractAddress>,
        payment_timestamps: Map<felt252, u64>,
        transaction_counter: u256,
        admins: Map<ContractAddress, bool>,
        factory: ContractAddress, // <- added factory reference
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Initialized: Initialized,
        PaymentReceived: PaymentReceived,
        BalanceCredited: BalanceCredited,
        PaymentRejected: PaymentRejected,
        AutoRefunded: AutoRefunded,
        WithdrawalExecuted: WithdrawalExecuted,
        // Bridged: Bridged,
        SwapExecuted: SwapExecuted,
        TokenSupportUpdated: TokenSupportUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Initialized {
        #[key]
        owner: ContractAddress,
        deposit_address: ContractAddress,
        treasury: ContractAddress,
        fee_percent: u256,
        tax_percent: u256,
        timeout: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TokenSupportUpdated {
        #[key]
        token: ContractAddress,
        supported: bool,
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

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        deposit_address: ContractAddress,
        treasury: ContractAddress,
        fee_percent: u256,
        tax_percent: u256,
        timeout: u64,
        factory_address: ContractAddress
    ) {
        self.initialize(owner, deposit_address, treasury, fee_percent, tax_percent, timeout, factory_address);
    }

    #[abi(embed_v0)]
    impl ThellexPOSV1Impl of IThellexPOSV1<ContractState> {
        fn initialize(
            ref self: ContractState,
            owner: ContractAddress,
            deposit_address: ContractAddress,
            treasury: ContractAddress,
            fee_percent: u256,
            tax_percent: u256,
            timeout: u64,
            factory_address: ContractAddress
        ) {
            assert(!self.initialized.read(), 'Already initialized');
            assert(owner.is_non_zero(), 'Invalid owner');
            assert(deposit_address.is_non_zero(), 'Invalid deposit address');
            assert(treasury.is_non_zero(), 'Invalid treasury');
            assert(fee_percent <= 10000, 'Fee percent too high');
            assert(tax_percent <= 10000, 'Tax percent too high');
            assert(timeout > 0, 'Invalid timeout');

            self.owner.write(owner);
            self.deposit_address.write(deposit_address);
            self.treasury.write(treasury);
            self.fee_percent.write(fee_percent);
            self.tax_percent.write(tax_percent);
            self.timeout.write(timeout);
            self.admins.write(owner, true); 
            self.initialized.write(true);
            self.factory.write(factory_address);

            self.emit(Event::Initialized (
                Initialized{
                  owner,
                  deposit_address,
                  treasury,
                  fee_percent,
                  tax_percent,
                  timeout
                }
            ));
        }

        fn deposit(ref self: ContractState, amount: u256, tx_id: felt252, token: ContractAddress) {
            assert(self.initialized.read(), 'Not initialized');
            assert(!self.paused.read(), 'Contract paused');
            assert(amount > 0, 'Invalid amount');
            assert(token.is_non_zero(), 'Invalid token');

            assert(IThellexPOSFactoryDispatcher { contract_address: self.factory.read() }
              .is_supported_token(token), 'Unsupported token');

            assert(self.deposits.read(tx_id) == 0, 'Duplicate tx_id');

            let sender = get_caller_address();
            self.deposits.write(tx_id, amount);
            self.deposit_senders.write(tx_id, sender);
            self.deposit_tokens.write(tx_id, token);
            self.deposit_timestamps.write(tx_id, get_block_timestamp());
            self.emit(Event::PaymentReceived(PaymentReceived { sender, amount, token, tx_id }));
        }

        fn approve_transaction(ref self: ContractState, tx_id: felt252) {
            assert(self.initialized.read(), 'Not initialized');
            assert(get_caller_address() == self.owner.read(), 'Unauthorized');
            let amount = self.deposits.read(tx_id);
            assert(amount > 0, 'Invalid or processed tx_id');

            let token = self.deposit_tokens.read(tx_id);
            let fee = amount * self.fee_percent.read() / 10000;
            let net_amount = amount - fee;

            self.balances.write(token, self.balances.read(token) + net_amount);
            self.deposits.write(tx_id, 0);
            self.deposit_senders.write(tx_id, contract_address_const::<0>());
            self.deposit_tokens.write(tx_id, contract_address_const::<0>());
            self.deposit_timestamps.write(tx_id, 0);

            self.emit(Event::BalanceCredited(BalanceCredited {
                merchant: self.deposit_address.read(),
                amount: net_amount,
                token
            }));
        }

        fn reject_transaction(ref self: ContractState, tx_id: felt252) {
            assert(self.initialized.read(), 'Not initialized');
            assert(get_caller_address() == self.owner.read(), 'Unauthorized');
            let amount = self.deposits.read(tx_id);
            assert(amount > 0, 'Invalid or processed tx_id');

            let sender = self.deposit_senders.read(tx_id);
            let token = self.deposit_tokens.read(tx_id);

            self.deposits.write(tx_id, 0);
            self.deposit_senders.write(tx_id, contract_address_const::<0>());
            self.deposit_tokens.write(tx_id, contract_address_const::<0>());
            self.deposit_timestamps.write(tx_id, 0);

            self.emit(Event::PaymentRejected(PaymentRejected { sender, amount, token, tx_id }));
        }

        fn auto_refunded_amount(ref self: ContractState, tx_id: felt252) {
            assert(self.initialized.read(), 'Not initialized');
            assert(!self.paused.read(), 'Contract paused');
            let amount = self.deposits.read(tx_id);
            assert(amount > 0, 'Invalid or processed tx_id');
            let timestamp = self.deposit_timestamps.read(tx_id);
            assert(get_block_timestamp() >= timestamp + self.timeout.read(), 'Timeout not reached');

            let token = self.deposit_tokens.read(tx_id);
            let sender = self.deposit_senders.read(tx_id);
            let tax = amount * self.tax_percent.read() / 10000;
            let refund_amount = amount - tax;

            self.deposits.write(tx_id, 0);
            self.deposit_senders.write(tx_id, contract_address_const::<0>());
            self.deposit_tokens.write(tx_id, contract_address_const::<0>());
            self.deposit_timestamps.write(tx_id, 0);

            self.emit(Event::AutoRefunded(AutoRefunded {
                sender,
                amount: refund_amount,
                tax,
                token,
                tx_id
            }));
        }

        fn withdraw_funds(ref self: ContractState, recipient: ContractAddress, amount: u256, token: ContractAddress) {
            assert(self.initialized.read(), 'Not initialized');
            assert(!self.paused.read(), 'Contract paused');
            assert(self.admins.read(get_caller_address()), 'Unauthorized');
            assert(amount > 0, 'Invalid amount');
            assert(recipient.is_non_zero(), 'Invalid recipient');
            assert(token.is_non_zero(), 'Invalid token');
            assert(self.balances.read(token) >= amount, 'Insufficient balance');

            self.balances.write(token, self.balances.read(token) - amount);
            self.emit(Event::WithdrawalExecuted(WithdrawalExecuted { recipient, amount, token }));
        }

        fn batch_withdraw(
            ref self: ContractState,
            recipients: Array<ContractAddress>,
            amounts: Array<u256>,
            tokens: Array<ContractAddress>
        ) {
            assert(self.initialized.read(), 'Not initialized');
            assert(!self.paused.read(), 'Contract paused');
            assert(self.admins.read(get_caller_address()), 'Unauthorized');
            assert(recipients.len() == amounts.len() && amounts.len() == tokens.len(), 'Array mismatch');
            assert(recipients.len() > 0, 'Empty arrays');

            let mut i = 0;
            while i < recipients.len() {
                let recipient = *recipients.at(i);
                let amount = *amounts.at(i);
                let token = *tokens.at(i);
                assert(amount > 0, 'Invalid amount');
                assert(recipient.is_non_zero(), 'Invalid recipient');
                assert(token.is_non_zero(), 'Invalid token');
                assert(self.balances.read(token) >= amount, 'Insufficient balance');

                self.balances.write(token, self.balances.read(token) - amount);
                self.emit(Event::WithdrawalExecuted(WithdrawalExecuted { recipient, amount, token }));
                i += 1;
            }
        }

        // fn bridge_funds(
        //     ref self: ContractState,
        //     amount: u256,
        //     target_chain: felt252,
        //     recipient: ContractAddress,
        //     token: ContractAddress
        // ) {
        //     assert(self.initialized.read(), 'Not initialized');
        //     assert(!self.paused.read(), 'Contract paused');
        //     assert(self.admins.read(get_caller_address()), 'Unauthorized');
        //     assert(amount > 0, 'Invalid amount');
        //     assert(recipient.is_non_zero(), 'Invalid recipient');
        //     assert(token.is_non_zero(), 'Invalid token');
        //     assert(self.balances.read(token) >= amount, 'Insufficient balance');

        //     self.balances.write(token, self.balances.read(token) - amount);
        //     self.emit(Event::Bridged(Bridged { recipient, amount, token, target_chain }));
        // }

        // fn swap_tokens(
        //     ref self: ContractState,
        //     amount: u256,
        //     from_token: ContractAddress,
        //     to_token: ContractAddress
        // ) {
        //     assert(self.initialized.read(), 'Not initialized');
        //     assert(!self.paused.read(), 'Contract paused');
        //     assert(self.admins.read(get_caller_address()), 'Unauthorized');
        //     assert(amount > 0, 'Invalid amount');
        //     assert(from_token.is_non_zero(), 'Invalid from_token');
        //     assert(to_token.is_non_zero(), 'Invalid to_token');
        //     assert(self.balances.read(from_token) >= amount, 'Insufficient balance');

        //     let amount_out = amount;
        //     self.balances.write(from_token, self.balances.read(from_token) - amount);
        //     self.balances.write(to_token, self.balances.read(to_token) + amount_out);
        //     self.emit(Event::SwapExecuted(SwapExecuted {
        //         merchant: self.owner.read(),
        //         from_token,
        //         to_token,
        //         amount_in: amount,
        //         amount_out
        //     }));
        // }

        fn get_deposit(self: @ContractState, tx_id: felt252) -> (ContractAddress, u256, ContractAddress, u64) {
            (
                self.deposit_senders.read(tx_id),
                self.deposits.read(tx_id),
                self.deposit_tokens.read(tx_id),
                self.deposit_timestamps.read(tx_id)
            )
        }

        fn balances(self: @ContractState, token: ContractAddress) -> u256 {
            self.balances.read(token)
        }
    }
}