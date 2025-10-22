#[starknet::contract]
pub mod ThellexPOSFactory {
  
use starknet::event::EventEmitter;
use starknet::get_contract_address;
  use crate::interfaces::i_thellex_pos_factory::{
    TokenSupportUpdated, 
    POSCreated, 
    FactoryInitialized
  };
  use starknet::storage::StorageMapReadAccess;
  use starknet::contract_address_const;
  use core::num::traits::Zero;
  use starknet::storage::{
      Map, 
      StoragePointerWriteAccess, 
      StoragePointerReadAccess, 
      StorageMapWriteAccess,
  };
  use starknet::{
      ContractAddress, 
      get_caller_address
  };
  use starknet::class_hash::ClassHash;
  use starknet::syscalls::deploy_syscall;

  use crate::interfaces::i_thellex_pos_factory::IThellexPOSFactory;

  #[storage]
  struct Storage {
      treasury: ContractAddress,
      fee_percent: u256,
      tax_percent: u256,
      timeout: u64,
      initialized: bool,
      paused: bool,
      pos_instances: Map<ContractAddress, bool>,
      admins: Map<ContractAddress, bool>,
      supported_tokens: Map<ContractAddress, bool>,
  }

  #[event]
  #[derive(Drop, starknet::Event)]
  pub enum Event {
      POSCreated: POSCreated,
      TokenSupportUpdated: TokenSupportUpdated,
      FactoryInitialized: FactoryInitialized
  }

  // Implement the trait
  #[abi(embed_v0)]
  impl ThellexPOSFactoryImpl of IThellexPOSFactory<ContractState> {
      fn initialize(ref self: ContractState, treasury: ContractAddress, fee_percent: u256, tax_percent: u256, timeout: u64) {
          assert(!self.initialized.read(), 'Already initialized');
          assert(treasury.is_non_zero(), 'Invalid treasury address');
          assert(fee_percent <= 10000, 'Fee percent too high');
          assert(tax_percent <= 10000, 'Tax percent too high');
          assert(timeout > 0, 'Invalid timeout');

          self.treasury.write(treasury);
          self.fee_percent.write(fee_percent);
          self.tax_percent.write(tax_percent);
          self.timeout.write(timeout);
          self.admins.write(get_caller_address(), true);
          self.initialized.write(true);

          self.emit(Event::FactoryInitialized(FactoryInitialized {
            treasury,
            fee_percent,
            tax_percent,
            timeout,
            admin: get_caller_address(),
          }));
      }

      fn add_supported_token(ref self: ContractState, token: ContractAddress) {
        assert(self.initialized.read(), 'Not initialized');
        assert(self.admins.read(get_caller_address()), 'Unauthorized');
        assert(token.is_non_zero(), 'Invalid token');

        self.supported_tokens.write(token, true);
        self.emit(Event::TokenSupportUpdated(TokenSupportUpdated { token, supported: true }));
      }

      fn remove_supported_token(ref self: ContractState, token: ContractAddress) {
          assert(self.initialized.read(), 'Not initialized');
          assert(self.admins.read(get_caller_address()), 'Unauthorized');
          assert(token.is_non_zero(), 'Invalid token');
          self.emit(Event::TokenSupportUpdated(TokenSupportUpdated { token, supported: false }));
      }

      fn create_pos(
          ref self: ContractState, 
          owner: ContractAddress, 
          pos_class_hash: ClassHash,
        ) -> ContractAddress {
          assert(self.initialized.read(), 'Not initialized');
          assert(!self.paused.read(), 'Factory paused');
          assert(owner.is_non_zero(), 'Invalid owner');

          // Deploy ThellexPOSV1 instance
          let mut calldata = ArrayTrait::new();
          calldata.append(owner.into());
          calldata.append(self.treasury.read().into());
          calldata.append(self.fee_percent.read().low.into());
          calldata.append(self.fee_percent.read().high.into());
          calldata.append(self.tax_percent.read().low.into());
          calldata.append(self.tax_percent.read().high.into());
          calldata.append(self.timeout.read().into());
          calldata.append(get_contract_address().into());

          let (pos_address, _) = deploy_syscall(pos_class_hash, 0, calldata.span(), false).expect('Deployment failed');

          self.pos_instances.write(pos_address, true);
          self.emit(Event::POSCreated(POSCreated { merchant: owner, pos_address }));
          pos_address
      }

      fn update_treasury(ref self: ContractState, new_treasury: ContractAddress) {
          assert(self.initialized.read(), 'Not initialized');
          assert(new_treasury.is_non_zero(), 'Invalid treasury address');
          assert(self.admins.read(get_caller_address()), 'Unauthorized');
          self.treasury.write(new_treasury);
      }

      fn update_fee_percent(ref self: ContractState, new_fee_percent: u256) {
          assert(self.initialized.read(), 'Not initialized');
          assert(self.admins.read(get_caller_address()), 'Unauthorized');
          assert(new_fee_percent <= 10000, 'Fee percent too high');
          self.fee_percent.write(new_fee_percent);
      }

      fn update_tax_percent(ref self: ContractState, new_tax_percent: u256) {
          assert(self.initialized.read(), 'Not initialized');
          assert(self.admins.read(get_caller_address()), 'Unauthorized');
          assert(new_tax_percent <= 10000, 'Tax percent too high');
          self.tax_percent.write(new_tax_percent);
      }

      fn update_timeout(ref self: ContractState, new_timeout: u64) {
          assert(self.initialized.read(), 'Not initialized');
          assert(self.admins.read(get_caller_address()), 'Unauthorized');
          assert(new_timeout > 0, 'Invalid timeout');
          self.timeout.write(new_timeout);
      }

      fn set_paused(ref self: ContractState, paused: bool) {
          assert(self.initialized.read(), 'Not initialized');
          assert(self.admins.read(get_caller_address()), 'Unauthorized');
          self.paused.write(paused);
      }

      fn get_treasury(self: @ContractState) -> ContractAddress {
          self.treasury.read()
      }

      fn get_fee_percent(self: @ContractState) -> u256 {
          self.fee_percent.read()
      }

      fn get_tax_percent(self: @ContractState) -> u256 {
          self.tax_percent.read()
      }

      fn get_timeout(self: @ContractState) -> u64 {
          self.timeout.read()
      }
      
      fn is_supported_token(self: @ContractState, token: ContractAddress) -> bool {
          self.supported_tokens.read(token)
      }
  }

  #[constructor]
  fn constructor(ref self: ContractState) {
      self.initialized.write(false);
      self.paused.write(false);
  }
}