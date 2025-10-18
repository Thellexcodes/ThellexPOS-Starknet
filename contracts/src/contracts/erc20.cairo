#[starknet::contract]
pub mod ERC20 {
    use starknet::storage::StorageMapWriteAccess;
    use starknet::storage::StorageMapReadAccess;
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::storage::{ Map };

    #[storage]
    struct Storage {
        name: ByteArray,
        symbol: ByteArray,
        decimals: u8,
        total_supply: u256,
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Transfer: Transfer,
        Approval: Approval,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Transfer {
        #[key]
        from: ContractAddress,
        #[key]
        to: ContractAddress,
        value: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Approval {
        #[key]
        owner: ContractAddress,
        #[key]
        spender: ContractAddress,
        value: u256,
    }

    // Interface (ERC20 standard functions)
    #[starknet::interface]
    pub trait IERC20<TContractState> {
        fn name(self: @TContractState) -> ByteArray;
        fn symbol(self: @TContractState) -> ByteArray;
        fn decimals(self: @TContractState) -> u8;
        fn total_supply(self: @TContractState) -> u256;

        fn balance_of(self: @TContractState, owner: ContractAddress) -> u256;

        fn transfer(ref self: TContractState, to: ContractAddress, value: u256) -> bool;
        fn approve(ref self: TContractState, spender: ContractAddress, value: u256) -> bool;
        fn transfer_from(ref self: TContractState, from: ContractAddress, to: ContractAddress, value: u256) -> bool;

        fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
    }

    #[abi(embed_v0)]
    impl ERC20Impl of IERC20<ContractState> {
        fn name(self: @ContractState) -> ByteArray {
            self.name.read()
        }
        fn symbol(self: @ContractState) -> ByteArray {
            self.symbol.read()
        }
        fn decimals(self: @ContractState) -> u8 {
            self.decimals.read()
        }
        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }
        fn balance_of(self: @ContractState, owner: ContractAddress) -> u256 {
            self.balances.read(owner)
        }
        fn transfer(ref self: ContractState, to: ContractAddress, value: u256) -> bool {
            let sender = get_caller_address();
            let mut sender_balance = self.balances.read(sender);
            assert(sender_balance >= value, 'Insufficient balance');
            sender_balance = sender_balance - value;
            self.balances.write(sender, sender_balance);

            let mut recipient_balance = self.balances.read(to);
            recipient_balance = recipient_balance + value;
            self.balances.write(to, recipient_balance);

            self.emit(Transfer { from: sender, to, value });
            true
        }
        fn approve(ref self: ContractState, spender: ContractAddress, value: u256) -> bool {
            let owner = get_caller_address();
            self.allowances.write((owner, spender), value);
            self.emit(Approval { owner, spender, value });
            true
        }
        fn transfer_from(ref self: ContractState, from: ContractAddress, to: ContractAddress, value: u256) -> bool {
            let spender = get_caller_address();
            let mut allowance = self.allowances.read((from, spender));
            assert(allowance >= value, 'Allowance exceeded');

            let mut from_balance = self.balances.read(from);
            assert(from_balance >= value, 'Insufficient balance');

            from_balance = from_balance - value;
            self.balances.write(from, from_balance);

            let mut to_balance = self.balances.read(to);
            to_balance = to_balance + value;
            self.balances.write(to, to_balance);

            allowance = allowance - value;
            self.allowances.write((from, spender), allowance);

            self.emit(Transfer { from, to, value });
            true
        }
        fn allowance(self: @ContractState, owner: ContractAddress, spender: ContractAddress) -> u256 {
            self.allowances.read((owner, spender))
        }
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        decimals: u8,
        initial_supply: u256,
        recipient: ContractAddress
    ) {
        self.name.write(name);
        self.symbol.write(symbol);
        self.decimals.write(decimals);
        self.total_supply.write(initial_supply);
        self.balances.write(recipient, initial_supply);
        // self.emit(Transfer { from: ContractAddress::from(0), to: recipient, value: initial_supply });
    }
}
