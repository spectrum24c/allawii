import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Search, Shield, Sliders, Users, Webhook } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, useToast } from "../../components/ui";
import { admin } from "../../lib/api";
import { humanError } from "../../lib/errors";
import { formatDateTime, naira, titleCase, toMinor } from "../../lib/format";
import { supabase } from "../../lib/supabase";
import type { AdminUserRow } from "../../lib/types";

type Tab = "overview" | "users" | "ledger" | "webhooks" | "settings";

export default function Admin() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [txs, setTxs] = useState<any[] | null>(null);
  const [hooks, setHooks] = useState<any[] | null>(null);
  const [settings, setSettings] = useState<string>("");
  const { push } = useToast();

  const loadStats = useCallback(async () => {
    try { setStats(await admin.stats()); } catch (e) { push({ tone: "error", title: "Could not load stats", body: humanError(e) }); }
  }, [push]);

  const loadUsers = useCallback(async (q = "") => {
    try { setUsers(await admin.users(q)); } catch (e) { push({ tone: "error", title: "Could not load users", body: humanError(e) }); }
  }, [push]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { if (tab === "users") loadUsers(search); }, [tab, search, loadUsers]);

  useEffect(() => {
    if (tab === "ledger") {
      supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(60)
        .then(({ data }) => setTxs(data ?? []));
    }
    if (tab === "webhooks") {
      supabase.from("webhook_events").select("*").order("received_at", { ascending: false }).limit(40)
        .then(({ data }) => setHooks(data ?? []));
    }
    if (tab === "settings") {
      supabase.from("app_settings").select("value").eq("key", "platform").maybeSingle()
        .then(({ data }) => setSettings(JSON.stringify(data?.value ?? {}, null, 2)));
    }
  }, [tab]);

  async function saveSettings() {
    try {
      const patch = JSON.parse(settings);
      await admin.updateSettings(patch);
      push({ tone: "success", title: "Settings saved" });
      loadStats();
    } catch (e) {
      push({ tone: "error", title: "Could not save", body: humanError(e) });
    }
  }

  const tabs: Array<{ key: Tab; label: string; icon: any }> = [
    { key: "overview", label: "Overview", icon: Shield },
    { key: "users", label: "Users", icon: Users },
    { key: "ledger", label: "Transactions", icon: AlertTriangle },
    { key: "webhooks", label: "Webhooks", icon: Webhook },
    { key: "settings", label: "Settings", icon: Sliders },
  ];

  return (
    <AppShell>
      <div className="rise">
        <h1 className="text-[24px] tracking-[-0.02em]">Admin</h1>
        <p className="mt-1 text-[13.5px] text-[var(--color-ink-soft)]">Operations only. Balances change through ledger entries with a reason, never by editing a number.</p>

        <div className="mt-4 flex gap-1 overflow-x-auto rounded-full border border-[var(--color-line)] bg-white p-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-medium transition-colors ${tab === key ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-ink-soft)] hover:bg-black/[.03]"}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <>
            {stats === null ? <Spinner /> : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Users", value: String(stats.users_total ?? 0), sub: `${stats.users_active ?? 0} active · ${stats.users_frozen ?? 0} frozen` },
                  { label: "Wallet float", value: naira(stats.wallet_float_minor ?? 0), sub: "Available across all wallets" },
                  { label: "Savings held", value: naira(stats.savings_total_minor ?? 0), sub: "Allocated to goals" },
                  { label: "Deposits", value: naira(stats.deposits_minor ?? 0), sub: "Successful" },
                  { label: "Transfers out", value: naira(stats.transfers_minor ?? 0), sub: "Successful" },
                  { label: "KYC verified", value: String(stats.kyc_verified ?? 0), sub: `${stats.kyc_pending ?? 0} pending review` },
                  { label: "In-flight", value: String(stats.tx_pending ?? 0), sub: `${stats.tx_failed ?? 0} failed` },
                  { label: "Open tickets", value: String(stats.tickets_open ?? 0), sub: `${stats.webhooks_unprocessed ?? 0} unprocessed webhooks` },
                ].map((s) => (
                  <Card key={s.label} className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">{s.label}</p>
                    <p className="mt-1 text-[20px] font-semibold tracking-[-0.02em] tnum">{s.value}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-ink-soft)]">{s.sub}</p>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "users" && (
          <>
            <div className="relative mt-5 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-soft)]" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or phone" className="pl-9" />
            </div>
            <Card className="mt-3 overflow-hidden">
              {users === null ? <Spinner /> : users.length === 0 ? (
                <div className="p-2"><EmptyState title="No users match" /></div>
              ) : (
                <div className="divide-y divide-[var(--color-line)]">
                  {users.map((u) => (
                    <button key={u.id} onClick={() => setSelected(u)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#fafaf7]">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{u.full_name}</p>
                        <p className="truncate text-[11.5px] text-[var(--color-ink-soft)]">{u.email} · {u.phone_number ?? "no phone"}</p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="text-[12.5px] font-medium tnum">{naira(u.available_minor)}</p>
                        <p className="text-[10.5px] text-[var(--color-ink-soft)]">{u.tx_count} tx · {u.goals_count} goals</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Badge tone={u.status}>{u.status}</Badge>
                        <Badge tone={u.kyc_status}>{u.kyc_status.replace("_", " ")}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {tab === "ledger" && (
          <Card className="mt-5 overflow-hidden">
            {txs === null ? <Spinner /> : txs.length === 0 ? <div className="p-2"><EmptyState title="No transactions under your access" /></div> : (
              <div className="divide-y divide-[var(--color-line)]">
                {txs.map((t) => (
                  <Link key={t.id} to={`/transactions/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#fafaf7]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium">{t.narration ?? titleCase(t.type)}</p>
                      <p className="truncate font-mono text-[10.5px] text-[var(--color-ink-soft)]">{t.client_reference}</p>
                    </div>
                    <p className="text-[12.5px] font-semibold tnum">{naira(t.amount_minor)}</p>
                    <Badge tone={t.status}>{t.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "webhooks" && (
          <Card className="mt-5 overflow-hidden">
            {hooks === null ? <Spinner /> : hooks.length === 0 ? <div className="p-2"><EmptyState title="No webhook events yet" body="Signed Monnify callbacks appear here once payment keys are configured." /></div> : (
              <div className="divide-y divide-[var(--color-line)]">
                {hooks.map((h) => (
                  <div key={h.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-[12.5px] font-medium">{h.provider} · {h.event_type}</p>
                      <Badge tone={h.status === "PROCESSED" ? "SUCCESSFUL" : h.status}>{h.status}</Badge>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[10.5px] text-[var(--color-ink-soft)]">{h.event_id}</p>
                    <p className="text-[10.5px] text-[var(--color-ink-soft)]">
                      {formatDateTime(h.received_at)} · signature {h.signature_valid ? "valid" : "invalid"} {h.error ? `· ${h.error}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "settings" && (
          <Card className="mt-5 p-5">
            <p className="text-[13.5px] font-semibold">Platform settings</p>
            <p className="mt-1 text-[12px] text-[var(--color-ink-soft)]">
              Amounts are in minor units (kobo). Turning demo_mode off requires live Monnify keys, otherwise payments will fail.
            </p>
            <textarea
              value={settings}
              onChange={(e) => setSettings(e.target.value)}
              rows={14}
              spellCheck={false}
              className="mt-3 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-3 font-mono text-[11.5px] focus:border-[var(--color-brand)] focus:outline-none"
            />
            <Button className="mt-3" onClick={saveSettings}>Save settings</Button>
          </Card>
        )}

        <UserDrawer user={selected} onClose={() => setSelected(null)} onDone={() => { loadUsers(search); loadStats(); }} />
      </div>
    </AppShell>
  );
}

function UserDrawer({ user, onClose, onDone }: { user: AdminUserRow | null; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"freeze" | "kyc" | "adjust">("freeze");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState("VERIFIED");
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  useEffect(() => { setAmount(""); setReason(""); setMode("freeze"); }, [user?.id]);

  if (!user) return null;

  async function run() {
    setBusy(true);
    try {
      if (mode === "freeze") {
        const next = user!.status === "FROZEN" ? "ACTIVE" : "FROZEN";
        await admin.setAccountStatus(user!.id, next, reason || undefined);
        push({ tone: "success", title: `Account ${next.toLowerCase()}` });
      } else if (mode === "kyc") {
        await admin.kycDecision(user!.id, decision, reason || undefined);
        push({ tone: "success", title: `KYC set to ${decision}` });
      } else {
        await admin.adjustWallet(user!.id, toMinor(amount), direction, reason);
        push({ tone: "success", title: "Ledger adjustment posted" });
      }
      onDone();
      onClose();
    } catch (e) {
      push({ tone: "error", title: "Action failed", body: humanError(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={user.full_name}>
      <div className="space-y-4">
        <div className="rounded-xl bg-[var(--color-paper)] p-3 text-[12px]">
          <p className="font-medium">{user.email}</p>
          <p className="text-[var(--color-ink-soft)]">{user.phone_number ?? "no phone"} · joined {formatDateTime(user.created_at)}</p>
          <p className="mt-1 tnum">Available {naira(user.available_minor)} · savings {naira(user.savings_minor)}</p>
          <div className="mt-1.5 flex gap-1.5"><Badge tone={user.status}>{user.status}</Badge><Badge tone={user.kyc_status}>{user.kyc_status}</Badge></div>
        </div>

        <div className="flex gap-1 rounded-full border border-[var(--color-line)] p-1">
          {([["freeze", "Status"], ["kyc", "KYC"], ["adjust", "Adjust"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setMode(k as typeof mode)}
              className={`flex-1 rounded-full px-3 py-1.5 text-[12px] font-medium ${mode === k ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-ink-soft)]"}`}>
              {label}
            </button>
          ))}
        </div>

        {mode === "kyc" && (
          <Field label="KYC decision">
            <Select value={decision} onChange={(e) => setDecision(e.target.value)}>
              {["VERIFIED", "REVIEW", "REJECTED", "PENDING"].map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </Field>
        )}

        {mode === "adjust" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Amount (₦)">
                <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" className="tnum" />
              </Field>
              <Field label="Direction">
                <Select value={direction} onChange={(e) => setDirection(e.target.value as "CREDIT" | "DEBIT")}>
                  <option value="CREDIT">Credit</option>
                  <option value="DEBIT">Debit</option>
                </Select>
              </Field>
            </div>
          </>
        )}

        <Field label={mode === "adjust" ? "Reason (required, audited)" : "Reason (optional)"}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={mode === "freeze" ? "Suspicious activity" : "Support correction"} />
        </Field>

        <Button block loading={busy} onClick={run} disabled={mode === "adjust" && (!amount || !reason.trim())}
          variant={mode === "freeze" && user.status !== "FROZEN" ? "danger" : "primary"}>
          {mode === "freeze" ? (user.status === "FROZEN" ? "Unfreeze account" : "Freeze account")
            : mode === "kyc" ? `Set KYC to ${decision}` : `Post ${direction.toLowerCase()} adjustment`}
        </Button>
        <p className="text-[11px] leading-relaxed text-[var(--color-ink-soft)]">
          Every action here is recorded in the audit log with your admin id. Adjustments create a ledger entry; no balance is edited directly.
        </p>
      </div>
    </Modal>
  );
}
