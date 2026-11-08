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
