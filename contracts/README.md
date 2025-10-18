scarb build

sncast account import \
 --address=0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691 \
 --type=oz \
 --url=http://127.0.0.1:5050 \
 --private-key=0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9 \
 --add-profile=devnet \
 --silent

sncast --profile=devnet deploy \
 --class-hash=0x72d11036798a397d1ac15d4767189b704a7d4af5b89065d4bba79ec965e0063 \
 --salt=0

sncast --profile=devnet invoke \
 --contract-address=0x0680845dd2b6022f9a7d16b880d63a393d6c90717d62a3f5defb9fbed9f0aceb \
 --function=initialize \
--arguments 0x0680845dd2b6022f9a7d16b880d63a393d6c90717d62a3f5defb9fbed9f0aceb 100 200 3600

sncast --profile=devnet call \
 --contract-address 0x0680845dd2b6022f9a7d16b880d63a393d6c90717d62a3f5defb9fbed9f0aceb \
 --function **starknet**entry_points

# ThellexPOS System

## Overview

The `ThellexPOSFactory` and `ThellexPOSV1` contracts form a Point of Sale (POS) system on Starknet for managing token deposits, transaction approvals, and withdrawals.

## Interaction Flow

Below is a sequence diagram illustrating how `ThellexPOSFactory` and `ThellexPOSV1` interact with users, merchants, and ERC20 tokens.

```mermaid
sequenceDiagram
    actor Admin
    actor User
    actor Merchant
    participant Factory as ThellexPOSFactory
    participant POS as ThellexPOSV1
    participant ERC20 as ERC20 Token

    Admin->>Factory: initialize(treasury, fee_percent, tax_percent, timeout)
    Factory-->>Factory: Store config, emit TokenSupportUpdated
    Admin->>Factory: add_supported_token(token)
    Factory-->>Factory: supported_tokens[token] = true
    Factory-->>Factory: Emit TokenSupportUpdated

    Admin->>Factory: create_pos(owner, deposit_address, pos_class_hash)
    Factory->>POS: Deploy with constructor(owner, deposit_address, treasury, fee_percent, tax_percent, timeout, factory_address)
    POS-->>POS: initialize(...)
    POS-->>POS: Emit Initialized
    Factory-->>Factory: pos_instances[pos_address] = true
    Factory-->>Factory: Emit POSCreated

    User->>ERC20: approve(POS, amount)
    ERC20-->>ERC20: allowances[user][POS] = amount
    User->>POS: deposit(amount, tx_id, token)
    POS->>Factory: is_supported_token(token)
    Factory-->>POS: bool (true)
    POS->>ERC20: transfer_from(user, POS, amount)
    ERC20-->>ERC20: Update balances
    POS-->>POS: Store deposit(tx_id, sender, amount, token, timestamp)
    POS-->>POS: Emit PaymentReceived

    alt Approve Transaction
        Merchant->>POS: approve_transaction(tx_id)
        POS-->>POS: Check owner, amount
        POS->>ERC20: transfer(treasury, fee)
        ERC20-->>ERC20: Update balances
        POS-->>POS: balances[token] += net_amount
        POS-->>POS: Clear deposit
        POS-->>POS: Emit BalanceCredited
    else Reject Transaction
        Merchant->>POS: reject_transaction(tx_id)
        POS-->>POS: Check owner, amount
        POS->>ERC20: transfer(sender, amount)
        ERC20-->>ERC20: Update balances
        POS-->>POS: Clear deposit
        POS-->>POS: Emit PaymentRejected
    end

    User->>POS: auto_refunded_amount(tx_id)
    POS-->>POS: Check timeout, amount
    POS->>ERC20: transfer(treasury, tax)
    POS->>ERC20: transfer(sender, refund_amount)
    ERC20-->>ERC20: Update balances
    POS-->>POS: Clear deposit
    POS-->>POS: Emit AutoRefunded

    Merchant->>POS: withdraw_funds(recipient, amount, token)
    POS-->>POS: Check admin, balance
    POS->>ERC20: transfer(recipient, amount)
    ERC20-->>ERC20: Update balances
    POS-->>POS: balances[token] -= amount
    POS-->>POS: Emit WithdrawalExecuted

```
