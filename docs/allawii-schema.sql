-- Allawii: complete schema, generated from supabase/migrations (apply in one pass).
-- Safe to re-run: every statement is idempotent.

-- =====================================================================
-- 0001_extensions_and_enums.sql
-- =====================================================================
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

-- =====================================================================
-- 0002_tables.sql
-- =====================================================================
-- Allawii — 0002: core tables

-- ---------- reference data ----------
create table if not exists public.banks (
  code text primary key,
  name text not null,
  is_active boolean not null default true
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- users ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email citext not null,
  phone_number text,
  date_of_birth date,
  status account_status not null default 'ACTIVE',
  avatar_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles (email);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role app_role not null default 'student',
  granted_by uuid,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- transaction PIN, kept apart from the profile so it is never selected by accident
create table if not exists public.user_security (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  pin_hash text,
  pin_set_at timestamptz,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.kyc_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  kyc_status kyc_status not null default 'NOT_STARTED',
  verification_level int not null default 0,
  bvn_last4 text,
  nin_last4 text,
  bvn_hash text,
  nin_hash text,
  verification_provider text,
  verification_reference text,
  verified_at timestamptz,
  failure_reason text,
  consent_timestamp timestamptz,
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------- money ----------
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  provider text not null default 'allawii',
  provider_wallet_reference text,
  currency text not null default 'NGN',
  status wallet_status not null default 'ACTIVE',
  -- cached projections, always recomputed from ledger_entries by trigger
  available_balance_minor bigint not null default 0,
  pending_balance_minor bigint not null default 0,
  savings_balance_minor bigint not null default 0,
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallets_available_non_negative check (available_balance_minor >= 0)
);
create index if not exists wallets_user_idx on public.wallets (user_id);

create table if not exists public.funding_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'monnify',
  account_reference text not null unique,
  account_number text,
  bank_name text,
  bank_code text,
  account_name text,
  status funding_account_status not null default 'NOT_PROVISIONED',
  provider_response_reference text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists funding_accounts_user_idx on public.funding_accounts (user_id);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  type tx_type not null,
  status tx_status not null default 'PENDING',
  amount_minor bigint not null check (amount_minor > 0),
  fee_minor bigint not null default 0,
  currency text not null default 'NGN',
  provider text,
  provider_reference text,
  client_reference text not null,
  narration text,
  beneficiary_id uuid,
  goal_id uuid,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, client_reference)
);
create index if not exists transactions_user_created_idx on public.transactions (user_id, created_at desc);
create index if not exists transactions_status_idx on public.transactions (status);
create index if not exists transactions_provider_ref_idx on public.transactions (provider_reference);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete set null,
  goal_id uuid,
  entry_type ledger_entry_type not null,
  direction entry_direction not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'NGN',
  balance_after_minor bigint not null default 0,
  status ledger_status not null default 'POSTED',
  description text,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);
create index if not exists ledger_wallet_created_idx on public.ledger_entries (wallet_id, created_at desc);
create index if not exists ledger_goal_idx on public.ledger_entries (goal_id);

create table if not exists public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  bank_code text not null,
  bank_name text not null,
  account_number_hash text not null,
  account_number_masked text not null,
  account_number text not null, -- encrypted at rest by column privileges + RLS; never returned to any client
  account_name text,
  status beneficiary_status not null default 'UNVERIFIED',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, bank_code, account_number_hash)
);
create index if not exists beneficiaries_user_idx on public.beneficiaries (user_id);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  name text not null,
  target_amount_minor bigint not null check (target_amount_minor > 0),
  current_amount_minor bigint not null default 0,
  currency text not null default 'NGN',
  target_date date,
  status goal_status not null default 'ACTIVE',
  withdrawal_policy withdrawal_policy not null default 'FLEXIBLE',
  emoji text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists savings_goals_user_idx on public.savings_goals (user_id);

-- ---------- plumbing ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type notification_type not null default 'SYSTEM',
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type actor_type not null,
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on public.audit_logs (created_at desc);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text,
  event_id text not null,
  signature_valid boolean not null default false,
  status webhook_status not null default 'RECEIVED',
  payload jsonb not null,
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);
create index if not exists webhook_status_idx on public.webhook_events (status, received_at desc);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  category text not null default 'general',
  status ticket_status not null default 'OPEN',
  reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  author_role text not null default 'student',
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

create table if not exists public.whatsapp_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  whatsapp_phone_hash text not null unique,
  whatsapp_user_id text,
  link_code_hash text,
  link_code_expires_at timestamptz,
  linked_at timestamptz,
  last_authenticated_at timestamptz,
  status text not null default 'PENDING' check (status in ('PENDING', 'LINKED', 'REVOKED')),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 0003_ledger_and_rpc.sql
-- =====================================================================
-- Allawii — 0003: ledger engine, business logic, RPCs
-- Every money movement goes through allawii_private.post_entry. Clients never write tables directly.

-- ---------------------------------------------------------------- helpers
create or replace function allawii_private.setting(p_key text, p_default jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select value from public.app_settings where key = p_key), p_default);
$$;

create or replace function allawii_private.platform()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select value from public.app_settings where key = 'platform'),
    '{"demo_mode": true, "currency": "NGN"}'::jsonb);
$$;

create or replace function public.is_admin(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.user_roles where user_id = p_user and role = 'admin');
$$;

create or replace function public.is_staff(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.user_roles where user_id = p_user and role in ('admin', 'support'));
$$;

create or replace function allawii_private.assert_admin()
returns uuid language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  if not public.is_admin(v_uid) then raise exception 'ADMIN_ONLY' using errcode = 'P0001'; end if;
  return v_uid;
end $$;

create or replace function allawii_private.notify_user(p_user uuid, p_type notification_type, p_title text, p_body text default null, p_link text default null)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user, p_type, p_title, p_body, p_link);
$$;

create or replace function allawii_private.audit(p_actor_type actor_type, p_actor uuid, p_action text, p_entity_type text, p_entity_id text, p_before jsonb default null, p_after jsonb default null)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.audit_logs (actor_type, actor_id, action, entity_type, entity_id, before_data, after_data)
  values (p_actor_type, p_actor, p_action, p_entity_type, p_entity_id, p_before, p_after);
$$;

-- ---------------------------------------------------------------- balance projection
create or replace function allawii_private.recalc_wallet(p_wallet uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_avail bigint; v_pending bigint; v_savings bigint;
begin
  select
    coalesce(sum(case when direction = 'CREDIT' and status = 'POSTED' then amount_minor end), 0)
      - coalesce(sum(case when direction = 'DEBIT' and status = 'POSTED' then amount_minor end), 0)
      - coalesce(sum(case when direction = 'DEBIT' and status = 'PENDING' then amount_minor end), 0),
    coalesce(sum(case when status = 'PENDING' and direction = 'CREDIT' then amount_minor end), 0)
      + coalesce(sum(case when status = 'PENDING' and direction = 'DEBIT' then amount_minor end), 0),
    coalesce(sum(case when status = 'POSTED' and entry_type = 'SAVINGS_ALLOCATION' then amount_minor end), 0)
      - coalesce(sum(case when status = 'POSTED' and entry_type = 'SAVINGS_RELEASE' then amount_minor end), 0)
  into v_avail, v_pending, v_savings
  from public.ledger_entries where wallet_id = p_wallet;

  update public.wallets
     set available_balance_minor = v_avail,
         pending_balance_minor = v_pending,
         savings_balance_minor = v_savings,
         updated_at = now()
   where id = p_wallet;
end $$;

create or replace function allawii_private.post_entry(
  p_wallet uuid,
  p_type ledger_entry_type,
  p_direction entry_direction,
  p_amount bigint,
  p_tx uuid default null,
  p_goal uuid default null,
  p_status ledger_status default 'POSTED',
  p_description text default null,
  p_idempotency text default null
) returns public.ledger_entries
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.ledger_entries; v_existing public.ledger_entries; v_avail bigint;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  if p_idempotency is not null then
    select * into v_existing from public.ledger_entries where idempotency_key = p_idempotency;
    if found then return v_existing; end if;
  end if;

  insert into public.ledger_entries (wallet_id, transaction_id, goal_id, entry_type, direction, amount_minor, status, description, idempotency_key)
  values (p_wallet, p_tx, p_goal, p_type, p_direction, p_amount, p_status, p_description, p_idempotency)
  returning * into v_row;

  perform allawii_private.recalc_wallet(p_wallet);

  select available_balance_minor into v_avail from public.wallets where id = p_wallet;
  if v_avail < 0 and p_direction = 'DEBIT' then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  update public.ledger_entries set balance_after_minor = v_avail where id = v_row.id
  returning * into v_row;
  return v_row;
end $$;

-- ---------------------------------------------------------------- auth bootstrap
create or replace function allawii_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_name text; v_phone text; v_dob date; v_wallet uuid;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1));
  v_phone := nullif(trim(new.raw_user_meta_data ->> 'phone_number'), '');
  begin
    v_dob := nullif(new.raw_user_meta_data ->> 'date_of_birth', '')::date;
  exception when others then v_dob := null; end;

  insert into public.profiles (id, full_name, email, phone_number, date_of_birth)
  values (new.id, v_name, new.email, v_phone, v_dob)
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, 'student') on conflict do nothing;
  insert into public.user_security (user_id) values (new.id) on conflict do nothing;
  insert into public.kyc_profiles (user_id) values (new.id) on conflict do nothing;

  insert into public.wallets (user_id) values (new.id)
  on conflict (user_id) do nothing
  returning id into v_wallet;

  insert into public.funding_accounts (user_id, account_reference, status)
  values (new.id, 'ALW-' || upper(substr(replace(new.id::text, '-', ''), 1, 12)), 'NOT_PROVISIONED')
  on conflict (account_reference) do nothing;

  insert into public.notifications (user_id, type, title, body)
  values (new.id, 'SYSTEM', 'Welcome to Allawii', 'Finish your KYC to unlock your funding account and start saving.');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function allawii_private.handle_new_user();

-- ---------------------------------------------------------------- profile & security
create or replace function public.rpc_update_profile(p_full_name text default null, p_phone text default null, p_dob date default null)
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.profiles;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.profiles set
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
    phone_number = coalesce(nullif(trim(p_phone), ''), phone_number),
    date_of_birth = coalesce(p_dob, date_of_birth),
    updated_at = now()
  where id = v_uid returning * into v_row;
  return v_row;
end $$;

create or replace function public.rpc_complete_onboarding()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.profiles set onboarding_completed = true, updated_at = now() where id = auth.uid();
end $$;

create or replace function public.rpc_set_pin(p_pin text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN_MUST_BE_4_DIGITS'; end if;
  update public.user_security
     set pin_hash = crypt(p_pin, gen_salt('bf')), pin_set_at = now(), failed_attempts = 0, locked_until = null, updated_at = now()
   where user_id = v_uid;
  perform allawii_private.notify_user(v_uid, 'SECURITY', 'Transaction PIN set', 'You can now authorise transfers with your 4-digit PIN.', '/settings');
end $$;

create or replace function allawii_private.check_pin(p_uid uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_sec public.user_security;
begin
  select * into v_sec from public.user_security where user_id = p_uid;
  if v_sec.pin_hash is null then raise exception 'PIN_NOT_SET'; end if;
  if v_sec.locked_until is not null and v_sec.locked_until > now() then raise exception 'PIN_LOCKED'; end if;
  if p_pin is null or crypt(p_pin, v_sec.pin_hash) <> v_sec.pin_hash then
    update public.user_security
       set failed_attempts = failed_attempts + 1,
           locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else locked_until end,
           updated_at = now()
     where user_id = p_uid;
    raise exception 'INVALID_PIN';
  end if;
  update public.user_security set failed_attempts = 0, locked_until = null, updated_at = now() where user_id = p_uid;
end $$;

-- ---------------------------------------------------------------- KYC
create or replace function public.rpc_submit_kyc(p_bvn text default null, p_nin text default null, p_consent boolean default false)
returns public.kyc_profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.kyc_profiles; v_demo boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not p_consent then raise exception 'CONSENT_REQUIRED'; end if;
  if coalesce(p_bvn, '') = '' and coalesce(p_nin, '') = '' then raise exception 'BVN_OR_NIN_REQUIRED'; end if;
  if p_bvn is not null and p_bvn !~ '^[0-9]{11}$' then raise exception 'INVALID_BVN'; end if;
  if p_nin is not null and p_nin !~ '^[0-9]{11}$' then raise exception 'INVALID_NIN'; end if;

  if exists (select 1 from public.kyc_profiles where user_id = v_uid and kyc_status = 'VERIFIED') then
    raise exception 'ALREADY_VERIFIED';
  end if;

  v_demo := coalesce((allawii_private.platform() ->> 'demo_mode')::boolean, true);

  update public.kyc_profiles set
    kyc_status = case when v_demo then 'VERIFIED'::kyc_status else 'PENDING'::kyc_status end,
    verification_level = case when v_demo then 2 else 1 end,
    bvn_last4 = case when p_bvn is not null then right(p_bvn, 4) else bvn_last4 end,
    nin_last4 = case when p_nin is not null then right(p_nin, 4) else nin_last4 end,
    bvn_hash = case when p_bvn is not null then encode(digest(p_bvn, 'sha256'), 'hex') else bvn_hash end,
    nin_hash = case when p_nin is not null then encode(digest(p_nin, 'sha256'), 'hex') else nin_hash end,
    verification_provider = case when v_demo then 'demo' else 'monnify' end,
    verification_reference = 'KYC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    verified_at = case when v_demo then now() else null end,
    failure_reason = null,
    submitted_at = now(),
    consent_timestamp = now(),
    updated_at = now()
  where user_id = v_uid
  returning * into v_row;

  perform allawii_private.audit('USER', v_uid, 'KYC_SUBMITTED', 'kyc_profiles', v_uid::text, null, jsonb_build_object('status', v_row.kyc_status));
  perform allawii_private.notify_user(v_uid, 'KYC',
    case when v_demo then 'Identity check complete' else 'Identity check submitted' end,
    case when v_demo then 'Your KYC is verified in demo mode. You can provision a funding account.'
         else 'We are reviewing your details. This usually takes a few minutes.' end,
    '/kyc');
  return v_row;
end $$;

-- ---------------------------------------------------------------- wallet
create or replace function public.rpc_wallet_summary()
returns table (
  wallet_id uuid, currency text, wallet_status wallet_status,
  available_minor bigint, pending_minor bigint, savings_minor bigint,
  total_credited_minor bigint, total_debited_minor bigint
) language sql stable security definer set search_path = public, pg_temp as $$
  select w.id, w.currency, w.status, w.available_balance_minor, w.pending_balance_minor, w.savings_balance_minor,
         coalesce((select sum(amount_minor) from public.ledger_entries le where le.wallet_id = w.id and le.direction = 'CREDIT' and le.status = 'POSTED'), 0),
         coalesce((select sum(amount_minor) from public.ledger_entries le where le.wallet_id = w.id and le.direction = 'DEBIT' and le.status = 'POSTED'), 0)
  from public.wallets w where w.user_id = auth.uid();
$$;

create or replace function public.rpc_wallet_limits()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'min_transfer_minor', coalesce((allawii_private.platform() ->> 'min_transfer_minor')::bigint, 10000),
    'max_transfer_minor', coalesce((allawii_private.platform() ->> 'max_transfer_minor')::bigint, 50000000),
    'daily_transfer_minor', coalesce((allawii_private.platform() ->> 'daily_transfer_minor')::bigint, 100000000),
    'transfer_fee_minor', coalesce((allawii_private.platform() ->> 'transfer_fee_minor')::bigint, 0),
    'fee_cap_minor', coalesce((allawii_private.platform() ->> 'fee_cap_minor')::bigint, 200000),
    'demo_mode', coalesce((allawii_private.platform() ->> 'demo_mode')::boolean, true)
  );
$$;

-- ---------------------------------------------------------------- deposits
-- Called by the frontend. In demo mode it credits a clearly-labelled simulated
-- deposit. With Monnify configured the edge function supplies the provider
-- reference and this only records a PENDING intent until the webhook/verify
-- step confirms it.
create or replace function public.rpc_deposit_start(p_amount_minor bigint, p_channel text default 'demo')
returns public.transactions language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_wallet public.wallets; v_tx public.transactions;
        v_demo boolean; v_ref text; v_fee bigint := 0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_amount_minor is null or p_amount_minor < 10000 then raise exception 'MIN_DEPOSIT_100'; end if;
  if p_amount_minor > 1000000000 then raise exception 'MAX_DEPOSIT_EXCEEDED'; end if;

  select * into v_wallet from public.wallets where user_id = v_uid for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  if v_wallet.status <> 'ACTIVE' then raise exception 'WALLET_NOT_ACTIVE'; end if;
  if exists (select 1 from public.profiles p where p.id = v_uid and p.status <> 'ACTIVE') then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
  if not exists (select 1 from public.kyc_profiles k where k.user_id = v_uid and k.kyc_status = 'VERIFIED') then
    raise exception 'KYC_REQUIRED';
  end if;

  v_demo := coalesce((allawii_private.platform() ->> 'demo_mode')::boolean, true) and p_channel = 'demo';
  v_ref := 'ALW-DEP-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.transactions (user_id, wallet_id, type, status, amount_minor, fee_minor, provider,
    client_reference, narration, metadata, completed_at)
  values (v_uid, v_wallet.id, 'DEPOSIT',
    case when v_demo then 'SUCCESSFUL'::tx_status else 'PENDING'::tx_status end,
    p_amount_minor, v_fee, case when v_demo then 'demo' else 'monnify' end,
    v_ref, case when v_demo then 'Simulated deposit (demo mode)' else 'Wallet funding' end,
    jsonb_build_object('demo', v_demo, 'channel', p_channel),
    case when v_demo then now() else null end)
  returning * into v_tx;

  if v_demo then
    perform allawii_private.post_entry(v_wallet.id, 'DEPOSIT_CREDIT', 'CREDIT', p_amount_minor, v_tx.id,
      null, 'POSTED', 'Demo deposit credit', 'dep:' || v_tx.id::text);
    perform allawii_private.notify_user(v_uid, 'CREDIT', 'Demo funds added',
      'A simulated deposit of ' || to_char(p_amount_minor / 100.0, 'FM999,999,990.00') || ' NGN was added to your wallet. No real money moved.', '/wallet');
  else
    perform allawii_private.notify_user(v_uid, 'SYSTEM', 'Deposit started',
      'Complete the payment to fund your wallet.', '/transactions');
  end if;

  return v_tx;
end $$;

-- Confirms a provider deposit. Only the server (service role / webhook) may call it.
create or replace function public.rpc_deposit_settle(
  p_client_reference text, p_provider_reference text, p_success boolean, p_reason text default null
) returns public.transactions
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tx public.transactions;
begin
  if coalesce(auth.jwt() ->> 'role', '') not in ('service_role') then
    if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  end if;

  select * into v_tx from public.transactions where client_reference = p_client_reference for update;
  if not found then raise exception 'TRANSACTION_NOT_FOUND'; end if;
  if v_tx.status = 'SUCCESSFUL' then return v_tx; end if;
  if v_tx.status not in ('PENDING', 'PROCESSING') then return v_tx; end if;

  if p_success then
    update public.transactions set status = 'SUCCESSFUL', provider_reference = p_provider_reference, completed_at = now()
    where id = v_tx.id returning * into v_tx;
    perform allawii_private.post_entry(v_tx.wallet_id, 'DEPOSIT_CREDIT', 'CREDIT', v_tx.amount_minor, v_tx.id,
      null, 'POSTED', 'Deposit confirmed', 'dep:' || v_tx.id::text);
    perform allawii_private.notify_user(v_tx.user_id, 'CREDIT', 'Wallet funded',
      to_char(v_tx.amount_minor / 100.0, 'FM999,999,990.00') || ' NGN has been added to your Allawii wallet.', '/wallet');
  else
    update public.transactions set status = 'FAILED', failure_reason = coalesce(p_reason, 'Payment failed'), completed_at = now()
    where id = v_tx.id returning * into v_tx;
    perform allawii_private.notify_user(v_tx.user_id, 'SYSTEM', 'Deposit failed', coalesce(p_reason, 'The payment was not completed.'), '/transactions');
  end if;
  return v_tx;
end $$;

-- ---------------------------------------------------------------- beneficiaries
create or replace function public.rpc_create_beneficiary(
  p_bank_code text, p_bank_name text, p_account_number text, p_account_name text, p_verified boolean default false
) returns public.beneficiaries language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.beneficiaries;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_account_number !~ '^[0-9]{10}$' then raise exception 'INVALID_ACCOUNT_NUMBER'; end if;
  if coalesce(trim(p_account_name), '') = '' then raise exception 'ACCOUNT_NAME_REQUIRED'; end if;

  insert into public.beneficiaries (user_id, bank_code, bank_name, account_number_hash, account_number_masked, account_number, account_name, status, verified_at)
  values (v_uid, p_bank_code, p_bank_name, encode(digest(p_account_number, 'sha256'), 'hex'),
          '******' || right(p_account_number, 4), p_account_number, upper(trim(p_account_name)),
          case when p_verified then 'VERIFIED'::beneficiary_status else 'UNVERIFIED'::beneficiary_status end,
          case when p_verified then now() else null end)
  on conflict (user_id, bank_code, account_number_hash) do update
    set account_name = excluded.account_name,
        status = case when excluded.status = 'VERIFIED' then 'VERIFIED'::beneficiary_status else public.beneficiaries.status end,
        verified_at = coalesce(excluded.verified_at, public.beneficiaries.verified_at)
  returning * into v_row;

  return v_row;
end $$;

-- ---------------------------------------------------------------- transfers
create or replace function public.rpc_transfer_quote(p_amount_minor bigint)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_limits jsonb := public.rpc_wallet_limits();
        v_fee bigint; v_avail bigint; v_today bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_amount_minor is null or p_amount_minor < (v_limits ->> 'min_transfer_minor')::bigint then raise exception 'BELOW_MIN_TRANSFER'; end if;
  if p_amount_minor > (v_limits ->> 'max_transfer_minor')::bigint then raise exception 'ABOVE_MAX_TRANSFER'; end if;

  v_fee := least((v_limits ->> 'transfer_fee_minor')::bigint, (v_limits ->> 'fee_cap_minor')::bigint);
  select available_balance_minor into v_avail from public.wallets where user_id = v_uid;
  select coalesce(sum(amount_minor + fee_minor), 0) into v_today from public.transactions
   where user_id = v_uid and type = 'TRANSFER' and status in ('PENDING', 'PROCESSING', 'SUCCESSFUL')
     and created_at >= date_trunc('day', now());

  return jsonb_build_object(
    'amount_minor', p_amount_minor,
    'fee_minor', v_fee,
    'total_minor', p_amount_minor + v_fee,
    'available_minor', coalesce(v_avail, 0),
    'daily_used_minor', v_today,
    'daily_limit_minor', (v_limits ->> 'daily_transfer_minor')::bigint
  );
end $$;

create or replace function public.rpc_initiate_transfer(
  p_beneficiary_id uuid, p_amount_minor bigint, p_narration text default null, p_pin text default null
) returns public.transactions language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_wallet public.wallets; v_ben public.beneficiaries;
        v_tx public.transactions; v_fee bigint; v_limits jsonb := public.rpc_wallet_limits();
        v_today bigint; v_ref text; v_avail bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if exists (select 1 from public.profiles p where p.id = v_uid and p.status <> 'ACTIVE') then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
  if not exists (select 1 from public.kyc_profiles k where k.user_id = v_uid and k.kyc_status = 'VERIFIED') then raise exception 'KYC_REQUIRED'; end if;

  perform allawii_private.check_pin(v_uid, p_pin);

  select * into v_wallet from public.wallets where user_id = v_uid for update;
  if v_wallet.status <> 'ACTIVE' then raise exception 'WALLET_NOT_ACTIVE'; end if;

  select * into v_ben from public.beneficiaries where id = p_beneficiary_id and user_id = v_uid;
  if not found then raise exception 'BENEFICIARY_NOT_FOUND'; end if;

  if p_amount_minor < (v_limits ->> 'min_transfer_minor')::bigint then raise exception 'BELOW_MIN_TRANSFER'; end if;
  if p_amount_minor > (v_limits ->> 'max_transfer_minor')::bigint then raise exception 'ABOVE_MAX_TRANSFER'; end if;

  select coalesce(sum(amount_minor + fee_minor), 0) into v_today from public.transactions
   where user_id = v_uid and type = 'TRANSFER' and status in ('PENDING', 'PROCESSING', 'SUCCESSFUL')
     and created_at >= date_trunc('day', now());
  if v_today + p_amount_minor > (v_limits ->> 'daily_transfer_minor')::bigint then raise exception 'DAILY_LIMIT_EXCEEDED'; end if;

  v_fee := least((v_limits ->> 'transfer_fee_minor')::bigint, (v_limits ->> 'fee_cap_minor')::bigint);
  v_avail := v_wallet.available_balance_minor;
  if v_avail < p_amount_minor + v_fee then raise exception 'INSUFFICIENT_FUNDS'; end if;

  v_ref := 'ALW-TRF-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.transactions (user_id, wallet_id, type, status, amount_minor, fee_minor, provider,
    client_reference, narration, beneficiary_id, metadata)
  values (v_uid, v_wallet.id, 'TRANSFER', 'PROCESSING', p_amount_minor, v_fee,
    case when coalesce((allawii_private.platform() ->> 'demo_mode')::boolean, true) then 'demo' else 'monnify' end,
    v_ref, nullif(trim(p_narration), ''), v_ben.id,
    jsonb_build_object('bank_code', v_ben.bank_code, 'bank_name', v_ben.bank_name,
      'account_name', v_ben.account_name, 'account_number_masked', v_ben.account_number_masked,
      'demo', coalesce((allawii_private.platform() ->> 'demo_mode')::boolean, true)))
  returning * into v_tx;

  -- reserve the money immediately so it cannot be double-spent
  perform allawii_private.post_entry(v_wallet.id, 'TRANSFER_HOLD', 'DEBIT', p_amount_minor + v_fee, v_tx.id,
    null, 'PENDING', 'Transfer hold', 'hold:' || v_tx.id::text);

  perform allawii_private.audit('USER', v_uid, 'TRANSFER_INITIATED', 'transactions', v_tx.id::text, null, jsonb_build_object('amount_minor', p_amount_minor));
  return v_tx;
end $$;

create or replace function public.rpc_settle_transfer(
  p_transaction_id uuid, p_success boolean, p_provider_reference text default null, p_reason text default null
) returns public.transactions language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tx public.transactions; v_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if v_role <> 'service_role' and not public.is_admin() then raise exception 'FORBIDDEN'; end if;

  select * into v_tx from public.transactions where id = p_transaction_id for update;
  if not found then raise exception 'TRANSACTION_NOT_FOUND'; end if;
  if v_tx.status not in ('PENDING', 'PROCESSING') then return v_tx; end if;

  -- void the hold either way; the outcome is then posted explicitly
  update public.ledger_entries set status = 'VOID'
   where transaction_id = v_tx.id and entry_type = 'TRANSFER_HOLD' and status = 'PENDING';

  if p_success then
    perform allawii_private.post_entry(v_tx.wallet_id, 'TRANSFER_DEBIT', 'DEBIT', v_tx.amount_minor, v_tx.id,
      null, 'POSTED', 'Transfer to ' || coalesce(v_tx.metadata ->> 'account_name', 'beneficiary'), 'trf:' || v_tx.id::text);
    if v_tx.fee_minor > 0 then
      perform allawii_private.post_entry(v_tx.wallet_id, 'FEE_DEBIT', 'DEBIT', v_tx.fee_minor, v_tx.id,
        null, 'POSTED', 'Transfer fee', 'fee:' || v_tx.id::text);
    end if;
    update public.transactions set status = 'SUCCESSFUL', provider_reference = p_provider_reference, completed_at = now()
    where id = v_tx.id returning * into v_tx;
    perform allawii_private.notify_user(v_tx.user_id, 'DEBIT', 'Transfer successful',
      to_char(v_tx.amount_minor / 100.0, 'FM999,999,990.00') || ' NGN sent to ' || coalesce(v_tx.metadata ->> 'account_name', 'your beneficiary') || '.', '/transactions');
  else
    update public.transactions set status = 'FAILED', failure_reason = coalesce(p_reason, 'Transfer failed'), completed_at = now()
    where id = v_tx.id returning * into v_tx;
    perform allawii_private.notify_user(v_tx.user_id, 'SYSTEM', 'Transfer failed',
      coalesce(p_reason, 'Your transfer could not be completed and the funds were released back to your wallet.'), '/transactions');
  end if;
  perform allawii_private.recalc_wallet(v_tx.wallet_id);
  return v_tx;
end $$;

create or replace function public.rpc_cancel_transfer(p_transaction_id uuid)
returns public.transactions language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_tx public.transactions;
begin
  select * into v_tx from public.transactions where id = p_transaction_id and user_id = v_uid for update;
  if not found then raise exception 'TRANSACTION_NOT_FOUND'; end if;
  if v_tx.status <> 'PENDING' then raise exception 'NOT_CANCELLABLE'; end if;
  update public.ledger_entries set status = 'VOID' where transaction_id = v_tx.id and status = 'PENDING';
  update public.transactions set status = 'CANCELLED', completed_at = now() where id = v_tx.id returning * into v_tx;
  perform allawii_private.recalc_wallet(v_tx.wallet_id);
  return v_tx;
end $$;

-- ---------------------------------------------------------------- savings goals
create or replace function public.rpc_savings_create(
  p_name text, p_target_minor bigint, p_target_date date default null,
  p_policy withdrawal_policy default 'FLEXIBLE', p_emoji text default null
) returns public.savings_goals language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_wallet uuid; v_row public.savings_goals;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'NAME_REQUIRED'; end if;
  if p_target_minor is null or p_target_minor < 10000 then raise exception 'TARGET_TOO_SMALL'; end if;
  select id into v_wallet from public.wallets where user_id = v_uid;

  insert into public.savings_goals (user_id, wallet_id, name, target_amount_minor, target_date, withdrawal_policy, emoji)
  values (v_uid, v_wallet, trim(p_name), p_target_minor, p_target_date, p_policy, p_emoji)
  returning * into v_row;
  perform allawii_private.audit('USER', v_uid, 'SAVINGS_GOAL_CREATED', 'savings_goals', v_row.id::text);
  return v_row;
end $$;

create or replace function public.rpc_savings_update(
  p_goal_id uuid, p_name text default null, p_target_minor bigint default null,
  p_target_date date default null, p_policy withdrawal_policy default null, p_emoji text default null
) returns public.savings_goals language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.savings_goals;
begin
  update public.savings_goals set
    name = coalesce(nullif(trim(p_name), ''), name),
    target_amount_minor = coalesce(p_target_minor, target_amount_minor),
    target_date = coalesce(p_target_date, target_date),
    withdrawal_policy = coalesce(p_policy, withdrawal_policy),
    emoji = coalesce(p_emoji, emoji),
    updated_at = now()
  where id = p_goal_id and user_id = v_uid returning * into v_row;
  if not found then raise exception 'GOAL_NOT_FOUND'; end if;
  return v_row;
end $$;

create or replace function public.rpc_savings_contribute(p_goal_id uuid, p_amount_minor bigint)
returns public.savings_goals language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_goal public.savings_goals; v_wallet public.wallets; v_tx public.transactions;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_amount_minor is null or p_amount_minor < 1000 then raise exception 'MIN_CONTRIBUTION_10'; end if;

  select * into v_goal from public.savings_goals where id = p_goal_id and user_id = v_uid for update;
  if not found then raise exception 'GOAL_NOT_FOUND'; end if;
  if v_goal.status <> 'ACTIVE' then raise exception 'GOAL_NOT_ACTIVE'; end if;

  select * into v_wallet from public.wallets where user_id = v_uid for update;
  if v_wallet.available_balance_minor < p_amount_minor then raise exception 'INSUFFICIENT_FUNDS'; end if;

  insert into public.transactions (user_id, wallet_id, type, status, amount_minor, provider, client_reference, narration, goal_id, completed_at)
  values (v_uid, v_wallet.id, 'SAVINGS', 'SUCCESSFUL', p_amount_minor, 'allawii',
    'ALW-SAV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    'Contribution to ' || v_goal.name, v_goal.id, now())
  returning * into v_tx;

  perform allawii_private.post_entry(v_wallet.id, 'SAVINGS_ALLOCATION', 'DEBIT', p_amount_minor, v_tx.id, v_goal.id,
    'POSTED', 'Savings allocation', 'sav:' || v_tx.id::text);

  update public.savings_goals set current_amount_minor = current_amount_minor + p_amount_minor,
    status = case when current_amount_minor + p_amount_minor >= target_amount_minor then 'COMPLETED'::goal_status else status end,
    updated_at = now()
  where id = v_goal.id returning * into v_goal;

  perform allawii_private.notify_user(v_uid, 'SAVINGS', 'Goal updated',
    to_char(p_amount_minor / 100.0, 'FM999,999,990.00') || ' NGN added to "' || v_goal.name || '".', '/savings/' || v_goal.id::text);
  return v_goal;
end $$;

create or replace function public.rpc_savings_withdraw(p_goal_id uuid, p_amount_minor bigint)
returns public.savings_goals language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_goal public.savings_goals; v_wallet public.wallets; v_tx public.transactions;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_goal from public.savings_goals where id = p_goal_id and user_id = v_uid for update;
  if not found then raise exception 'GOAL_NOT_FOUND'; end if;
  if p_amount_minor is null or p_amount_minor <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_amount_minor > v_goal.current_amount_minor then raise exception 'INSUFFICIENT_GOAL_BALANCE'; end if;
  if v_goal.withdrawal_policy = 'LOCKED' then raise exception 'GOAL_LOCKED'; end if;
  if v_goal.withdrawal_policy = 'TARGET_DATE' and v_goal.target_date is not null and v_goal.target_date > current_date then
    raise exception 'GOAL_LOCKED_UNTIL_TARGET_DATE';
  end if;

  select * into v_wallet from public.wallets where user_id = v_uid for update;

  insert into public.transactions (user_id, wallet_id, type, status, amount_minor, provider, client_reference, narration, goal_id, completed_at)
  values (v_uid, v_wallet.id, 'SAVINGS', 'SUCCESSFUL', p_amount_minor, 'allawii',
    'ALW-SAVW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    'Withdrawal from ' || v_goal.name, v_goal.id, now())
  returning * into v_tx;

  perform allawii_private.post_entry(v_wallet.id, 'SAVINGS_RELEASE', 'CREDIT', p_amount_minor, v_tx.id, v_goal.id,
    'POSTED', 'Savings release', 'savw:' || v_tx.id::text);

  update public.savings_goals set current_amount_minor = current_amount_minor - p_amount_minor,
    status = case when status = 'COMPLETED' then 'ACTIVE'::goal_status else status end,
    updated_at = now()
  where id = v_goal.id returning * into v_goal;

  perform allawii_private.notify_user(v_uid, 'SAVINGS', 'Savings moved to wallet',
    to_char(p_amount_minor / 100.0, 'FM999,999,990.00') || ' NGN released from "' || v_goal.name || '".', '/wallet');
  return v_goal;
end $$;

create or replace function public.rpc_savings_set_status(p_goal_id uuid, p_status goal_status)
returns public.savings_goals language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_goal public.savings_goals; v_wallet public.wallets; v_tx_id uuid;
begin
  select * into v_goal from public.savings_goals where id = p_goal_id and user_id = v_uid for update;
  if not found then raise exception 'GOAL_NOT_FOUND'; end if;

  if p_status = 'CLOSED' and v_goal.current_amount_minor > 0 then
    select * into v_wallet from public.wallets where user_id = v_uid for update;
    insert into public.transactions (user_id, wallet_id, type, status, amount_minor, provider, client_reference, narration, goal_id, completed_at)
    values (v_uid, v_wallet.id, 'SAVINGS', 'SUCCESSFUL', v_goal.current_amount_minor, 'allawii',
      'ALW-SAVC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
      'Goal closed: ' || v_goal.name, v_goal.id, now())
    returning id into v_tx_id;

    perform allawii_private.post_entry(v_wallet.id, 'SAVINGS_RELEASE', 'CREDIT', v_goal.current_amount_minor, v_tx_id, v_goal.id,
      'POSTED', 'Goal closed, funds released', 'savc:' || v_tx_id::text);
    update public.savings_goals set current_amount_minor = 0 where id = v_goal.id;
  end if;

  update public.savings_goals set status = p_status, updated_at = now()
  where id = v_goal.id and user_id = v_uid returning * into v_goal;
  return v_goal;
end $$;

-- ---------------------------------------------------------------- support
create or replace function public.rpc_create_ticket(p_subject text, p_category text default 'general', p_message text default null)
returns public.support_tickets language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.support_tickets;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(trim(p_subject), '') = '' then raise exception 'SUBJECT_REQUIRED'; end if;
  insert into public.support_tickets (user_id, subject, category, reference)
  values (v_uid, trim(p_subject), coalesce(p_category, 'general'),
          'ALW-SUP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)))
  returning * into v_row;
  if coalesce(trim(p_message), '') <> '' then
    insert into public.support_messages (ticket_id, author_id, author_role, body)
    values (v_row.id, v_uid, 'student', trim(p_message));
  end if;
  perform allawii_private.audit('USER', v_uid, 'SUPPORT_TICKET_CREATED', 'support_tickets', v_row.id::text);
  return v_row;
end $$;

create or replace function public.rpc_reply_ticket(p_ticket_id uuid, p_body text)
returns public.support_messages language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.support_messages; v_staff boolean := public.is_staff();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not v_staff and not exists (select 1 from public.support_tickets where id = p_ticket_id and user_id = v_uid) then
    raise exception 'TICKET_NOT_FOUND';
  end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'MESSAGE_REQUIRED'; end if;
  insert into public.support_messages (ticket_id, author_id, author_role, body)
  values (p_ticket_id, v_uid, case when v_staff then 'support' else 'student' end, trim(p_body))
  returning * into v_row;
  update public.support_tickets set status = case when v_staff then 'PENDING'::ticket_status else 'OPEN'::ticket_status end,
    updated_at = now() where id = p_ticket_id;
  return v_row;
end $$;

-- ---------------------------------------------------------------- notifications
create or replace function public.rpc_mark_notifications_read(p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_count int;
begin
  update public.notifications set read_at = now()
   where user_id = v_uid and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- =====================================================================
-- 0004_rls.sql
-- =====================================================================
-- Allawii — 0004: RLS, grants, realtime

alter table public.profiles            enable row level security;
alter table public.user_roles          enable row level security;
alter table public.user_security       enable row level security;
alter table public.kyc_profiles        enable row level security;
alter table public.wallets             enable row level security;
alter table public.funding_accounts    enable row level security;
alter table public.transactions        enable row level security;
alter table public.ledger_entries      enable row level security;
alter table public.beneficiaries       enable row level security;
alter table public.savings_goals       enable row level security;
alter table public.notifications       enable row level security;
alter table public.audit_logs          enable row level security;
alter table public.webhook_events      enable row level security;
alter table public.support_tickets     enable row level security;
alter table public.support_messages    enable row level security;
alter table public.whatsapp_identities enable row level security;
alter table public.banks               enable row level security;
alter table public.app_settings        enable row level security;

-- ---------- profiles ----------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------- roles (read only for clients) ----------
drop policy if exists roles_select on public.user_roles;
create policy roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- ---------- wallets / funding accounts ----------
drop policy if exists wallets_select on public.wallets;
create policy wallets_select on public.wallets for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
drop policy if exists funding_select on public.funding_accounts;
create policy funding_select on public.funding_accounts for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- ---------- transactions / ledger ----------
drop policy if exists tx_select on public.transactions;
create policy tx_select on public.transactions for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
drop policy if exists ledger_select on public.ledger_entries;
create policy ledger_select on public.ledger_entries for select to authenticated
  using (exists (select 1 from public.wallets w where w.id = wallet_id and (w.user_id = auth.uid() or public.is_staff())));

-- ---------- beneficiaries (account number column is revoked below) ----------
drop policy if exists ben_select on public.beneficiaries;
create policy ben_select on public.beneficiaries for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
drop policy if exists ben_delete on public.beneficiaries;
create policy ben_delete on public.beneficiaries for delete to authenticated
  using (user_id = auth.uid());

-- ---------- savings ----------
drop policy if exists goals_select on public.savings_goals;
create policy goals_select on public.savings_goals for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- ---------- kyc ----------
drop policy if exists kyc_select on public.kyc_profiles;
create policy kyc_select on public.kyc_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- ---------- notifications ----------
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- support ----------
drop policy if exists tickets_select on public.support_tickets;
create policy tickets_select on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
drop policy if exists tmsg_select on public.support_messages;
create policy tmsg_select on public.support_messages for select to authenticated
  using (public.is_staff() or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));

-- ---------- staff-only ----------
drop policy if exists audit_staff on public.audit_logs;
create policy audit_staff on public.audit_logs for select to authenticated using (public.is_staff());
drop policy if exists webhooks_staff on public.webhook_events;
create policy webhooks_staff on public.webhook_events for select to authenticated using (public.is_staff());

-- ---------- reference data ----------
drop policy if exists banks_read on public.banks;
create policy banks_read on public.banks for select to authenticated using (true);
drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings for select to authenticated using (true);

-- ---------- whatsapp ----------
drop policy if exists wa_select on public.whatsapp_identities;
create policy wa_select on public.whatsapp_identities for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- ---------- column privileges: never expose raw identifiers ----------
revoke all on public.beneficiaries from authenticated, anon;
grant select (id, user_id, bank_code, bank_name, account_number_masked, account_name, status, verified_at, created_at)
  on public.beneficiaries to authenticated;
grant delete on public.beneficiaries to authenticated;

revoke all on public.user_security from authenticated, anon;
revoke all on public.kyc_profiles from authenticated, anon;
grant select (user_id, kyc_status, verification_level, bvn_last4, nin_last4, verification_provider,
              verification_reference, verified_at, failure_reason, submitted_at, updated_at)
  on public.kyc_profiles to authenticated;

revoke all on public.profiles from authenticated, anon;
grant select on public.profiles to authenticated;
grant update (full_name, phone_number, date_of_birth, avatar_url) on public.profiles to authenticated;

revoke insert, update, delete on public.wallets, public.transactions, public.ledger_entries,
  public.savings_goals, public.funding_accounts, public.audit_logs, public.webhook_events,
  public.user_roles, public.app_settings, public.banks from authenticated, anon;

-- ---------- realtime ----------
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.transactions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.wallets;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.savings_goals;
exception when duplicate_object then null; end $$;

-- ---------- function grants ----------
revoke execute on all functions in schema allawii_private from public, anon, authenticated;

grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_staff(uuid) to authenticated;
grant execute on function public.rpc_update_profile(text, text, date) to authenticated;
grant execute on function public.rpc_complete_onboarding() to authenticated;
grant execute on function public.rpc_set_pin(text) to authenticated;
grant execute on function public.rpc_submit_kyc(text, text, boolean) to authenticated;
grant execute on function public.rpc_wallet_summary() to authenticated;
grant execute on function public.rpc_wallet_limits() to authenticated;
grant execute on function public.rpc_deposit_start(bigint, text) to authenticated;
grant execute on function public.rpc_create_beneficiary(text, text, text, text, boolean) to authenticated;
grant execute on function public.rpc_transfer_quote(bigint) to authenticated;
grant execute on function public.rpc_initiate_transfer(uuid, bigint, text, text) to authenticated;
grant execute on function public.rpc_cancel_transfer(uuid) to authenticated;
grant execute on function public.rpc_savings_create(text, bigint, date, withdrawal_policy, text) to authenticated;
grant execute on function public.rpc_savings_update(uuid, text, bigint, date, withdrawal_policy, text) to authenticated;
grant execute on function public.rpc_savings_contribute(uuid, bigint) to authenticated;
grant execute on function public.rpc_savings_withdraw(uuid, bigint) to authenticated;
grant execute on function public.rpc_savings_set_status(uuid, goal_status) to authenticated;
grant execute on function public.rpc_create_ticket(text, text, text) to authenticated;
grant execute on function public.rpc_reply_ticket(uuid, text) to authenticated;
grant execute on function public.rpc_mark_notifications_read(uuid[]) to authenticated;

-- =====================================================================
-- 0005_admin.sql
-- =====================================================================
-- Allawii — 0005: server-side (service role) + admin operations

-- ---------- funding account provisioning (called by edge function / server only) ----------
create or replace function public.rpc_funding_account_set(
  p_user_id uuid, p_status funding_account_status,
  p_account_number text default null, p_bank_name text default null, p_bank_code text default null,
  p_account_name text default null, p_provider_reference text default null, p_failure_reason text default null
) returns public.funding_accounts
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.funding_accounts;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  update public.funding_accounts set
    status = p_status,
    account_number = coalesce(p_account_number, account_number),
    bank_name = coalesce(p_bank_name, bank_name),
    bank_code = coalesce(p_bank_code, bank_code),
    account_name = coalesce(p_account_name, account_name),
    provider_response_reference = coalesce(p_provider_reference, provider_response_reference),
    failure_reason = p_failure_reason,
    updated_at = now()
  where user_id = p_user_id
  returning * into v_row;

  if v_row.status = 'ACTIVE' then
    perform allawii_private.notify_user(p_user_id, 'SYSTEM', 'Funding account ready',
      'Your dedicated Allawii account ' || v_row.account_number || ' (' || v_row.bank_name || ') is active.', '/wallet');
  elsif v_row.status = 'FAILED' then
    perform allawii_private.notify_user(p_user_id, 'SYSTEM', 'Funding account not created',
      coalesce(p_failure_reason, 'We could not create your funding account. Support can help.'), '/support');
  end if;

  perform allawii_private.audit('SYSTEM', p_user_id, 'FUNDING_ACCOUNT_' || p_status::text, 'funding_accounts', v_row.id::text);
  return v_row;
end $$;

-- ---------- client-safe security status ----------
create or replace function public.rpc_security_status()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'pin_set', (select pin_hash is not null from public.user_security where user_id = auth.uid()),
    'pin_set_at', (select pin_set_at from public.user_security where user_id = auth.uid()),
    'locked_until', (select locked_until from public.user_security where user_id = auth.uid())
  );
$$;

-- ---------- WhatsApp linking ----------
create or replace function public.rpc_whatsapp_start_link()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_code text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  insert into public.whatsapp_identities (user_id, whatsapp_phone_hash, link_code_hash, link_code_expires_at, status)
  values (v_uid, 'PENDING-' || v_uid::text, encode(digest(v_code, 'sha256'), 'hex'), now() + interval '15 minutes', 'PENDING')
  on conflict (user_id) do update
    set link_code_hash = excluded.link_code_hash,
        link_code_expires_at = excluded.link_code_expires_at,
        status = 'PENDING';
  return jsonb_build_object('code', v_code, 'expires_at', now() + interval '15 minutes');
end $$;

-- ---------- admin ----------
create or replace function public.rpc_admin_stats()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_admin uuid := allawii_private.assert_admin(); v_out jsonb;
begin
  select jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_active', (select count(*) from public.profiles where status = 'ACTIVE'),
    'users_frozen', (select count(*) from public.profiles where status = 'FROZEN'),
    'kyc_verified', (select count(*) from public.kyc_profiles where kyc_status = 'VERIFIED'),
    'kyc_pending', (select count(*) from public.kyc_profiles where kyc_status in ('PENDING', 'REVIEW')),
    'wallet_float_minor', (select coalesce(sum(available_balance_minor), 0) from public.wallets),
    'savings_total_minor', (select coalesce(sum(current_amount_minor), 0) from public.savings_goals where status <> 'CLOSED'),
    'deposits_minor', (select coalesce(sum(amount_minor), 0) from public.transactions where type = 'DEPOSIT' and status = 'SUCCESSFUL'),
    'transfers_minor', (select coalesce(sum(amount_minor), 0) from public.transactions where type = 'TRANSFER' and status = 'SUCCESSFUL'),
    'tx_pending', (select count(*) from public.transactions where status in ('PENDING', 'PROCESSING')),
    'tx_failed', (select count(*) from public.transactions where status = 'FAILED'),
    'webhooks_unprocessed', (select count(*) from public.webhook_events where status = 'RECEIVED'),
    'tickets_open', (select count(*) from public.support_tickets where status in ('OPEN', 'PENDING'))
  ) into v_out;
  return v_out;
end $$;

create or replace function public.rpc_admin_users(p_search text default null, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, full_name text, email citext, phone_number text, status account_status,
  kyc_status kyc_status, available_minor bigint, savings_minor bigint,
  goals_count bigint, tx_count bigint, created_at timestamptz
) language plpgsql security definer set search_path = public, pg_temp as $$
declare v_admin uuid := allawii_private.assert_admin();
begin
  return query
  select p.id, p.full_name, p.email, p.phone_number, p.status,
         coalesce(k.kyc_status, 'NOT_STARTED'::kyc_status),
         coalesce(w.available_balance_minor, 0), coalesce(w.savings_balance_minor, 0),
         (select count(*) from public.savings_goals g where g.user_id = p.id and g.status <> 'CLOSED'),
         (select count(*) from public.transactions t where t.user_id = p.id),
         p.created_at
  from public.profiles p
  left join public.kyc_profiles k on k.user_id = p.id
  left join public.wallets w on w.user_id = p.id
  where p_search is null or p_search = ''
     or p.full_name ilike '%' || p_search || '%'
     or p.email::text ilike '%' || p_search || '%'
     or coalesce(p.phone_number, '') ilike '%' || p_search || '%'
  order by p.created_at desc
  limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset);
end $$;

create or replace function public.rpc_admin_set_account_status(p_user_id uuid, p_status account_status, p_reason text default null)
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v_admin uuid := allawii_private.assert_admin(); v_row public.profiles; v_before jsonb;
begin
  select to_jsonb(p) into v_before from public.profiles p where id = p_user_id;
  update public.profiles set status = p_status, updated_at = now() where id = p_user_id returning * into v_row;
  if p_status = 'FROZEN' then
    update public.wallets set status = 'FROZEN', frozen_at = now(), updated_at = now() where user_id = p_user_id;
    perform allawii_private.notify_user(p_user_id, 'SECURITY', 'Account frozen',
      coalesce(p_reason, 'Your account was frozen by support. Contact us for help.'), '/support');
  elsif p_status = 'ACTIVE' then
    update public.wallets set status = 'ACTIVE', frozen_at = null, updated_at = now() where user_id = p_user_id;
    perform allawii_private.notify_user(p_user_id, 'SECURITY', 'Account restored',
      'Your Allawii account is active again.', '/dashboard');
  end if;
  perform allawii_private.audit('ADMIN', v_admin, 'ACCOUNT_STATUS_CHANGED', 'profiles', p_user_id::text, v_before, to_jsonb(v_row));
  return v_row;
end $$;

create or replace function public.rpc_admin_kyc_decision(p_user_id uuid, p_decision kyc_status, p_reason text default null)
returns public.kyc_profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v_admin uuid := allawii_private.assert_admin(); v_row public.kyc_profiles;
begin
  if p_decision not in ('VERIFIED', 'REJECTED', 'REVIEW', 'PENDING') then
    raise exception 'INVALID_DECISION';
  end if;
  update public.kyc_profiles set
    kyc_status = p_decision,
    verified_at = case when p_decision = 'VERIFIED' then now() else verified_at end,
    failure_reason = case when p_decision = 'REJECTED' then coalesce(p_reason, 'Verification failed') else null end,
    verification_level = case when p_decision = 'VERIFIED' then greatest(verification_level, 2) else verification_level end,
    updated_at = now()
  where user_id = p_user_id returning * into v_row;
  perform allawii_private.notify_user(p_user_id, 'KYC',
    case when p_decision = 'VERIFIED' then 'Identity verified' else 'Identity check update' end,
    case when p_decision = 'VERIFIED' then 'Your identity has been verified. You can now fund your wallet.'
         when p_decision = 'REJECTED' then coalesce(p_reason, 'We could not verify your identity.')
         else 'Your identity check needs a second look. We will update you shortly.' end, '/kyc');
  perform allawii_private.audit('ADMIN', v_admin, 'KYC_DECISION_' || p_decision::text, 'kyc_profiles', p_user_id::text, null, jsonb_build_object('reason', p_reason));
  return v_row;
end $$;

create or replace function public.rpc_admin_adjust_wallet(p_user_id uuid, p_amount_minor bigint, p_direction entry_direction, p_reason text)
returns public.wallets language plpgsql security definer set search_path = public, pg_temp as $$
declare v_admin uuid := allawii_private.assert_admin(); v_wallet public.wallets; v_tx public.transactions;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  if p_amount_minor is null or p_amount_minor <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;

  insert into public.transactions (user_id, wallet_id, type, status, amount_minor, provider, client_reference, narration, completed_at, metadata)
  values (p_user_id, v_wallet.id, 'ADJUSTMENT', 'SUCCESSFUL', p_amount_minor, 'allawii',
    'ALW-ADJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    p_reason, now(), jsonb_build_object('admin_id', v_admin, 'reason', p_reason, 'direction', p_direction))
  returning * into v_tx;

  perform allawii_private.post_entry(v_wallet.id,
    case when p_direction = 'CREDIT' then 'ADJUSTMENT_CREDIT'::ledger_entry_type else 'ADJUSTMENT_DEBIT'::ledger_entry_type end,
    p_direction, p_amount_minor, v_tx.id, null, 'POSTED', p_reason, 'adj:' || v_tx.id::text);

  perform allawii_private.notify_user(p_user_id, case when p_direction = 'CREDIT' then 'CREDIT' else 'DEBIT' end,
    'Balance adjustment', p_reason, '/transactions');
  perform allawii_private.audit('ADMIN', v_admin, 'WALLET_ADJUSTMENT', 'wallets', v_wallet.id::text, null,
    jsonb_build_object('amount_minor', p_amount_minor, 'direction', p_direction, 'reason', p_reason));

  select * into v_wallet from public.wallets where id = v_wallet.id;
  return v_wallet;
end $$;

create or replace function public.rpc_admin_update_settings(p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_admin uuid := allawii_private.assert_admin(); v_new jsonb;
begin
  insert into public.app_settings (key, value) values ('platform', coalesce(allawii_private.platform(), '{}'::jsonb) || p_patch)
  on conflict (key) do update set value = public.app_settings.value || p_patch, updated_at = now()
  returning value into v_new;
  perform allawii_private.audit('ADMIN', v_admin, 'SETTINGS_UPDATED', 'app_settings', 'platform', null, v_new);
  return v_new;
end $$;

create or replace function public.rpc_admin_set_ticket_status(p_ticket_id uuid, p_status ticket_status)
returns public.support_tickets language plpgsql security definer set search_path = public, pg_temp as $$
declare v_admin uuid := allawii_private.assert_admin(); v_row public.support_tickets;
begin
  update public.support_tickets set status = p_status, updated_at = now() where id = p_ticket_id returning * into v_row;
  perform allawii_private.audit('ADMIN', v_admin, 'TICKET_STATUS_CHANGED', 'support_tickets', p_ticket_id::text, null, jsonb_build_object('status', p_status));
  return v_row;
end $$;

grant execute on function public.rpc_funding_account_set(uuid, funding_account_status, text, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.rpc_settle_transfer(uuid, boolean, text, text) to authenticated, service_role;
grant execute on function public.rpc_deposit_settle(text, text, boolean, text) to authenticated, service_role;
grant execute on function public.rpc_security_status() to authenticated;
grant execute on function public.rpc_whatsapp_start_link() to authenticated;
grant execute on function public.rpc_admin_stats() to authenticated;
grant execute on function public.rpc_admin_users(text, int, int) to authenticated;
grant execute on function public.rpc_admin_set_account_status(uuid, account_status, text) to authenticated;
grant execute on function public.rpc_admin_kyc_decision(uuid, kyc_status, text) to authenticated;
grant execute on function public.rpc_admin_adjust_wallet(uuid, bigint, entry_direction, text) to authenticated;
grant execute on function public.rpc_admin_update_settings(jsonb) to authenticated;
grant execute on function public.rpc_admin_set_ticket_status(uuid, ticket_status) to authenticated;

-- =====================================================================
-- 0006_seed.sql
-- =====================================================================
-- Allawii — 0006: seed reference data

insert into public.app_settings (key, value) values
  ('platform', jsonb_build_object(
    'demo_mode', true,
    'currency', 'NGN',
    'min_transfer_minor', 10000,      -- ₦100
    'max_transfer_minor', 50000000,   -- ₦500,000
    'daily_transfer_minor', 100000000,-- ₦1,000,000
    'transfer_fee_minor', 0,
    'fee_cap_minor', 200000,
    'min_deposit_minor', 10000,
    'brand_name', 'Allawii',
    'product_line', 'Student wallet and savings goals'
  ))
on conflict (key) do update set value = public.app_settings.value || excluded.value, updated_at = now();

insert into public.banks (code, name) values
  ('044','Access Bank'), ('063','Access Bank (Diamond)'), ('023','Citibank'),
  ('050','Ecobank'), ('070','Fidelity Bank'), ('011','First Bank of Nigeria'),
  ('214','First City Monument Bank'), ('103','Globus Bank'), ('058','Guaranty Trust Bank'),
  ('030','Heritage Bank'), ('301','Jaiz Bank'), ('082','Keystone Bank'),
  ('50211','Kuda Microfinance Bank'), ('076','Polaris Bank'), ('101','Providus Bank'),
  ('221','Stanbic IBTC Bank'), ('068','Standard Chartered Bank'), ('232','Sterling Bank'),
  ('100','SunTrust Bank'), ('032','Union Bank'), ('033','United Bank for Africa'),
  ('215','Unity Bank'), ('035','Wema Bank'), ('057','Zenith Bank'),
  ('999992','OPay Digital Services'), ('999991','PalmPay'), ('50515','Moniepoint MFB'),
  ('51318','FairMoney MFB'), ('565','Carbon'), ('566','VFD Microfinance Bank'),
  ('51310','Sparkle Microfinance Bank'), ('125','Rubies MFB'), ('102','Titan Trust Bank'),
  ('105','PremiumTrust Bank'), ('107','Optimus Bank'), ('104','Parallex Bank'),
  ('303','Lotus Bank'), ('120001','9 Payment Service Bank'), ('120002','Hope Payment Service Bank'),
  ('120003','MOMO Payment Service Bank')
on conflict (code) do update set name = excluded.name, is_active = true;

-- storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc-documents', 'kyc-documents', false, 5242880, array['image/png','image/jpeg','application/pdf'])
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists avatars_user_write on storage.objects;
create policy avatars_user_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists kyc_user_write on storage.objects;
create policy kyc_user_write on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists kyc_user_read on storage.objects;
create policy kyc_user_read on storage.objects for select to authenticated
  using (bucket_id = 'kyc-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

