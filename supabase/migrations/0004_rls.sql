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
