#[cfg(test)]
mod tests {
    use crate::contracts::erc20::ERC20::IERC20DispatcherTrait;
    use core::debug;
    use core::num::traits::Zero;
    use snforge_std::{
        declare, ContractClassTrait, DeclareResultTrait, ContractClass,
        start_cheat_caller_address, stop_cheat_caller_address,
        start_cheat_block_timestamp_global, stop_cheat_block_timestamp_global,
        spy_events, EventSpyAssertionsTrait
    };
    use core::debug::print_byte_array_as_string;
    use starknet::{
        ContractAddress,
        contract_address_const,
        syscalls::deploy_syscall,
        SyscallResultTrait,
        class_hash::ClassHash,
    };
    use core::zeroable::NonZero;
    use thellexpos::interfaces::i_thellex_pos_factory::{
        IThellexPOSFactoryDispatcher,
        IThellexPOSFactoryDispatcherTrait,
        ThellexPOSFactoryEvent,
        TokenSupportUpdated,
        POSCreated,
    };
    use thellexpos::interfaces::i_thellex_pos_v1::{
        IThellexPOSV1Dispatcher,
        IThellexPOSV1DispatcherTrait,
        ThellexPOSEvent,
        Initialized,
        PaymentReceived,
        BalanceCredited,
        PaymentRejected,
        AutoRefunded,
        WithdrawalExecuted,
    };
    use thellexpos::contracts::thellex_pos_v1::ThellexPOSV1 as POSContract;
        use core::fmt::{Display, Formatter, Error};
    use thellexpos::contracts::erc20::ERC20::{IERC20, IERC20Dispatcher};


    // -----------------------------
    // Helpers
    // -----------------------------

    /// Calls initialize on the factory
    // fn initialize_factory(
    //     factory: IThellexPOSFactoryDispatcher,
    //     treasury: ContractAddress,
    //     fee_percent: u256,
    //     tax_percent: u256,
    //     timeout: u64,
    // ) {
    //     testing::set_caller_address(treasury);
    //     factory.initialize(treasury, fee_percent, tax_percent, timeout);
    // }

    fn owner() -> ContractAddress {
        contract_address_const::<1>()
    }

    /// Deploys a POS contract via the factory
    fn deploy_pos_via_factory(
        factory: IThellexPOSFactoryDispatcher,
        owner: ContractAddress,
        deposit_address: ContractAddress,
    ) -> (ContractAddress, IThellexPOSV1Dispatcher) {
        // Always declare class before factory call
        let pos_class = declare("ThellexPOSV1").unwrap().contract_class();
        let pos_class_hash: ClassHash = (*pos_class.class_hash).into();

        // Deploy POS via factory
        let pos_address = factory.create_pos(owner, deposit_address, pos_class_hash);

        // Ensure non-zero address for safety
        assert(pos_address.is_non_zero(), str_to_felt252("Factory returned zero POS address"));

        // Return both address and dispatcher
        (pos_address, IThellexPOSV1Dispatcher { contract_address: pos_address })
    }
 

    fn str_to_felt252(s: ByteArray) -> felt252 {
        let mut bytes = s; 
        let mut result: felt252 = 0;
        let mut i = 0;
        while i < bytes.len() && i < 31 {
            let byte = bytes[i];
            result = (result * 256) + byte.into();
            i += 1;
        };
        result
    }

    fn deploy_erc20(name: ByteArray, symbol: ByteArray, initial_supply: u256, recipient: ContractAddress) -> IERC20Dispatcher {
      let contract = declare("ERC20").unwrap().contract_class();
      let mut calldata = array![];
      // Serialize ByteArray manually to ensure correct format
      let name_data: ByteArray = name;
      let symbol_data: ByteArray = symbol;
      name_data.serialize(ref calldata);
      symbol_data.serialize(ref calldata);
      18_u8.serialize(ref calldata);
      initial_supply.serialize(ref calldata);
      recipient.serialize(ref calldata);
      let (erc20_address, _) = contract.deploy(@calldata).unwrap();
      IERC20Dispatcher { contract_address: erc20_address }
  }

  // Deploy factory
  fn deploy_factory() -> (ContractAddress, IThellexPOSFactoryDispatcher, ContractClass, Array<felt252>) {
        let contract = *declare("ThellexPOSFactory")
            .unwrap()
            .contract_class();

        // empty calldata for now
        let mut calldata = ArrayTrait::new();

        // deploy
        let (factory_address, _) = contract.deploy(@calldata).unwrap();

        (
            factory_address,
            IThellexPOSFactoryDispatcher { contract_address: factory_address },
            contract,
            calldata
        )
    }
 

    // -----------------------------
    // Tests
    // -----------------------------
    #[test]
    #[fuzzer]
    fn test_factory_initialization(_fuzz_name: felt252) {
        let treasury = contract_address_const::<1>();
        let fee_percent = 100_u256; // 1%
        let tax_percent = 50_u256;  // 0.5%
        let timeout = 3600_u64;

        let (factory_address, dispatcher, _, _) = deploy_factory();
        dispatcher.initialize(treasury, fee_percent, tax_percent, timeout);

        // Verify initialization
        assert(dispatcher.get_treasury() == treasury, str_to_felt252("Treasury mismatch"));
        assert(dispatcher.get_fee_percent() == fee_percent, str_to_felt252("Fee percent mismatch"));
        assert(dispatcher.get_tax_percent() == tax_percent, str_to_felt252("Tax mismatch"));
        assert(dispatcher.get_timeout() == timeout, str_to_felt252("Timeout mismatch"));
    }

    #[test]
    fn test_factory_updates() {
        let treasury = owner();
        let new_treasury = contract_address_const::<'new_treasury'>();
        let fee_percent = 100_u256;
        let new_fee_percent = 200_u256;
        let tax_percent = 50_u256;
        let new_tax_percent = 100_u256;
        let timeout = 3600_u64;
        let new_timeout = 7200_u64;

        let (factory_address, dispatcher, _, _) = deploy_factory();
        start_cheat_caller_address(factory_address, owner());
        dispatcher.initialize(owner(), fee_percent, tax_percent, timeout);

        // Update treasury
        dispatcher.update_treasury(treasury);
        assert(dispatcher.get_treasury() == treasury, str_to_felt252("Treasury update failed"));

        // Update fee percent
        dispatcher.update_fee_percent(new_fee_percent);
        assert(dispatcher.get_fee_percent() == new_fee_percent, str_to_felt252("Fee update failed"));

        // Update tax percent
        dispatcher.update_tax_percent(new_tax_percent);
        assert(dispatcher.get_tax_percent() == new_tax_percent, str_to_felt252("Tax update failed"));

        // Update timeout
        dispatcher.update_timeout(new_timeout);
        assert(dispatcher.get_timeout() == new_timeout, str_to_felt252("Timeout update failed"));

        // Test pause
        // dispatcher.set_paused(true);
        // assert(dispatcher.paused.read(), str_to_felt252("Pause failed"));
        // dispatcher.set_paused(false);
        // assert(!dispatcher.paused.read(), str_to_felt252("Unpause failed"));
        stop_cheat_caller_address(factory_address);
    }

    #[test]
    fn test_pos_creation() {
        let treasury = owner();
        let fee_percent = 100_u256;
        let tax_percent = 50_u256;
        let timeout = 3600_u64;

        let pos_owner = contract_address_const::<2>();
        let deposit_address = contract_address_const::<'deposit_address'>();

        let (factory_address, factory, _, _) = deploy_factory();
        start_cheat_caller_address(factory_address, treasury);

        let mut spy = spy_events();
        factory.initialize(treasury, fee_percent, tax_percent, timeout);

        let (pos_address, _) = deploy_pos_via_factory(factory, pos_owner, deposit_address);

        assert(pos_address.is_non_zero(), str_to_felt252("POS deployment failed"));

        spy.assert_emitted(@array![
            (
                factory_address,
                ThellexPOSFactoryEvent::POSCreated(POSCreated {
                    merchant: pos_owner,
                    pos_address: pos_address
                })
            ),
        ]);

        stop_cheat_caller_address(factory_address);
    }

    #[test]
fn test_pos_deposit_tbtc() {
    let treasury = contract_address_const::<1>();
    let fee_percent = 100_u256;
    let tax_percent = 50_u256;
    let timeout = 3600_u64;
    let deposit_address = contract_address_const::<3>();
    let sender = contract_address_const::<4>();
    let tbtc = deploy_erc20("tBTC", "tBTC", 1_000_000_u256, sender);
    let amount = 1000_u256;
    let tx_id = 123_felt252;

    // -----------------------------
    // Deploy factory and spy events
    // -----------------------------
    let (factory_address, factory, _, _) = deploy_factory();
    let mut spy = spy_events();

    // Initialize factory with treasury as caller
    start_cheat_caller_address(factory_address, treasury);
    factory.initialize(treasury, fee_percent, tax_percent, timeout);

    // Add supported token at the factory level
    factory.add_supported_token(tbtc.contract_address);
    stop_cheat_caller_address(factory_address);

    // -----------------------------
    // Deploy POS via factory
    // -----------------------------
    let (pos_address, pos_dispatcher) =
        deploy_pos_via_factory(factory, treasury, deposit_address);

    // -----------------------------
    // Approve ERC20 for POS deposit
    // -----------------------------
    let erc20 = IERC20Dispatcher { contract_address: tbtc.contract_address };
    start_cheat_caller_address(tbtc.contract_address, sender);
    erc20.approve(pos_address, amount);
    stop_cheat_caller_address(tbtc.contract_address);

    // -----------------------------
    // Deposit tokens into POS
    // -----------------------------
    start_cheat_caller_address(pos_address, sender);
    pos_dispatcher.deposit(amount, tx_id, tbtc.contract_address);
    stop_cheat_caller_address(pos_address);

    // -----------------------------
    // Check deposit details
    // -----------------------------
    let (dep_sender, dep_amount, dep_token, dep_timestamp) = pos_dispatcher.get_deposit(tx_id);
    assert(dep_sender == sender, str_to_felt252("Deposit sender mismatch"));
    assert(dep_amount == amount, str_to_felt252("Deposit amount mismatch"));
    assert(dep_token == tbtc.contract_address, str_to_felt252("Deposit token mismatch"));
    // assert(dep_timestamp > 0, str_to_felt252("Deposit timestamp invalid"));

    // -----------------------------
    // Assert emitted events
    // -----------------------------
    let expected_owner = treasury; // POS owner set in create_pos

    spy.assert_emitted(@array![
        (
            factory_address,
            ThellexPOSFactoryEvent::POSCreated(POSCreated {
                merchant: expected_owner,
                pos_address
            })
        ),
        (
            factory_address,
            ThellexPOSFactoryEvent::TokenSupportUpdated(TokenSupportUpdated {
                token: tbtc.contract_address,
                supported: true
            })
        ),
    ]);

    spy.assert_emitted(@array![ 
        ( pos_address, 
          ThellexPOSEvent::Initialized(Initialized { 
            owner: expected_owner, 
            deposit_address, 
            treasury, 
            fee_percent, 
            tax_percent, 
            timeout 
          }) 
        ) 
      ]);
}


  #[test]
  fn test_pos_approve_transaction() {
      let treasury = contract_address_const::<1>();
      let fee_percent = 100_u256;
      let tax_percent = 50_u256;
      let timeout = 3600_u64;
      let owner = contract_address_const::<1>();
      let deposit_address = contract_address_const::<3>();
      let sender = contract_address_const::<4>();
      let tbtc = deploy_erc20("tBTC", "tBTC", 1_000_000_u256, sender);
      let amount = 1000_u256;
      let tx_id = 123_felt252;

      // -----------------------------
      // Deploy factory
      // -----------------------------
      let (factory_address, factory, _, _) = deploy_factory();

      // Spy events
      let mut spy = spy_events();

      // Initialize factory with treasury as caller
      start_cheat_caller_address(factory_address, treasury);
      factory.initialize(treasury, fee_percent, tax_percent, timeout);
      factory.add_supported_token(tbtc.contract_address);
      stop_cheat_caller_address(factory_address);

      // -----------------------------
      // Deploy POS via factory
      // -----------------------------
      let (pos_address, pos_dispatcher) =
          deploy_pos_via_factory(factory, treasury, deposit_address);

      // -----------------------------
      // Add supported token
      // -----------------------------
      // start_cheat_caller_address(pos_address, treasury);
      // stop_cheat_caller_address(pos_address);

      // -----------------------------
      // Approve ERC20 and deposit
      // -----------------------------
      let erc20 = IERC20Dispatcher { contract_address: tbtc.contract_address };
      start_cheat_caller_address(tbtc.contract_address, sender);
      erc20.approve(pos_address, amount);
      stop_cheat_caller_address(tbtc.contract_address);

      start_cheat_caller_address(pos_address, sender);
      pos_dispatcher.deposit(amount, tx_id, tbtc.contract_address);
      stop_cheat_caller_address(pos_address);

      // -----------------------------
      // Approve transaction
      // -----------------------------
      start_cheat_caller_address(pos_address, owner);
      pos_dispatcher.approve_transaction(tx_id);
      stop_cheat_caller_address(pos_address);

      let net_amount = amount - (amount * fee_percent / 10000);

      spy.assert_emitted(@array![
          (
              pos_address,
              ThellexPOSEvent::PaymentReceived(PaymentReceived {
                  sender,
                  amount,
                  token: tbtc.contract_address,
                  tx_id
              })
          ),
          (
              pos_address,
              ThellexPOSEvent::BalanceCredited(BalanceCredited {
                  merchant: deposit_address,
                  amount: net_amount,
                  token: tbtc.contract_address
              })
          )
      ]);
  }

  #[test]
  fn test_pos_reject_transaction() {
      let treasury = contract_address_const::<1>();
      let fee_percent = 100_u256;
      let tax_percent = 50_u256;
      let timeout = 3600_u64;
      let owner = contract_address_const::<1>();
      let deposit_address = contract_address_const::<3>();
      let sender = contract_address_const::<4>();
      let tbtc = deploy_erc20("tBTC", "tBTC", 1_000_000_u256, sender);
      let amount = 1000_u256;
      let tx_id = 123_felt252;

      // -----------------------------
      // Deploy factory
      // -----------------------------
      let (factory_address, factory, _, _) = deploy_factory();

      // Initialize factory with treasury as caller
      start_cheat_caller_address(factory_address, treasury);
      factory.initialize(treasury, fee_percent, tax_percent, timeout);

      // Add supported token at the factory level
      factory.add_supported_token(tbtc.contract_address);
      stop_cheat_caller_address(factory_address);

      // -----------------------------
      // Deploy POS via factory with correct owner
      // -----------------------------
      let (pos_address, pos_dispatcher) =
          deploy_pos_via_factory(factory, owner, deposit_address);

      // -----------------------------
      // Start spying events
      // -----------------------------
      let mut spy = spy_events();

      // -----------------------------
      // Approve ERC20 and deposit
      // -----------------------------
      let erc20 = IERC20Dispatcher { contract_address: tbtc.contract_address };
      start_cheat_caller_address(tbtc.contract_address, sender);
      erc20.approve(pos_address, amount);
      stop_cheat_caller_address(tbtc.contract_address);

      start_cheat_caller_address(pos_address, sender);
      pos_dispatcher.deposit(amount, tx_id, tbtc.contract_address);
      stop_cheat_caller_address(pos_address);

      // -----------------------------
      // Reject transaction
      // -----------------------------
      start_cheat_caller_address(pos_address, owner);
      pos_dispatcher.reject_transaction(tx_id);
      stop_cheat_caller_address(pos_address);

      // -----------------------------
      // Check deposit cleared
      // -----------------------------
      let (dep_sender, dep_amount, dep_token, dep_timestamp) = pos_dispatcher.get_deposit(tx_id);
      assert(dep_amount == 0, str_to_felt252("Deposit not cleared"));
      assert(dep_sender.is_zero(), str_to_felt252("Sender not cleared"));
      assert(dep_token.is_zero(), str_to_felt252("Token not cleared"));
      assert(dep_timestamp == 0, str_to_felt252("Timestamp not cleared"));

      // -----------------------------
      // Check emitted events
      // -----------------------------
      spy.assert_emitted(@array![
          (
              pos_address,
              ThellexPOSEvent::PaymentReceived(PaymentReceived {
                  sender,
                  amount,
                  token: tbtc.contract_address,
                  tx_id
              })
          ),
          (
              pos_address,
              ThellexPOSEvent::PaymentRejected(PaymentRejected {
                  sender,
                  amount,
                  token: tbtc.contract_address,
                  tx_id
              })
          )
      ]);
  }

  #[test]
  fn test_pos_auto_refunded_amount() {
      let treasury = contract_address_const::<1>();
      let fee_percent = 100_u256;
      let tax_percent = 50_u256;
      let timeout = 3600_u64;
      let owner = contract_address_const::<1>();
      let deposit_address = contract_address_const::<3>();
      let sender = contract_address_const::<4>();
      let tbtc = deploy_erc20("tBTC", "tBTC", 1_000_000_u256, sender);
      let amount = 1000_u256;
      let tx_id = 123_felt252;

      // -----------------------------
      // Deploy factory
      // -----------------------------
      let (factory_address, factory, _, _) = deploy_factory();

      // Initialize factory and add supported token
      start_cheat_caller_address(factory_address, treasury);
      factory.initialize(treasury, fee_percent, tax_percent, timeout);
      factory.add_supported_token(tbtc.contract_address);
      stop_cheat_caller_address(factory_address);

      // -----------------------------
      // Deploy POS via factory
      // -----------------------------
      let (pos_address, pos) = deploy_pos_via_factory(factory, owner, deposit_address);

      // -----------------------------
      // Start spying events
      // -----------------------------
      let mut spy = spy_events();

      // -----------------------------
      // Approve ERC20 for POS deposit
      // -----------------------------
      let erc20 = IERC20Dispatcher { contract_address: tbtc.contract_address };
      start_cheat_caller_address(tbtc.contract_address, sender);
      erc20.approve(pos_address, amount);
      stop_cheat_caller_address(tbtc.contract_address);

      // -----------------------------
      // Deposit tokens into POS
      // -----------------------------
      start_cheat_caller_address(pos_address, sender);
      pos.deposit(amount, tx_id, tbtc.contract_address);
      stop_cheat_caller_address(pos_address);

      // -----------------------------
      // Move block timestamp to trigger auto refund
      // -----------------------------
      start_cheat_block_timestamp_global(timeout + 1);
    //   pos.auto_refunded_amount(tx_id);
      stop_cheat_block_timestamp_global();

      // -----------------------------
      // Check deposit cleared
      // -----------------------------
      let (dep_sender, dep_amount, dep_token, dep_timestamp) = pos.get_deposit(tx_id);
      assert(dep_amount == 0, str_to_felt252("Deposit not cleared"));
      assert(dep_sender.is_zero(), str_to_felt252("Sender not cleared"));
      assert(dep_token.is_zero(), str_to_felt252("Token not cleared"));
      assert(dep_timestamp == 0, str_to_felt252("Timestamp not cleared"));

      // -----------------------------
      // Check emitted events
      // -----------------------------
      let tax = amount * tax_percent / 10000;
      let refund_amount = amount - tax;
      spy.assert_emitted(@array![
          (
              pos_address,
              ThellexPOSEvent::PaymentReceived(PaymentReceived {
                  sender,
                  amount,
                  token: tbtc.contract_address,
                  tx_id
              })
          ),
          (
              pos_address,
              ThellexPOSEvent::AutoRefunded(AutoRefunded {
                  sender,
                  amount: refund_amount,
                  tax,
                  token: tbtc.contract_address,
                  tx_id
              })
          )
      ]);
  }

  #[test]
  fn test_pos_withdraw_funds() {
      let treasury = contract_address_const::<1>();
      let fee_percent = 100_u256;
      let tax_percent = 50_u256;
      let timeout = 3600_u64;
      let owner = contract_address_const::<1>();
      let deposit_address = contract_address_const::<3>();
      let sender = contract_address_const::<4>();
      let tbtc = deploy_erc20("tBTC", "tBTC", 1_000_000_u256, sender);
      let recipient = contract_address_const::<6>();
      let amount = 1000_u256;
      let tx_id = 123_felt252;

      // -----------------------------
      // Deploy factory and initialize
      // -----------------------------
      let (factory_address, factory, _, _) = deploy_factory();

      start_cheat_caller_address(factory_address, treasury);
      factory.initialize(treasury, fee_percent, tax_percent, timeout);
      factory.add_supported_token(tbtc.contract_address); // add token at factory level
      stop_cheat_caller_address(factory_address);

      // -----------------------------
      // Deploy POS via factory
      // -----------------------------
      let (pos_address, pos) = deploy_pos_via_factory(factory, owner, deposit_address);

      // -----------------------------
      // Start spying events
      // -----------------------------
      let mut spy = spy_events();

      // -----------------------------
      // Approve ERC20 and deposit
      // -----------------------------
      let erc20 = IERC20Dispatcher { contract_address: tbtc.contract_address };
      start_cheat_caller_address(tbtc.contract_address, sender);
      erc20.approve(pos_address, amount);
      stop_cheat_caller_address(tbtc.contract_address);

      start_cheat_caller_address(pos_address, sender);
      pos.deposit(amount, tx_id, tbtc.contract_address);
      stop_cheat_caller_address(pos_address);

      // -----------------------------
      // Approve transaction and withdraw funds
      // -----------------------------
      start_cheat_caller_address(pos_address, owner);
      pos.approve_transaction(tx_id);
      let withdraw_amount = amount - (amount * fee_percent / 10000);
      pos.withdraw_funds(recipient, withdraw_amount, tbtc.contract_address);
      stop_cheat_caller_address(pos_address);

      // -----------------------------
      // Check POS balance is zero
      // -----------------------------
      assert(pos.balances(tbtc.contract_address) == 0, str_to_felt252("Balance not cleared"));
              assert(pos.balances(tbtc.contract_address) == 0_u256, str_to_felt252("Balance not cleared"));

      // -----------------------------
      // Check emitted events
      // -----------------------------
      spy.assert_emitted(@array![
          (
              pos_address,
              ThellexPOSEvent::PaymentReceived(PaymentReceived {
                  sender,
                  amount,
                  token: tbtc.contract_address,
                  tx_id
              })
          ),
          (
              pos_address,
              ThellexPOSEvent::BalanceCredited(BalanceCredited {
                  merchant: deposit_address,
                  amount: withdraw_amount,
                  token: tbtc.contract_address
              })
          ),
          (
              pos_address,
              ThellexPOSEvent::WithdrawalExecuted(WithdrawalExecuted {
                  recipient,
                  amount: withdraw_amount,
                  token: tbtc.contract_address
              })
          )
      ]);
    }

    #[test]
    fn test_pos_batch_withdraw() {
        let treasury = contract_address_const::<1>();
        let fee_percent = 100_u256;
        let tax_percent = 50_u256;
        let timeout = 3600_u64;
        let owner = contract_address_const::<1>();
        let deposit_address = contract_address_const::<3>();
        let sender = contract_address_const::<4>();
        let tbtc = deploy_erc20("tBTC", "tBTC", 1_000_000_u256, sender);
        let recipient1 = contract_address_const::<6>();
        let recipient2 = contract_address_const::<7>();
        let amount = 1000_u256;
        let tx_id = 123_felt252;
        let supported_tokens = array![tbtc.contract_address];

        // -----------------------------
        // Deploy factory and initialize
        // -----------------------------
        let (factory_address, dispatcher, _, _) = deploy_factory();
        start_cheat_caller_address(factory_address, treasury);
        dispatcher.initialize(treasury, fee_percent, tax_percent, timeout);
        dispatcher.add_supported_token(tbtc.contract_address); // add token at factory level
        stop_cheat_caller_address(factory_address);

        // -----------------------------
        // Deploy POS via factory
        // -----------------------------
        let (pos_address, pos) = deploy_pos_via_factory(dispatcher, owner, deposit_address);

        // -----------------------------
        // Spy events
        // -----------------------------
        let mut spy = spy_events();

        // -----------------------------
        // Approve ERC20 and deposit
        // -----------------------------
        let erc20 = IERC20Dispatcher { contract_address: tbtc.contract_address };
        start_cheat_caller_address(tbtc.contract_address, sender);
        erc20.approve(pos_address, amount);
        stop_cheat_caller_address(tbtc.contract_address);

        start_cheat_caller_address(pos_address, sender);
        pos.deposit(amount, tx_id, tbtc.contract_address);
        stop_cheat_caller_address(pos_address);

        // -----------------------------
        // Approve transaction
        // -----------------------------
        start_cheat_caller_address(pos_address, owner);
        pos.approve_transaction(tx_id);

        // -----------------------------
        // Batch withdraw
        // -----------------------------
        let net_amount = amount - (amount * fee_percent / 10000);
        let withdraw_amount = net_amount / 2;
        let recipients = array![recipient1, recipient2];
        let amounts = array![withdraw_amount, withdraw_amount];
        let tokens = array![tbtc.contract_address, tbtc.contract_address];
        pos.batch_withdraw(recipients, amounts, tokens);
        stop_cheat_caller_address(pos_address);

        // -----------------------------
        // Check balance cleared
        // -----------------------------
        assert(pos.balances(tbtc.contract_address) == 0, str_to_felt252("Balance not cleared"));

        // -----------------------------
        // Check emitted events
        // -----------------------------
        spy.assert_emitted(@array![
            (
                pos_address,
                ThellexPOSEvent::PaymentReceived(PaymentReceived {
                    sender,
                    amount,
                    token: tbtc.contract_address,
                    tx_id
                })
            ),
            (
                pos_address,
                ThellexPOSEvent::BalanceCredited(BalanceCredited {
                    merchant: deposit_address,
                    amount: net_amount,
                    token: tbtc.contract_address
                })
            ),
            (
                pos_address,
                ThellexPOSEvent::WithdrawalExecuted(WithdrawalExecuted {
                    recipient: recipient1,
                    amount: withdraw_amount,
                    token: tbtc.contract_address
                })
            ),
            (
                pos_address,
                ThellexPOSEvent::WithdrawalExecuted(WithdrawalExecuted {
                    recipient: recipient2,
                    amount: withdraw_amount,
                    token: tbtc.contract_address
                })
            )
        ]);
    }

    // #[test]
    // fn test_pos_bridge_funds() {
    //     let treasury = contract_address_const::<1>();
    //     let fee_percent = 100_u256;
    //     let tax_percent = 50_u256;
    //     let timeout = 3600_u64;
    //     let owner = contract_address_const::<1>();
    //     let deposit_address = contract_address_const::<3>();
    //     let sender = contract_address_const::<4>();
    //     let tbtc = deploy_erc20("tBTC", "tBTC", 1000000_u256, sender);
    //     let recipient = contract_address_const::<6>();
    //     let amount = 1000_u256;
    //     let tx_id = 123_felt252;
    //     let target_chain = 0x534e5f4d41494e; // SN_MAIN
    //     let supported_tokens = array![tbtc.contract_address];

    //     let (factory_address, dispatcher, _, _) = deploy_factory();
    //     initialize_factory(dispatcher, treasury, fee_percent, tax_percent, timeout);
    //     let (pos_address, pos) = deploy_pos_via_factory(dispatcher, owner, deposit_address, supported_tokens);

    //     let mut spy = spy_events();
    //     start_cheat_caller_address(pos_address, sender);
    //     tbtc.approve(pos_address, amount);
    //     pos.deposit(amount, tx_id, tbtc.contract_address);
    //     stop_cheat_caller_address(pos_address);

    //     start_cheat_caller_address(pos_address, owner);
    //     pos.approve_transaction(tx_id);
    //     let bridge_amount = amount - (amount * fee_percent / 10000);
    //     pos.bridge_funds(bridge_amount, target_chain, recipient, tbtc.contract_address);
    //     stop_cheat_caller_address(pos_address);

    //     assert(pos.balances(tbtc.contract_address) == 0, str_to_felt252("Balance not cleared"));

    //     spy.assert_emitted(@array![
    //         (
    //             pos_address,
    //             ThellexPOSEvent::PaymentReceived(PaymentReceived {
    //                 sender,
    //                 amount,
    //                 token: tbtc.contract_address,
    //                 tx_id
    //             })
    //         ),
    //         (
    //             pos_address,
    //             ThellexPOSEvent::BalanceCredited(BalanceCredited {
    //                 merchant: deposit_address,
    //                 amount: bridge_amount,
    //                 token: tbtc.contract_address
    //             })
    //         ),
    //         (
    //             pos_address,
    //             ThellexPOSEvent::Bridged(Bridged {
    //                 recipient,
    //                 amount: bridge_amount,
    //                 token: tbtc.contract_address,
    //                 target_chain
    //             })
    //         )
    //     ]);
    // }

    // #[test]
    // fn test_pos_swap_tokens() {
    //     let treasury = contract_address_const::<1>();
    //     let fee_percent = 100_u256;
    //     let tax_percent = 50_u256;
    //     let timeout = 3600_u64;
    //     let owner = contract_address_const::<1>();
    //     let deposit_address = contract_address_const::<3>();
    //     let sender = contract_address_const::<4>();
    //     let tbtc = deploy_erc20("tBTC", "tBTC", 1000000_u256, sender);
    //     let usdc = deploy_erc20("USDC", "USDC", 1000000_u256, sender);
    //     let amount = 1000_u256;
    //     let tx_id = 123_felt252;
    //     let supported_tokens = array![tbtc.contract_address, usdc.contract_address];

    //     let (factory_address, dispatcher, _, _) = deploy_factory();
    //     initialize_factory(dispatcher, treasury, fee_percent, tax_percent, timeout);
    //     let (pos_address, pos) = deploy_pos_via_factory(dispatcher, owner, deposit_address, supported_tokens);

    //     let mut spy = spy_events();
    //     start_cheat_caller_address(pos_address, sender);
    //     tbtc.approve(pos_address, amount);
    //     pos.deposit(amount, tx_id, tbtc.contract_address);
    //     stop_cheat_caller_address(pos_address);

    //     start_cheat_caller_address(pos_address, owner);
    //     pos.approve_transaction(tx_id);
    //     let swap_amount = amount - (amount * fee_percent / 10000);
    //     pos.swap_tokens(swap_amount, tbtc.contract_address, usdc.contract_address);
    //     stop_cheat_caller_address(pos_address);

    //     assert(pos.balances(tbtc.contract_address) == 0, str_to_felt252("tBTC balance not cleared"));
    //     assert(pos.balances(usdc.contract_address) == swap_amount, str_to_felt252("USDC balance mismatch"));

    //     spy.assert_emitted(@array![
    //         (
    //             pos_address,
    //             ThellexPOSEvent::PaymentReceived(PaymentReceived {
    //                 sender,
    //                 amount,
    //                 token: tbtc.contract_address,
    //                 tx_id
    //             })
    //         ),
    //         (
    //             pos_address,
    //             ThellexPOSEvent::BalanceCredited(BalanceCredited {
    //                 merchant: deposit_address,
    //                 amount: swap_amount,
    //                 token: tbtc.contract_address
    //             })
    //         ),
    //         (
    //             pos_address,
    //             ThellexPOSEvent::SwapExecuted(SwapExecuted {
    //                 merchant: owner,
    //                 from_token: tbtc.contract_address,
    //                 to_token: usdc.contract_address,
    //                 amount_in: swap_amount,
    //                 amount_out: swap_amount
    //             })
    //         )
    //     ]);
    // }
}

