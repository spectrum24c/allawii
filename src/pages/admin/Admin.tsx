import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, Search, ShieldCheck, X } from "lucide-react";
import { AdminShell, AdminStatus, Panel, Stat, type AdminTab } from "../../components/layout/AdminShell";
import { Field, Input, Modal, Select, Spinner, useToast } from "../../components/ui";
import { admin } from "../../lib/api";
import { humanError } from "../../lib/errors";
import { formatDateTime, naira, titleCase, toMinor } from "../../lib/format";
import { supabase } from "../../lib/supabase";
import type { AdminUserRow } from "../../lib/types";

type KycRow = {
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  kyc_status: string;
  verification_level: number | null;
  bvn_last4: string | null;
  nin_last4: string | null;
  submitted_at: string | null;
  failure_reason: string | null;
  available_minor: number;
};

const btn = "inline-flex items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-[12px] font-semibold transition-transform duration-300 active:scale-[.98] disabled:opacity-40";
const btnPrimary = `${btn} bg-[#C8F169] text-[#0A120F] hover:brightness-105`;
const btnGhost = `${btn} border border-white/12 text-[#C9D9D0] hover:bg-white/[.06]`;
const btnDanger = `${btn} border border-[#FF9A8B]/30 bg-[#FF9A8B]/10 text-[#FF9A8B] hover:bg-[#FF9A8B]/15`;

export default function Admin() {
  const [tab, setTab] = useState<AdminTab>("kyc");
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [queue, setQueue] = useState<KycRow[] | null>(null);
  const [queueFilter, setQueueFilter] = useState<"OPEN" | "ALL">("OPEN");
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [txs, setTxs] = useState<any[] | null>(null);
  const [hooks, setHooks] = useState<any[] | null>(null);
  const [settings, setSettings] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const { push } = useToast();

  const loadStats = useCallback(async () => {
    try { setStats(await admin.stats()); } catch (e) { push({ tone: "error", title: "Could not load stats", body: humanError(e) }); }
  }, [push]);

  const loadQueue = useCallback(async (filter: "OPEN" | "ALL") => {
    try {
      const rows = await admin.kycQueue(filter === "OPEN" ? null : "ALL");
      setQueue((rows ?? []).filter((r) => filter === "ALL" || ["PENDING", "REVIEW"].includes(r.kyc_status)));
    } catch (e) {
      push({ tone: "error", title: "Could not load the KYC queue", body: humanError(e) });
    }
  }, [push]);

  const loadUsers = useCallback(async (q = "") => {
    try { setUsers(await admin.users(q)); } catch (e) { push({ tone: "error", title: "Could not load people", body: humanError(e) }); }
  }, [push]);

  useEffect(() => { loadStats(); loadQueue("OPEN"); }, [loadStats, loadQueue]);
  useEffect(() => { if (tab === "kyc") loadQueue(queueFilter); }, [tab, queueFilter, loadQueue]);
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

  const pendingCount = useMemo(
    () => (queue ?? []).filter((r) => ["PENDING", "REVIEW"].includes(r.kyc_status)).length,
    [queue],
  );

  async function decide(row: KycRow, decision: "VERIFIED" | "REJECTED", reason?: string) {
    setBusyId(row.user_id);
    try {
      await admin.kycDecision(row.user_id, decision, reason);
      push({
        tone: "success",
        title: decision === "VERIFIED" ? `${row.full_name} verified` : `${row.full_name} rejected`,
        body: decision === "VERIFIED" ? "Deposits, transfers and a funding account are now unlocked." : "The customer is notified with your reason.",
      });
      setRejecting(null); setRejectReason("");
      await Promise.all([loadQueue(queueFilter), loadStats()]);
    } catch (e) {
      push({ tone: "error", title: "Decision not saved", body: humanError(e) });
    } finally {
      setBusyId(null);
    }
  }

  async function saveSettings() {
    try {
      await admin.updateSettings(JSON.parse(settings));
      push({ tone: "success", title: "Settings saved" });
      loadStats();
    } catch (e) {
      push({ tone: "error", title: "Could not save", body: humanError(e) });
    }
  }

  return (
    <AdminShell active={tab} onChange={setTab} pendingKyc={pendingCount}>
      <div className="console-rise">
        {tab === "overview" && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-[24px] font-semibold tracking-[-0.035em] text-white">Operations overview</h1>
                <p className="mt-1 text-[12.5px] text-[#8AA398]">Live position across wallets, savings and the verification queue.</p>
              </div>
              <div className="flex gap-2">
                <button className={btnGhost} onClick={() => { loadStats(); loadQueue("OPEN"); }}>Refresh</button>
                <button className={btnPrimary} onClick={() => setTab("kyc")}>
                  Review {pendingCount} pending
                </button>
              </div>
            </div>

            {stats === null ? <div className="mt-6"><Spinner /></div> : (
              <>
                <div className="console-stagger mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Stat label="Wallet float" value={naira(stats.wallet_float_minor ?? 0)} sub={`${stats.users_active ?? 0} active of ${stats.users_total ?? 0} people`} />
                  <Stat label="Savings held" value={naira(stats.savings_total_minor ?? 0)} sub="Allocated to goals" />
                  <Stat label="KYC awaiting you" value={String(pendingCount)} sub={`${stats.kyc_verified ?? 0} verified to date`} tone={pendingCount ? "warn" : "good"} />
                  <Stat label="In flight" value={String(stats.tx_pending ?? 0)} sub={`${stats.tx_failed ?? 0} failed · ${stats.tx_successful ?? 0} settled`} />
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <Panel title="Money movement" subtitle="Successful, since launch" className="lg:col-span-2">
                    <div className="grid grid-cols-2 divide-x divide-white/8">
                      <div className="p-4">
                        <p className="text-[10.5px] uppercase tracking-[0.12em] text-[#7E988C]">Deposits in</p>
                        <p className="mt-1.5 text-[20px] font-semibold tnum">{naira(stats.deposits_minor ?? 0)}</p>
                      </div>
                      <div className="p-4">
                        <p className="text-[10.5px] uppercase tracking-[0.12em] text-[#7E988C]">Transfers out</p>
                        <p className="mt-1.5 text-[20px] font-semibold tnum">{naira(stats.transfers_minor ?? 0)}</p>
                      </div>
                    </div>
                  </Panel>
                  <Panel title="Needs attention" subtitle="Queues worth clearing today">
                    <ul className="divide-y divide-white/8">
                      {[
                        { label: "KYC pending or in review", value: pendingCount, go: "kyc" as AdminTab },
                        { label: "Failed transactions", value: stats.tx_failed ?? 0, go: "ledger" as AdminTab },
                        { label: "Open support tickets", value: stats.tickets_open ?? 0, go: "users" as AdminTab },
                        { label: "Unprocessed webhooks", value: stats.webhooks_unprocessed ?? 0, go: "webhooks" as AdminTab },
                      ].map((row) => (
                        <li key={row.label}>
                          <button onClick={() => setTab(row.go)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[.04]">
                            <span className="text-[12px] text-[#C9D9D0]">{row.label}</span>
                            <span className={`ml-auto text-[12.5px] font-semibold tnum ${row.value ? "text-[#FFCF8B]" : "text-[#7E988C]"}`}>{row.value}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                </div>
              </>
            )}
          </>
        )}

        {tab === "kyc" && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-[24px] font-semibold tracking-[-0.035em] text-white">KYC queue</h1>
                <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-[#8AA398]">
                  Approving here is the only thing that unlocks deposits, transfers and a funding account. The customer
                  is notified either way, and every decision is written to the audit log.
                </p>
              </div>
              <div className="flex gap-1 rounded-full border border-white/10 p-1">
                {(["OPEN", "ALL"] as const).map((f) => (
                  <button key={f} onClick={() => setQueueFilter(f)}
                    className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${queueFilter === f ? "bg-[#C8F169] text-[#0A120F]" : "text-[#9DB3A8] hover:text-white"}`}>
                    {f === "OPEN" ? "Needs review" : "All"}
                  </button>
                ))}
              </div>
            </div>

            {queue === null ? <div className="mt-6"><Spinner /></div> : queue.length === 0 ? (
              <Panel className="mt-5">
                <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                  <ShieldCheck className="h-7 w-7 text-[#C8F169]" />
                  <p className="text-[13.5px] font-semibold text-white">Queue clear</p>
                  <p className="max-w-sm text-[12px] text-[#8AA398]">Nothing is waiting on a decision. New submissions appear here the moment a customer submits their BVN or NIN.</p>
                </div>
              </Panel>
            ) : (
              <div className="console-stagger mt-5 grid gap-3 xl:grid-cols-2">
                {queue.map((row) => {
                  const method = row.bvn_last4 ? `BVN ····${row.bvn_last4}` : row.nin_last4 ? `NIN ····${row.nin_last4}` : "No identifier";
                  const open = rejecting === row.user_id;
                  return (
                    <Panel key={row.user_id} className="console-tile overflow-hidden">
                      <div className="flex flex-wrap items-start gap-3 p-4">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-[12px] font-bold uppercase">
                          {row.full_name?.slice(0, 2) ?? "??"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-[13.5px] font-semibold text-white">{row.full_name}</p>
                            <AdminStatus>{row.kyc_status.replace("_", " ")}</AdminStatus>
                          </div>
                          <p className="mt-0.5 truncate text-[11.5px] text-[#8AA398]">{row.email} · {row.phone_number ?? "no phone"}</p>
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#9DB3A8]">
                            <span className="font-mono">{method}</span>
                            <span>Level {row.verification_level ?? 0}</span>
                            <span className="tnum">Wallet {naira(row.available_minor)}</span>
                            {row.submitted_at && (
                              <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {formatDateTime(row.submitted_at)}</span>
                            )}
                          </p>
                          {row.failure_reason && <p className="mt-1 text-[11px] text-[#FF9A8B]">{row.failure_reason}</p>}
                        </div>
                        {!open && (
                          <div className="flex shrink-0 gap-2">
                            <button className={btnPrimary} disabled={busyId === row.user_id} onClick={() => decide(row, "VERIFIED")}>
                              <Check className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button className={btnDanger} disabled={busyId === row.user_id} onClick={() => { setRejecting(row.user_id); setRejectReason(""); }}>
                              <X className="h-3.5 w-3.5" /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                      {open && (
                        <div className="border-t border-white/8 bg-black/20 p-4">
                          <label htmlFor={`reason-${row.user_id}`} className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7E988C]">
                            Reason shown to the customer
                          </label>
                          <input
                            id={`reason-${row.user_id}`}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Name on the BVN does not match the account holder"
                            className="mt-1.5 w-full rounded-[10px] border border-white/12 bg-[#0A120F] px-3 py-2 text-[12.5px] text-white placeholder:text-[#5F7A6E] focus:border-[#C8F169]/60 focus:outline-none"
                          />
                          <div className="mt-2.5 flex gap-2">
                            <button className={btnDanger} disabled={!rejectReason.trim() || busyId === row.user_id}
                              onClick={() => decide(row, "REJECTED", rejectReason.trim())}>
                              Confirm rejection
                            </button>
                            <button className={btnGhost} onClick={() => setRejecting(null)}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </Panel>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "users" && (
          <>
            <h1 className="text-[24px] font-semibold tracking-[-0.035em] text-white">People</h1>
            <p className="mt-1 text-[12.5px] text-[#8AA398]">Open a person to freeze an account, override KYC or post a ledger adjustment.</p>
            <div className="relative mt-4 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7E988C]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or phone"
                className="w-full rounded-[11px] border border-white/12 bg-[#0F1915] py-2.5 pl-9 pr-3 text-[12.5px] text-white placeholder:text-[#5F7A6E] focus:border-[#C8F169]/60 focus:outline-none" />
            </div>
            <Panel className="mt-3 overflow-hidden">
              {users === null ? <Spinner /> : users.length === 0 ? (
                <p className="p-6 text-center text-[12.5px] text-[#8AA398]">Nobody matches that search.</p>
              ) : (
                <div className="divide-y divide-white/8">
                  {users.map((u) => (
                    <button key={u.id} onClick={() => setSelected(u)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[.04]">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-white">{u.full_name}</p>
                        <p className="truncate text-[11.5px] text-[#8AA398]">{u.email} · {u.phone_number ?? "no phone"}</p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="text-[12.5px] font-semibold tnum">{naira(u.available_minor)}</p>
                        <p className="text-[10.5px] text-[#7E988C]">{u.tx_count} tx · {u.goals_count} goals</p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <AdminStatus>{u.status}</AdminStatus>
                        <AdminStatus>{u.kyc_status.replace("_", " ")}</AdminStatus>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          </>
        )}

        {tab === "ledger" && (
          <>
            <h1 className="text-[24px] font-semibold tracking-[-0.035em] text-white">Transactions</h1>
            <p className="mt-1 text-[12.5px] text-[#8AA398]">Newest 60 across the platform. Anything suspicious is frozen from the person sheet, not edited here.</p>
            <Panel className="mt-4 overflow-hidden">
              {txs === null ? <Spinner /> : txs.length === 0 ? <p className="p-6 text-center text-[12.5px] text-[#8AA398]">No transactions yet.</p> : (
                <div className="divide-y divide-white/8">
                  {txs.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-white">{t.narration ?? titleCase(t.type)}</p>
                        <p className="truncate font-mono text-[10.5px] text-[#7E988C]">{t.client_reference}</p>
                      </div>
                      <p className={`text-[12.5px] font-semibold tnum ${t.type?.includes("TRANSFER") ? "text-[#FFCF8B]" : "text-[#C8F169]"}`}>{naira(t.amount_minor)}</p>
                      <AdminStatus>{t.status}</AdminStatus>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </>
        )}

        {tab === "webhooks" && (
          <>
            <h1 className="text-[24px] font-semibold tracking-[-0.035em] text-white">Webhooks</h1>
            <p className="mt-1 text-[12.5px] text-[#8AA398]">Signed Monnify callbacks. A processed event means the ledger and the provider agree.</p>
            <Panel className="mt-4 overflow-hidden">
              {hooks === null ? <Spinner /> : hooks.length === 0 ? (
                <p className="p-6 text-center text-[12.5px] text-[#8AA398]">No events received yet. Point the Monnify dashboard webhook at the monnify-webhook function.</p>
              ) : (
                <div className="divide-y divide-white/8">
                  {hooks.map((h) => (
                    <div key={h.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-[12.5px] font-medium text-white">{h.provider} · {h.event_type}</p>
                        <AdminStatus>{h.status}</AdminStatus>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[10.5px] text-[#7E988C]">{h.event_id}</p>
                      <p className="text-[10.5px] text-[#8AA398]">
                        {formatDateTime(h.received_at)} · signature {h.signature_valid ? "valid" : "invalid"}{h.error ? ` · ${h.error}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </>
        )}

        {tab === "settings" && (
          <>
            <h1 className="text-[24px] font-semibold tracking-[-0.035em] text-white">Platform settings</h1>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[#8AA398]">
              Amounts are in minor units (kobo). Turning demo_mode off requires live Monnify keys, otherwise payments fail.
            </p>
            <Panel className="mt-4 p-4">
              <textarea
                value={settings}
                onChange={(e) => setSettings(e.target.value)}
                rows={16}
                spellCheck={false}
                className="w-full rounded-[11px] border border-white/12 bg-[#0A120F] p-3 font-mono text-[11.5px] leading-relaxed text-[#D5E4DC] focus:border-[#C8F169]/60 focus:outline-none"
              />
              <div className="mt-3 flex gap-2">
                <button className={btnPrimary} onClick={saveSettings}>Save settings</button>
                <button className={btnGhost} onClick={() => loadStats()}>Discard changes</button>
              </div>
            </Panel>
          </>
        )}
      </div>

      {selected && <PersonSheet user={selected} onClose={() => setSelected(null)} onDone={() => { setSelected(null); loadUsers(search); loadStats(); }} />}
    </AdminShell>
  );
}

/* ── person sheet ──────────────────────────────────────────────────────── */

function PersonSheet({ user, onClose, onDone }: { user: AdminUserRow; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"freeze" | "kyc" | "adjust">("freeze");
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState("VERIFIED");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  async function run() {
    setBusy(true);
    try {
      if (mode === "freeze") {
        await admin.setAccountStatus(user.id, user.status === "FROZEN" ? "ACTIVE" : "FROZEN", reason || undefined);
        push({ tone: "success", title: user.status === "FROZEN" ? "Account unfrozen" : "Account frozen" });
      } else if (mode === "kyc") {
        await admin.kycDecision(user.id, decision, reason || undefined);
        push({ tone: "success", title: `KYC set to ${decision}` });
      } else {
        await admin.adjustWallet(user.id, toMinor(amount), direction, reason);
        push({ tone: "success", title: "Adjustment posted" });
      }
      onDone();
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
          <div className="mt-1.5 flex gap-1.5">
            <AdminStatus>{user.status}</AdminStatus>
            <AdminStatus>{user.kyc_status}</AdminStatus>
          </div>
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
        )}

        <Field label={mode === "adjust" ? "Reason (required, audited)" : "Reason (optional)"}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={mode === "freeze" ? "Suspicious activity" : "Support correction"} />
        </Field>

        <button onClick={run} disabled={busy || (mode === "adjust" && (!amount || !reason.trim()))}
          className={`${mode === "freeze" && user.status !== "FROZEN" ? btnDanger : btnPrimary} w-full justify-center py-2.5`}>
          {busy ? "Working" : mode === "freeze" ? (user.status === "FROZEN" ? "Unfreeze account" : "Freeze account")
            : mode === "kyc" ? `Set KYC to ${decision}` : `Post ${direction.toLowerCase()} adjustment`}
        </button>
        <p className="text-[11px] leading-relaxed text-[var(--color-ink-soft)]">
          Every action here is recorded in the audit log with your admin id. Adjustments create a ledger entry; no balance is edited directly.
        </p>
      </div>
    </Modal>
  );
}
