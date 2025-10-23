use starknet::{
    storage::{StoragePointerWriteAccess, StoragePointerReadAccess}
};
use thellexpos::interfaces::i_thellex_pos_v1::IThellexPOSV1;

#[starknet::contract]
pub mod ThellexPOSV1 {
    use crate::contracts::erc20::ERC20::IERC20DispatcherTrait;
use crate::contracts::erc20::ERC20::IERC20Dispatcher;
    use crate::interfaces::i_thellex_pos_factory::{
        IThellexPOSFactoryDispatcherTrait, 
        IThellexPOSFactoryDispatcher
    };
    use crate::interfaces::i_thellex_pos_v1::{
      Initialized,
      PaymentReceived,
      BalanceCredited,
      PaymentRejected,
      AutoRefunded,
      WithdrawalExecuted,
      PaymentRequest,
      PaymentRequestCreated,
      PaymentRequestFulfilled,
      ExternalDepositRegistered,
      RefundSent,
      ThellexPOSEvent
    };
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
        factory: ContractAddress, 
        rejection_count: Map<ContractAddress, u8>,
        payment_requests: Map<felt252, PaymentRequest>,
        min_withdrawal_limit: u256, 
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
        PaymentRequestCreated: PaymentRequestCreated,
        PaymentRequestFulfilled: PaymentRequestFulfilled,
        ExternalDepositRegistered: ExternalDepositRegistered,
        RefundSent: RefundSent
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        treasury: ContractAddress,
        fee_percent: u256,
        tax_percent: u256,
        timeout: u64,
        min_withdrawal_limit: u256,
        factory_address: ContractAddress
    ) {
        self.initialize(owner, treasury, fee_percent, tax_percent, timeout, min_withdrawal_limit, factory_address);
    }

    #[abi(embed_v0)]
    impl ThellexPOSV1Impl of IThellexPOSV1<ContractState> {
        fn initialize(
            ref self: ContractState,
            owner: ContractAddress,
            treasury: ContractAddress,
            fee_percent: u256,
            tax_percent: u256,
            timeout: u64,
            min_withdrawal_limit: u256,
            factory_address: ContractAddress
        ) {
            assert(!self.initialized.read(), 'Already initialized');
            assert(owner.is_non_zero(), 'Invalid owner');
            assert(treasury.is_non_zero(), 'Invalid treasury');
            assert(fee_percent <= 10000, 'Fee percent too high');
            assert(tax_percent <= 10000, 'Tax percent too high');
            assert(timeout > 0, 'Invalid timeout');

            self.owner.write(owner);
            self.treasury.write(treasury);
            self.fee_percent.write(fee_percent);
            self.tax_percent.write(tax_percent);
            self.timeout.write(timeout);
            self.admins.write(owner, true); 
            self.min_withdrawal_limit.write(min_withdrawal_limit);
            self.initialized.write(true);
            self.factory.write(factory_address);

            self.emit(Event::Initialized (
                Initialized{
                  owner,
                  treasury,
                  fee_percent,
                  tax_percent,
                  timeout
                }
            ));
        }

        fn deposit(ref self: ContractState, amount: u256, tx_id: felt252, token: ContractAddress) {
            //Existing checks
            assert(self.initialized.read(), 'Not initialized');
            assert(!self.paused.read(), 'Contract paused');
            assert(amount > 0, 'Invalid amount');
            assert(token.is_non_zero(), 'Invalid token');
            assert(IThellexPOSFactoryDispatcher { contract_address: self.factory.read() }
              .is_supported_token(token), 'Unsupported token');
            assert(self.deposits.read(tx_id) == 0, 'Duplicate tx_id');
             // Transfer tokens from user to contract
            let sender = get_caller_address();
            let token_contract = IERC20Dispatcher { contract_address: token };
            // let success = token_contract.transferFrom(sender, starknet::get_contract_address(), amount);
            // assert(success, 'Token transfer failed');
            self.deposits.write(tx_id, amount);
            self.deposit_senders.write(tx_id, sender);
            self.deposit_tokens.write(tx_id, token);
            self.deposit_timestamps.write(tx_id, get_block_timestamp());
            self.emit(Event::PaymentReceived(PaymentReceived { sender, amount, token, tx_id }));
        }

         fn register_external_deposit(
            ref self: ContractState,
            amount: u256,
            token: ContractAddress,
            sender: ContractAddress
        ) -> felt252 {
            assert(self.initialized.read(), 'Not initialized');
            assert(!self.paused.read(), 'Contract paused');
            assert(amount > 0, 'Invalid amount');
            assert(token.is_non_zero(), 'Invalid token');
            assert(sender.is_non_zero(), 'Invalid sender');
            assert(IThellexPOSFactoryDispatcher { contract_address: self.factory.read() }
                .is_supported_token(token), 'Unsupported token');

            let tx_id_u256 = self.transaction_counter.read();
            let tx_id: felt252 = tx_id_u256.low.into();
            self.transaction_counter.write(self.transaction_counter.read() + 1);
            assert(self.deposits.read(tx_id) == 0, 'Generated tx_id collision');

            self.deposits.write(tx_id, amount);
            self.deposit_senders.write(tx_id, sender);
            self.deposit_tokens.write(tx_id, token);
            self.deposit_timestamps.write(tx_id, get_block_timestamp());

            self.emit(Event::PaymentReceived(PaymentReceived {
                sender,
                amount,
                token,
                tx_id
            }));

            self.emit(Event::ExternalDepositRegistered(
                ExternalDepositRegistered { sender, amount, token, tx_id }
            ));

            tx_id
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

            self.rejection_count.write(self.owner.read(), 0);

            self.emit(Event::BalanceCredited(BalanceCredited {
                // merchant: get_contract_address().into(),
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

            let current_rejections = self.rejection_count.read(get_caller_address());
            assert(current_rejections < 2 || self.balances.read(token) > 0, 'Rejection limit reached');

            self.rejection_count.write(get_caller_address(), current_rejections + 1);

            // --- Perform refund to provided address ---
            assert(sender.is_non_zero(), 'Invalid refund address');

            let erc20 = IERC20Dispatcher { contract_address: token };
            erc20.transfer(sender, amount);

            self.deposits.write(tx_id, 0);
            self.deposit_senders.write(tx_id, contract_address_const::<0>());
            self.deposit_tokens.write(tx_id, contract_address_const::<0>());
            self.deposit_timestamps.write(tx_id, 0);

            self.emit(Event::PaymentRejected(PaymentRejected { sender, amount, token, tx_id }));
        }

        fn auto_refunded_amount(
            ref self: ContractState,
            tx_id: felt252,
            refund_receiver: ContractAddress 
        ) {
            assert(self.initialized.read(), 'Not initialized');
            assert(!self.paused.read(), 'Contract paused');
            assert(refund_receiver.is_non_zero(), 'Invalid refund receiver');

            let amount = self.deposits.read(tx_id);
            assert(amount > 0, 'Invalid or processed tx_id');

            let timestamp = self.deposit_timestamps.read(tx_id);
            assert(get_block_timestamp() >= timestamp + self.timeout.read(), 'Timeout not reached');

            let token = self.deposit_tokens.read(tx_id);
            let sender = self.deposit_senders.read(tx_id);

            let current_rejections = self.rejection_count.read(self.owner.read());
            assert(
                current_rejections < 2 || self.balances.read(token) > 0,
                'Rejection limit reached'
            );

            self.rejection_count.write(self.owner.read(), current_rejections + 1);

            let tax = amount * self.tax_percent.read() / 10000;
            let refund_amount = amount - tax;

            let transfer_result = IERC20Dispatcher { contract_address: token }
                .transfer(refund_receiver, refund_amount);

            // assert(transfer_result.is_ok(), 'Refund transfer failed');

            self.deposits.write(tx_id, 0);
            self.deposit_senders.write(tx_id, contract_address_const::<0>());
            self.deposit_tokens.write(tx_id, contract_address_const::<0>());
            self.deposit_timestamps.write(tx_id, 0);

            // 📢 Emit event with original sender and refund receiver for transparency
            self.emit(Event::AutoRefunded(
                AutoRefunded {
                    sender,
                    amount: refund_amount,
                    tax,
                    token,
                    tx_id
                }
            ));

            self.emit(Event::RefundSent(
                RefundSent {
                    original_sender: sender,
                    refund_receiver,
                    amount: refund_amount,
                    token,
                    tx_id
                }
            ));
        }

        fn create_payment_request(
            ref self: ContractState,
            amount: u256,
            token: ContractAddress,
            request_id: felt252
        ) {
            assert(self.initialized.read(), 'Not initialized');
            assert(!self.paused.read(), 'Contract paused');
            assert(self.admins.read(get_caller_address()), 'Unauthorized');
            assert(amount > 0, 'Invalid amount');
            assert(token.is_non_zero(), 'Invalid token');
            assert(IThellexPOSFactoryDispatcher { contract_address: self.factory.read() }
                .is_supported_token(token), 'Unsupported token');
            assert(self.payment_requests.read(request_id).amount == 0, 'Duplicate request_id');

            let request = PaymentRequest {
                amount,
                token,
                requester: get_caller_address(),
                active: true,
            };

            self.payment_requests.write(request_id, request);
            self.emit(Event::PaymentRequestCreated(PaymentRequestCreated {
                    request_id,
                    requester: get_caller_address(),
                    amount,
                    token
                }
            ));
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

            assert(IThellexPOSFactoryDispatcher { contract_address: self.factory.read() }
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

            self.emit(Event::PaymentRequestFulfilled(
                PaymentRequestFulfilled { request_id, sender, amount, token }
            ));
            self.emit(Event::BalanceCredited(BalanceCredited {
                amount: net_amount,
                token
            }));
        }

        fn withdraw_funds(ref self: ContractState, recipient: ContractAddress, amount: u256, token: ContractAddress) {
            assert(self.initialized.read(), 'Not initialized');
            assert(!self.paused.read(), 'Contract paused');
            assert(self.admins.read(get_caller_address()), 'Unauthorized');
            assert(amount > 0, 'Invalid amount');
            assert(amount >= self.min_withdrawal_limit.read(), 'Below min withdrawal limit');
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

        fn get_min_withdrawal_limit(ref self: ContractState) -> u256 {
            self.min_withdrawal_limit.read()
        }
    }
}