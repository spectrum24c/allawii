-- Allawii — 0001: extensions, enums, helper schema
-- Money is stored in minor units (kobo) as bigint. Never float.

create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists allawii_private;
revoke all on schema allawii_private from public;

-- ---------- enums ----------
do $$ begin
  create type app_role as enum ('student', 'support', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_status as enum ('ACTIVE', 'FROZEN', 'CLOSED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type kyc_status as enum ('NOT_STARTED', 'PENDING', 'VERIFIED', 'REVIEW', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wallet_status as enum ('ACTIVE', 'FROZEN', 'CLOSED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type funding_account_status as enum ('NOT_PROVISIONED', 'PENDING', 'ACTIVE', 'FAILED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tx_type as enum ('DEPOSIT', 'TRANSFER', 'FEE', 'REVERSAL', 'REFUND', 'ADJUSTMENT', 'SAVINGS');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tx_status as enum ('PENDING', 'PROCESSING', 'SUCCESSFUL', 'FAILED', 'REVERSED', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type entry_direction as enum ('CREDIT', 'DEBIT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ledger_entry_type as enum (
    'DEPOSIT_CREDIT', 'TRANSFER_DEBIT', 'FEE_DEBIT', 'TRANSFER_REVERSAL',
    'REFUND_CREDIT', 'SAVINGS_ALLOCATION', 'SAVINGS_RELEASE',
    'ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT', 'TRANSFER_HOLD'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type ledger_status as enum ('PENDING', 'POSTED', 'VOID');
exception when duplicate_object then null; end $$;

do $$ begin
  create type goal_status as enum ('ACTIVE', 'PAUSED', 'COMPLETED', 'CLOSED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type withdrawal_policy as enum ('FLEXIBLE', 'TARGET_DATE', 'LOCKED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type beneficiary_status as enum ('UNVERIFIED', 'VERIFIED', 'DISABLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type webhook_status as enum ('RECEIVED', 'PROCESSED', 'DUPLICATE', 'FAILED', 'IGNORED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_status as enum ('OPEN', 'PENDING', 'RESOLVED', 'CLOSED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum ('CREDIT', 'DEBIT', 'KYC', 'SECURITY', 'SYSTEM', 'SAVINGS');
exception when duplicate_object then null; end $$;

do $$ begin
  create type actor_type as enum ('USER', 'ADMIN', 'SYSTEM', 'PROVIDER');
exception when duplicate_object then null; end $$;
