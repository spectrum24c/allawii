# Allawii

A student wallet and savings-goal platform. Deposits, a real ledger, transfers to verified bank accounts, savings
goals, and a read-only WhatsApp assistant, all on one backend.

This repository is the full application: React + TypeScript front end, Supabase (Postgres, Auth, Edge Functions,
Storage) backend, and Monnify payment integration.

> Allawii is **not** a bank, does not accept deposits as a deposit-taking institution, and pays no interest.
> Savings goals are an internal allocation of the user's own wallet balance.

---

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Front end | React 19 + TypeScript + Vite + Tailwind v4 | Fast, static-hostable, typed against the schema |
| Data | Supabase Postgres with RLS | Row isolation enforced in the database, not the UI |
| Auth | Supabase Auth (email + password) | Sessions, refresh rotation, reset links |
| Server | Supabase Edge Functions (Deno) | Secret keys stay server-side; webhooks need public URLs |
| Payments | Monnify (collections, name enquiry, disbursements) | Reserved accounts + checkout + transfers |
| Hosting | GitHub Pages (static SPA) | Free, HTTPS, matches the static build |

Money is stored as **bigint minor units (kobo)**. No floats anywhere in the money path.

---

## Repository layout

```
allawii/
├── src/
│   ├── components/          # design system, app shell, public layout
│   ├── hooks/useAuth.tsx    # session + profile + wallet + realtime
│   ├── lib/                 # supabase client, api layer, formatting, error mapping
│   └── pages/
│       ├── public/          # landing, marketing/legal pages, auth screens
│       ├── app/             # dashboard, wallet, deposit, transfer, savings, KYC, support
│       └── admin/           # operations dashboard
├── supabase/
│   ├── migrations/          # 0001 enums → 0006 seed (apply in order)
│   └── functions/
│       ├── payments/        # checkout init + server-side verification
│       ├── transfers/       # name enquiry + disbursement
│       ├── accounts/        # reserved/funding account provisioning, bank list
│       ├── monnify-webhook/ # signed, idempotent provider callbacks
│       └── whatsapp/        # Meta verification + read-only bot
└── .github/workflows/deploy.yml
```

---

## Database model

| Table | Purpose |
| --- | --- |
| `profiles` | Account record linked to `auth.users` |
| `user_roles` | `student` / `support` / `admin` |
| `user_security` | Hashed transaction PIN, failed attempts, lockout |
| `kyc_profiles` | KYC state machine, last-4 digits + hash, consent timestamp |
| `wallets` | One per user; cached projections only |
| `funding_accounts` | Dedicated account details from the provider |
| `transactions` | Intents and outcomes: DEPOSIT, TRANSFER, SAVINGS, ADJUSTMENT… |
| `ledger_entries` | Immutable money movements with `balance_after`, idempotency keys |
| `beneficiaries` | Saved recipients; account number column is not readable by clients |
| `savings_goals` | Target, policy (flexible/date-locked/locked), status |
| `notifications` | In-app alerts, streamed over Realtime |
| `audit_logs` | Every admin and system action |
| `webhook_events` | Provider callbacks, unique on `(provider, event_id)` |
| `support_tickets` / `support_messages` | Support threads |
| `whatsapp_identities` | Hashed phone → user link, one-time codes |
| `banks`, `app_settings` | Reference data and platform limits |

### How balances work

`wallets.available_balance_minor` is a **projection**, recomputed from `ledger_entries` on every write:

```
available = Σ posted credits − Σ posted debits − Σ pending debits (holds)
pending   = Σ pending credits + Σ pending debits
savings   = Σ posted savings allocations − Σ posted savings releases
```

Transfers place a `TRANSFER_HOLD` entry (PENDING) inside a row-locked transaction, so the money cannot be spent
twice while the bank responds. Settlement either voids the hold and posts a `TRANSFER_DEBIT` + `FEE_DEBIT`, or voids
the hold and marks the transfer failed.

### Security model

- RLS on every table; students read only their own rows, staff read all.
- Column-level grants: clients cannot select `beneficiaries.account_number`, `user_security.*`, or
  `kyc_profiles.bvn_hash` / `nin_hash` even if they craft their own query.
- All writes go through `SECURITY DEFINER` RPCs that re-check identity, KYC, status, limits and PIN.
- No admin can edit a balance; `rpc_admin_adjust_wallet` posts a ledger entry with a required reason and audit row.
- Webhook bodies are HMAC-SHA512 verified and deduplicated by event id before any credit posts.

---

## Local setup

```bash
git clone https://github.com/spectrum24c/allawii.git
cd allawii
npm install
cp .env.example .env    # then fill in the values
npm run dev             # http://localhost:5173
```

`.env`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
VITE_BASE_PATH=/
```

Only the anon key is shipped to the browser. Every table is protected by RLS, so the anon key grants nothing on
its own. The service role key and Monnify keys exist **only** as Edge Function secrets.

### Apply the database

Run the migrations in order in the Supabase SQL editor, or with the CLI:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

They are written to be idempotent, so re-running is safe.

### Edge Function secrets

```bash
supabase secrets set \
  MONNIFY_API_KEY=... \
  MONNIFY_SECRET_KEY=... \
  MONNIFY_CONTRACT_CODE=... \
  MONNIFY_BASE_URL=https://sandbox.monnify.com \
  MONNIFY_SOURCE_ACCOUNT=...          # wallet/collection account for disbursements
supabase secrets set \
  WHATSAPP_ACCESS_TOKEN=... \
  WHATSAPP_PHONE_NUMBER_ID=... \
  WHATSAPP_VERIFY_TOKEN=allawii-verify
supabase functions deploy payments transfers accounts monnify-webhook whatsapp --no-verify-jwt
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

> `monnify-webhook` and `whatsapp` are deployed with `--no-verify-jwt` because the providers cannot send a
> Supabase JWT. Both verify authenticity themselves: Monnify by HMAC signature, WhatsApp by the verify token for
> the handshake and by the Graph API for outbound calls.

### Demo mode

`app_settings.platform.demo_mode` is `true` by default. In demo mode:

- deposits credit a **clearly labelled** simulated balance (provider `demo`, `metadata.demo = true`);
- transfers settle as simulated and say so on the receipt;
- KYC verifies instantly so the flows are testable.

Nothing simulated is ever presented as a real bank transaction. Set `demo_mode` to `false` (Admin → Settings) only
when live Monnify keys are installed.

### Make yourself an admin

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from public.profiles where email = 'you@example.com'
on conflict (user_id, role) do nothing;
```

---

## Deployment

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on every push to `main`.

1. Repo → Settings → Pages → Source: **GitHub Actions**.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository **Actions secrets** (or variables).
3. Add the site URL to Supabase → Authentication → URL configuration, including
   `https://<user>.github.io/allawii/set-password` for password resets.
4. Set `VITE_BASE_PATH=/allawii/` for a project site (it is already set in the workflow for `allawii`).

---

## Testing checklist

- [ ] Sign up, confirm email, sign in, sign out
- [ ] Password reset round trip (`/forgot-password` → email → `/set-password`)
- [ ] KYC submit with an invalid length is rejected by the RPC, not just the form
- [ ] Deposit in demo mode credits a **labelled** demo entry
- [ ] Transfer: name enquiry → amount quote → PIN → hold → settlement
- [ ] Wrong PIN five times locks the PIN for 15 minutes
- [ ] Transfer over available balance is refused server-side
- [ ] Savings: create, contribute, withdraw, date-locked goal refuses early withdrawal, close releases balance
- [ ] Admin: freeze an account and confirm the wallet refuses new transfers
- [ ] Admin: wallet adjustment writes a ledger entry and an audit row
- [ ] Webhook replay with the same event id is ignored
- [ ] RLS: with a second account, a direct query for the first user's transactions returns zero rows
- [ ] Mobile: 360px wide, bottom navigation, no horizontal scroll

---

## Known limitations

- Transfers, reserved accounts and disbursements need a Monnify account with those products enabled. Sandbox
  access alone does not guarantee reserved-account or disbursement approval.
- Merchant name enquiry on sandbox only resolves accounts Monnify knows about. Unknown accounts fall back to
  manual name entry, which is stored as `UNVERIFIED`.
- WhatsApp outbound messaging needs a Meta Business account, a verified sender and an approved template.
- No OTP channel is wired for step-up transfer confirmation yet; the transaction PIN is the authorisation factor.
- KYC submission records consent and dispatches verification; with live keys the decision arrives asynchronously
  and is applied through the admin decision RPC or a provider webhook.
- Reconciliation reports against Monnify settlement data are modelled (`webhook_events`, `audit_logs`) but no
  scheduled reconciliation job is included.
