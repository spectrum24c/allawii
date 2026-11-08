import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Clock3, FileClock, Search, ShieldCheck, X } from "lucide-react";
import {
  AdminShell, PageHead, Panel, Stat, Status, consoleBtn, type AdminTab,
} from "../../components/layout/AdminShell";
import { Field, Input, Modal, Select, Spinner, useToast } from "../../components/ui";
import { admin } from "../../lib/api";
import { humanError } from "../../lib/errors";
import { formatDateTime, naira, titleCase, toMinor } from "../../lib/format";
import { supabase } from "../../lib/supabase";
import type { AdminUserRow } from "../../lib/types";

type KycRow = {
  user_id: string; full_name: string; email: string; phone_number: string | null;
  kyc_status: string; verification_level: number | null; bvn_last4: string | null;
  nin_last4: string | null; submitted_at: string | null; failure_reason: string | null;
  available_minor: number;
};

type VolumeRow = { day: string; deposits_minor: number; transfers_minor: number; tx_count: number };

const num = (minor: number) => naira(minor).replace("₦", "₦");

export default function Admin() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [volume, setVolume] = useState<VolumeRow[] | null>(null);
  const [queue, setQueue] = useState<KycRow[] | null>(null);
  const [queueFilter, setQueueFilter] = useState<"OPEN" | "ALL">("OPEN");
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [txs, setTxs] = useState<any[] | null>(null);
  const [hooks, setHooks] = useState<any[] | null>(null);
  const [audit, setAudit] = useState<any[] | null>(null);
  const [settings, setSettings] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const { push } = useToast();

  const loadStats = useCallback(async () => {
    const [s, v] = await Promise.allSettled([admin.stats(), admin.volume(7)]);
    if (s.status === "fulfilled") setStats(s.value);
    else push({ tone: "error", title: "Could not load stats", body: humanError(s.reason) });
    if (v.status === "fulfilled") setVolume(v.value);
  }, [push]);

  const loadQueue = useCallback(async (filter: "OPEN" | "ALL") => {
    try {
      const rows = await admin.kycQueue(filter === "OPEN" ? null : "ALL");
      setQueue((rows ?? []).filter((r) => filter === "ALL" || ["PENDING", "REVIEW"].includes(r.kyc_status)));
    } catch (e) {
      push({ tone: "error", title: "Could not load the verification queue", body: humanError(e) });
    }
  }, [push]);

  const loadUsers = useCallback(async (q = "") => {
    try { setUsers(await admin.users(q)); } catch (e) { push({ tone: "error", title: "Could not load customers", body: humanError(e) }); }
  }, [push]);

  useEffect(() => { loadStats(); loadQueue("OPEN"); }, [loadStats, loadQueue]);
  useEffect(() => { if (tab === "kyc") loadQueue(queueFilter); }, [tab, queueFilter, loadQueue]);
  useEffect(() => { if (tab === "users") loadUsers(search); }, [tab, search, loadUsers]);

  useEffect(() => {
    if (tab === "ledger") {
      supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(80)
        .then(({ data }) => setTxs(data ?? []));
    }
    if (tab === "webhooks") {
      supabase.from("webhook_events").select("*").order("received_at", { ascending: false }).limit(50)
        .then(({ data }) => setHooks(data ?? []));
    }
    if (tab === "audit") {
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(80)
        .then(({ data }) => setAudit(data ?? []));
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
        body: decision === "VERIFIED" ? "Deposits, transfers and a funding account are unlocked." : "The customer sees your reason.",
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
            <PageHead
              title="Operations overview"
              sub="Position across wallets, savings and the verification queue. Every figure is read live from the ledger."
              actions={
                <>
                  <button className={consoleBtn.ghost} onClick={() => { loadStats(); loadQueue("OPEN"); }}>Refresh</button>
                  <button className={consoleBtn.primary} onClick={() => setTab("kyc")}>
                    Review {pendingCount} pending <ArrowRight className="h-3 w-3" />
                  </button>
                </>
              }
            />

            {stats === null ? <div className="mt-8"><Spinner /></div> : (
              <>
                <div className="console-stagger mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                  <Stat label="Wallet float" value={naira(stats.wallet_float_minor ?? 0)} sub={`${stats.users_active ?? 0} active of ${stats.users_total ?? 0} customers`} />
                  <Stat label="Savings held" value={naira(stats.savings_total_minor ?? 0)} sub="Locked in goals" />
                  <Stat label="Awaiting verification" value={String(pendingCount)} sub={`${stats.kyc_verified ?? 0} verified to date`} tone={pendingCount ? "warn" : "good"} icon={<ShieldCheck className="h-3.5 w-3.5" />} />
                  <Stat label="In flight" value={String(stats.tx_pending ?? 0)} sub={`${stats.tx_failed ?? 0} failed · ${stats.tx_successful ?? 0} settled`} tone={stats.tx_failed ? "bad" : "default"} />
                </div>

                <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[1.55fr_1fr]">
                  <Panel title="Volume, last 7 days" subtitle="Successful deposits and transfers" flush>
                    <VolumeChart rows={volume} />
                  </Panel>

                  <Panel title="Needs attention" flush>
                    <div>
                      {[
                        { label: "Verification pending", value: pendingCount, go: "kyc" as AdminTab },
                        { label: "Failed transactions", value: stats.tx_failed ?? 0, go: "ledger" as AdminTab },
                        { label: "Open support tickets", value: stats.tickets_open ?? 0, go: "users" as AdminTab },
                        { label: "Unprocessed webhooks", value: stats.webhooks_unprocessed ?? 0, go: "webhooks" as AdminTab },
                      ].map((row) => (
                        <button key={row.label} onClick={() => setTab(row.go)}
                          className="flex w-full items-center gap-3 border-b border-white/[.05] px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-white/[.025]">
                          <span className="text-[12px] text-[#C9D9D0]">{row.label}</span>
                          <span className={`ml-auto text-[12px] font-semibold tnum ${row.value ? "text-[#F0C572]" : "text-[#4E675C]"}`}>{row.value}</span>
                          <ArrowRight className="h-3 w-3 text-[#3F564C]" />
                        </button>
                      ))}
                    </div>
                  </Panel>
                </div>

                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                  <Panel title="Money in" subtitle="Successful deposits since launch" flush>
                    <div className="px-4 py-4">
                      <p className="text-[26px] font-semibold leading-none tracking-[-0.04em] tnum text-[#C9F06A]">{naira(stats.deposits_minor ?? 0)}</p>
                      <p className="mt-2 text-[10.5px] text-[#6B857A]">Settled through Monnify checkout and bank transfer</p>
                    </div>
                  </Panel>
                  <Panel title="Money out" subtitle="Successful transfers to bank accounts" flush>
                    <div className="px-4 py-4">
                      <p className="text-[26px] font-semibold leading-none tracking-[-0.04em] tnum text-[#F0C572]">{naira(stats.transfers_minor ?? 0)}</p>
                      <p className="mt-2 text-[10.5px] text-[#6B857A]">Name-enquired before every payout</p>
                    </div>
                  </Panel>
                </div>
              </>
            )}
          </>
        )}

        {tab === "kyc" && (
          <>
            <PageHead
              title="Verification"
              sub="Approving here is the only thing that unlocks deposits, transfers and a funding account. The customer is notified either way and every decision is written to the audit trail."
              actions={
                <div className="flex gap-[2px] rounded-[9px] border border-white/[.08] p-[3px]">
                  {(["OPEN", "ALL"] as const).map((f) => (
                    <button key={f} onClick={() => setQueueFilter(f)}
                      className={`rounded-[7px] px-2.5 py-1 text-[11px] font-semibold transition-colors ${queueFilter === f ? "bg-white/[.08] text-white" : "text-[#7E988C] hover:text-white"}`}>
                      {f === "OPEN" ? "Needs review" : "All submissions"}
                    </button>
                  ))}
                </div>
              }
            />

            <div className="mt-4">
              {queue === null ? <Spinner /> : queue.length === 0 ? (
                <Panel>
                  <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                    <ShieldCheck className="h-7 w-7 text-[#C9F06A]" />
                    <p className="text-[13px] font-semibold text-white">Queue clear</p>
                    <p className="max-w-sm text-[11.5px] leading-relaxed text-[#8AA398]">Nothing is waiting on a decision. Submissions appear here the moment a customer sends their BVN or NIN.</p>
                  </div>
                </Panel>
              ) : (
                <Panel flush>
                  <div className="hidden grid-cols-[minmax(0,1.5fr)_120px_120px_120px_190px] gap-3 border-b border-white/[.07] px-4 py-2 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#4E675C] lg:grid">
                    <span>Customer</span><span>Identifier</span><span>Submitted</span><span className="text-right">Wallet</span><span className="text-right">Decision</span>
                  </div>
                  {queue.map((row) => {
                    const method = row.bvn_last4 ? `BVN ····${row.bvn_last4}` : row.nin_last4 ? `NIN ····${row.nin_last4}` : "No ID";
                    const open = rejecting === row.user_id;
                    return (
                      <div key={row.user_id} className="border-b border-white/[.05] last:border-0">
                        <div className="grid items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[.02] lg:grid-cols-[minmax(0,1.5fr)_120px_120px_120px_190px]">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[.07] text-[10.5px] font-bold uppercase">
                              {row.full_name?.slice(0, 2) ?? "??"}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="truncate text-[12.5px] font-medium text-white">{row.full_name}</p>
                                <Status>{row.kyc_status.replace("_", " ")}</Status>
                              </div>
                              <p className="truncate text-[10.5px] text-[#6B857A]">{row.email} · {row.phone_number ?? "no phone"}</p>
                            </div>
                          </div>
                          <div className="text-[11.5px] text-[#9DB3A8]">
                            <span className="font-mono">{method}</span>
                            <span className="ml-1.5 text-[10px] text-[#4E675C]">L{row.verification_level ?? 0}</span>
                          </div>
                          <div className="text-[11px] text-[#7E988C]">
                            {row.submitted_at ? formatDateTime(row.submitted_at) : "—"}
                          </div>
                          <div className="text-[11.5px] text-right tnum text-[#C9D9D0]">{naira(row.available_minor)}</div>
                          <div className="flex justify-start gap-1.5 lg:justify-end">
                            <button className={consoleBtn.primary} disabled={busyId === row.user_id} onClick={() => decide(row, "VERIFIED")}>
                              <Check className="h-3 w-3" /> Approve
                            </button>
                            <button className={consoleBtn.danger} disabled={busyId === row.user_id} onClick={() => { setRejecting(row.user_id); setRejectReason(""); }}>
                              <X className="h-3 w-3" /> Reject
                            </button>
                          </div>
                        </div>
                        {row.failure_reason && !open && <p className="px-4 pb-2 text-[10.5px] text-[#F09A8B]">{row.failure_reason}</p>}
                        {open && (
                          <div className="border-t border-white/[.07] bg-black/25 px-4 py-3">
                            <label htmlFor={`reason-${row.user_id}`} className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#5F7A6E]">
                              Reason shown to the customer
                            </label>
                            <input
                              id={`reason-${row.user_id}`}
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Name on the BVN does not match the account holder"
                              className="mt-1.5 w-full rounded-[8px] border border-white/[.1] bg-[#080D0B] px-2.5 py-2 text-[12px] text-white placeholder:text-[#455C51] focus:border-[#C9F06A]/50 focus:outline-none"
                            />
                            <div className="mt-2 flex gap-1.5">
                              <button className={consoleBtn.danger} disabled={!rejectReason.trim() || busyId === row.user_id}
                                onClick={() => decide(row, "REJECTED", rejectReason.trim())}>Confirm rejection</button>
                              <button className={consoleBtn.ghost} onClick={() => setRejecting(null)}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Panel>
              )}
            </div>
          </>
        )}

        {tab === "users" && (
          <>
            <PageHead title="Customers" sub="Open a customer to freeze an account, override verification or post a ledger adjustment with a reason." />
            <div className="relative mt-4 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5F7A6E]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or phone"
                className="w-full rounded-[9px] border border-white/[.1] bg-[#0E1613] py-2 pl-8 pr-3 text-[12px] text-white placeholder:text-[#455C51] focus:border-[#C9F06A]/50 focus:outline-none" />
            </div>
            <div className="mt-3">
              <Panel flush>
                <div className="hidden grid-cols-[minmax(0,1.6fr)_140px_100px_80px_150px] gap-3 border-b border-white/[.07] px-4 py-2 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#4E675C] lg:grid">
                  <span>Customer</span><span className="text-right">Wallet</span><span className="text-right">Savings</span><span className="text-right">Activity</span><span className="text-right">State</span>
                </div>
                {users === null ? <Spinner /> : users.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[12px] text-[#7E988C]">Nobody matches that search.</p>
                ) : users.map((u) => (
                  <button key={u.id} onClick={() => setSelected(u)}
                    className="grid w-full items-center gap-3 border-b border-white/[.05] px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-white/[.025] lg:grid-cols-[minmax(0,1.6fr)_140px_100px_80px_150px]">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[.07] text-[10px] font-bold uppercase">{u.full_name?.slice(0, 2)}</span>
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-white">{u.full_name}</p>
                        <p className="truncate text-[10.5px] text-[#6B857A]">{u.email}</p>
                      </div>
                    </div>
                    <p className="text-[11.5px] text-right tnum text-[#C9D9D0]">{naira(u.available_minor)}</p>
                    <p className="text-[11.5px] text-right tnum text-[#8AA398]">{naira(u.savings_minor)}</p>
                    <p className="text-[10.5px] text-right text-[#6B857A]">{u.tx_count} tx · {u.goals_count}g</p>
                    <div className="flex justify-end gap-1.5">
                      <Status>{u.status}</Status>
                      <Status>{u.kyc_status.replace("_", " ")}</Status>
                    </div>
                  </button>
                ))}
              </Panel>
            </div>
          </>
        )}

        {tab === "ledger" && (
          <>
            <PageHead title="Ledger" sub="Newest 80 movements platform-wide. Nothing is edited in place: corrections are posted as new entries." />
            <div className="mt-4">
              <Panel flush>
                <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_100px_140px] gap-3 border-b border-white/[.07] px-4 py-2 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#4E675C] lg:grid">
                  <span>Narration</span><span>Reference</span><span className="text-right">Amount</span><span className="text-right">State</span><span className="text-right">Posted</span>
                </div>
                {txs === null ? <Spinner /> : txs.length === 0 ? <p className="px-4 py-8 text-center text-[12px] text-[#7E988C]">No transactions yet.</p> : txs.map((t) => (
                  <div key={t.id} className="grid items-center gap-3 border-b border-white/[.05] px-4 py-2.5 transition-colors last:border-0 hover:bg-white/[.025] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_100px_140px]">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${String(t.type).includes("TRANSFER") ? "bg-[#F0C572]" : "bg-[#C9F06A]"}`} />
                      <p className="truncate text-[12px] text-[#DCE8E1]">{t.narration ?? titleCase(t.type)}</p>
                    </div>
                    <p className="truncate font-mono text-[10px] text-[#5F7A6E]">{t.client_reference}</p>
                    <p className="text-[11.5px] text-right font-semibold tnum text-white">{naira(t.amount_minor)}</p>
                    <div className="flex justify-end"><Status>{t.status}</Status></div>
                    <p className="text-[10.5px] text-right text-[#6B857A]">{formatDateTime(t.created_at)}</p>
                  </div>
                ))}
              </Panel>
            </div>
          </>
        )}

        {tab === "webhooks" && (
          <>
            <PageHead title="Webhooks" sub="Signed Monnify callbacks. A processed event means the provider and our ledger agree." />
            <div className="mt-4">
              <Panel flush>
                {hooks === null ? <Spinner /> : hooks.length === 0 ? (
                  <p className="px-4 py-10 text-center text-[12px] text-[#7E988C]">No events received yet. Point the Monnify dashboard webhook at the monnify-webhook function.</p>
                ) : hooks.map((h) => (
                  <div key={h.id} className="border-b border-white/[.05] px-4 py-2.5 last:border-0 transition-colors hover:bg-white/[.025]">
                    <div className="flex items-center gap-3">
                      <p className="truncate text-[12px] font-medium text-[#DCE8E1]">{h.provider} · {h.event_type}</p>
                      <div className="ml-auto flex items-center gap-2">
                        <span className={`text-[9.5px] uppercase tracking-[0.08em] ${h.signature_valid ? "text-[#C9F06A]" : "text-[#F09A8B]"}`}>
                          {h.signature_valid ? "signed" : "unsigned"}
                        </span>
                        <Status>{h.status}</Status>
                      </div>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-[#4E675C]">{h.event_id}</p>
                    {h.error && <p className="mt-0.5 text-[10.5px] text-[#F09A8B]">{h.error}</p>}
                    <p className="text-[10px] text-[#6B857A]">{formatDateTime(h.received_at)}</p>
                  </div>
                ))}
              </Panel>
            </div>
          </>
        )}

        {tab === "audit" && (
          <>
            <PageHead title="Audit trail" sub="Every privileged action, written server-side with the operator id attached. This is the record you keep." />
            <div className="mt-4">
              <Panel flush>
                <div className="hidden grid-cols-[160px_60px_minmax(0,1fr)_minmax(0,1fr)_140px] gap-3 border-b border-white/[.07] px-4 py-2 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#4E675C] lg:grid">
                  <span>Action</span><span>Actor</span><span>Entity</span><span>Reference</span><span className="text-right">When</span>
                </div>
                {audit === null ? <Spinner /> : audit.length === 0 ? <p className="px-4 py-10 text-center text-[12px] text-[#7E988C]">No audit entries yet.</p> : audit.map((a) => (
                  <div key={a.id} className="grid items-center gap-3 border-b border-white/[.05] px-4 py-2.5 transition-colors last:border-0 hover:bg-white/[.025] lg:grid-cols-[160px_60px_minmax(0,1fr)_minmax(0,1fr)_140px]">
                    <div className="flex items-center gap-1.5">
                      <FileClock className="h-3 w-3 shrink-0 text-[#4E675C]" />
                      <p className="truncate text-[11px] font-medium text-[#DCE8E1]">{a.action}</p>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.06em] text-[#6B857A]">{a.actor_type}</p>
                    <p className="truncate text-[11px] text-[#9DB3A8]">{a.entity_type}</p>
                    <p className="truncate font-mono text-[10px] text-[#4E675C]">{a.entity_id ?? "—"}</p>
                    <p className="text-[10.5px] text-right text-[#6B857A]">{formatDateTime(a.created_at)}</p>
                  </div>
                ))}
              </Panel>
            </div>
          </>
        )}

        {tab === "settings" && (
          <>
            <PageHead title="Platform settings" sub="Amounts are in minor units (kobo). Turning demo_mode off requires live Monnify keys, otherwise payments fail." />
            <div className="mt-4 max-w-3xl">
              <Panel>
                <textarea
                  value={settings}
                  onChange={(e) => setSettings(e.target.value)}
                  rows={16}
                  spellCheck={false}
                  className="w-full rounded-[9px] border border-white/[.1] bg-[#080D0B] p-3 font-mono text-[11px] leading-relaxed text-[#D5E4DC] focus:border-[#C9F06A]/50 focus:outline-none"
                />
                <div className="mt-3 flex gap-1.5">
                  <button className={consoleBtn.primary} onClick={saveSettings}>Save settings</button>
                  <button className={consoleBtn.ghost} onClick={loadStats}>Discard changes</button>
                </div>
              </Panel>
            </div>
          </>
        )}
      </div>

      {selected && <PersonSheet user={selected} onClose={() => setSelected(null)} onDone={() => { setSelected(null); loadUsers(search); loadStats(); }} />}
    </AdminShell>
  );
}

/* ── volume chart (real ledger data) ────────────────────────────────────── */

function VolumeChart({ rows }: { rows: VolumeRow[] | null }) {
  if (!rows) return <div className="px-4 py-10"><Spinner /></div>;
  const peak = Math.max(1, ...rows.map((r) => r.deposits_minor + r.transfers_minor));
  const total = rows.reduce((sum, r) => sum + r.deposits_minor + r.transfers_minor, 0);
  const busiest = rows.reduce((best, r) => (r.deposits_minor + r.transfers_minor > best.deposits_minor + best.transfers_minor ? r : best), rows[0]);

  return (
    <div className="px-4 pb-4 pt-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#6B857A]">Total volume</p>
          <p className="mt-1 text-[20px] font-semibold leading-none tracking-[-0.03em] tnum text-white">{naira(total)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#6B857A]">Busiest day</p>
          <p className="mt-1 text-[11.5px] font-medium text-[#C9D9D0]">{busiest ? new Date(busiest.day).toLocaleDateString("en-NG", { weekday: "short", day: "numeric" }) : "—"}</p>
        </div>
      </div>

      <div className="mt-4 flex h-[104px] items-end gap-1.5">
        {rows.map((r) => {
          const depositH = (r.deposits_minor / peak) * 100;
          const transferH = (r.transfers_minor / peak) * 100;
          return (
            <div key={r.day} className="group relative flex h-full flex-1 flex-col justify-end gap-[2px]">
              <div className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[6px] border border-white/10 bg-[#050A08] px-2 py-1 text-[10px] text-[#DCE8E1] shadow-xl group-hover:block">
                {new Date(r.day).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} · {num(r.deposits_minor + r.transfers_minor)} · {r.tx_count} tx
              </div>
              <div className="w-full rounded-t-[2px] bg-[#C9F06A] transition-all duration-500" style={{ height: `${Math.max(depositH, 1.5)}%` }} />
              <div className="w-full rounded-b-[2px] bg-[#F0C572]/70 transition-all duration-500" style={{ height: `${Math.max(transferH, r.transfers_minor ? 1.5 : 0)}%` }} />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[9.5px] uppercase tracking-[0.1em] text-[#6B857A]">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-sm bg-[#C9F06A]" /> Deposits</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-sm bg-[#F0C572]" /> Transfers</span>
        </div>
        <span className="text-[9.5px] uppercase tracking-[0.1em] text-[#3F564C]">Last 7 days</span>
      </div>
    </div>
  );
}

/* ── customer sheet ─────────────────────────────────────────────────────── */

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
        push({ tone: "success", title: `Verification set to ${decision}` });
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
          <div className="mt-1.5 flex gap-1.5"><Status>{user.status}</Status><Status>{user.kyc_status}</Status></div>
        </div>

        <div className="flex gap-1 rounded-full border border-[var(--color-line)] p-1">
          {([["freeze", "Status"], ["kyc", "Verification"], ["adjust", "Adjust"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setMode(k as typeof mode)}
              className={`flex-1 rounded-full px-3 py-1.5 text-[12px] font-medium ${mode === k ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-ink-soft)]"}`}>
              {label}
            </button>
          ))}
        </div>

        {mode === "kyc" && (
          <Field label="Verification decision">
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
          className={`${mode === "freeze" && user.status !== "FROZEN" ? consoleBtn.danger : consoleBtn.primary} w-full py-2.5`}>
          {busy ? "Working" : mode === "freeze" ? (user.status === "FROZEN" ? "Unfreeze account" : "Freeze account")
            : mode === "kyc" ? `Set verification to ${decision}` : `Post ${direction.toLowerCase()} adjustment`}
        </button>
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--color-ink-soft)]">
          <Clock3 className="mt-[2px] h-3 w-3 shrink-0" />
          Every action here is recorded in the audit trail with your operator id. Adjustments create a ledger entry; no balance is edited directly.
        </p>
      </div>
    </Modal>
  );
}
