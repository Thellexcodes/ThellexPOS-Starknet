#[starknet::contract]
mod WithdrawalModule {
    use core::num::traits::Zero;
use starknet::ContractAddress;

    #[storage]
    struct Storage {
        // No storage needed, operates via ThellexPOSV1
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        WithdrawalExecuted: WithdrawalExecuted,
    }

    #[derive(Drop, starknet::Event)]
    struct WithdrawalExecuted {
        recipient: ContractAddress,
        amount: u256,
        token: ContractAddress,
    }

    #[external(v0)]
    fn withdraw_funds(ref self: ContractState, pos_contract: ContractAddress, recipient: ContractAddress, amount: u256, token: ContractAddress) {
        assert(amount > 0, 'Invalid amount');
        assert(recipient.is_non_zero(), 'Invalid recipient');
        assert(token.is_non_zero(), 'Invalid token');

        self.emit(WithdrawalExecuted { recipient, amount, token });
    }

    #[external(v0)]
    fn batch_withdraw(ref self: ContractState, pos_contract: ContractAddress, recipients: Array<ContractAddress>, amounts: Array<u256>, tokens: Array<ContractAddress>) {
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

            self.emit(WithdrawalExecuted { recipient, amount, token });
            i += 1;
        }
    }
}