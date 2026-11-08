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
