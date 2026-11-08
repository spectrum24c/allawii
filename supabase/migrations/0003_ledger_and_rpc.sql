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
