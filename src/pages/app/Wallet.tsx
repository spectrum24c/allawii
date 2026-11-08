import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Copy, CreditCard, RefreshCw, ShieldAlert } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge, Button, Card, EmptyState, SectionTitle, Spinner, useToast } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { actions, getFundingAccount } from "../../lib/api";
import { humanError } from "../../lib/errors";
import { naira, formatDateTime, titleCase } from "../../lib/format";
import { supabase } from "../../lib/supabase";
import type { FundingAccount } from "../../lib/types";

export default function WalletPage() {
  const { profile, wallet, kyc, limits, refresh } = useAuth();
  const [account, setAccount] = useState<FundingAccount | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ledger, setLedger] = useState<Array<{ id: string; entry_type: string; direction: string; amount_minor: number; balance_after_minor: number; created_at: string; description: string | null }> | null>(null);
  const { push } = useToast();

  // The holder of a reserved account is the customer. The bank-facing label
  // Monnify generates in sandbox is never shown as their name.
  const accountHolder = (profile?.full_name ?? "").trim() || account?.account_name || "";

  async function load() {
    setLoadingAccount(true);
    try {
      setAccount(await getFundingAccount());
    } catch {
      setAccount(null);
    } finally {
      setLoadingAccount(false);
    }
    const { data } = await supabase
      .from("ledger_entries")
      .select("id, entry_type, direction, amount_minor, balance_after_minor, created_at, description")
      .order("created_at", { ascending: false })
      .limit(12);
    setLedger(data ?? []);
  }

  useEffect(() => { load(); }, []);

  async function provision() {
    setBusy(true);
    setError(null);
    try {
      const res = await actions.provisionFundingAccount();
      if (res.mode === "demo") {
        push({ tone: "info", title: "No live keys yet", body: res.message });
      } else {
        push({ tone: "success", title: "Funding account ready" });
      }
      await load();
      await refresh();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  function copy(value: string) {
    navigator.clipboard?.writeText(value).then(
      () => push({ tone: "success", title: "Copied" }),
      () => push({ tone: "error", title: "Could not copy" }),
    );
  }

  return (
    <AppShell>
      <div className="rise">
        <h1 className="text-[24px] tracking-[-0.02em]">Wallet</h1>
        <p className="mt-1 text-[13.5px] text-[var(--color-ink-soft)]">Your balance, your funding account, and the ledger behind both.</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Available", value: wallet?.available_minor ?? 0, tone: "bg-[#0b1411] text-white" },
            { label: "Savings", value: wallet?.savings_minor ?? 0, tone: "bg-white" },
            { label: "Pending", value: wallet?.pending_minor ?? 0, tone: "bg-white" },
          ].map((s) => (
            <div key={s.label} className={`rounded-[var(--radius-card)] border border-[var(--color-line)] p-4 ${s.tone}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wide ${s.label === "Available" ? "text-white/60" : "text-[var(--color-ink-soft)]"}`}>{s.label}</p>
              <p className="mt-1 text-[22px] font-semibold tracking-[-0.02em] tnum">{naira(s.value)}</p>
            </div>
          ))}
        </div>

        {/* funding account */}
        <div className="mt-5">
          <SectionTitle title="Funding account" subtitle="Transfer from any bank app into this account" />
          <Card className="p-5">
            {loadingAccount ? (
              <Spinner label="" />
            ) : account?.status === "ACTIVE" && account.account_number ? (
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[20px] font-semibold tracking-[0.02em] tnum">{account.account_number}</p>
                    <button onClick={() => copy(account.account_number!)} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Copy account number">
                      <Copy className="h-3.5 w-3.5 text-[var(--color-ink-soft)]" />
                    </button>
                  </div>
                  <p className="mt-1 text-[13px] text-[var(--color-ink-soft)]">
                    {account.bank_name} · <span className="font-semibold text-[var(--color-ink)]">{accountHolder}</span>
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-ink-faint)]">
                    Send from any bank app to this number. Reserved-account labels are shortened inside Monnify's sandbox;
                    a live account carries the holder's full name.
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-[var(--color-ink-soft)]/80">{account.account_reference}</p>
                </div>
                <Badge tone="VERIFIED">Active</Badge>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-md">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[var(--color-ink-soft)]" />
                    <p className="text-[13.5px] font-semibold">
                      {account?.status === "PENDING" ? "Account creation in progress" : account?.status === "FAILED" ? "Account creation failed" : "No funding account yet"}
                    </p>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-ink-soft)]">
                    {account?.failure_reason ??
                      "A dedicated account number lets you fund your wallet with a normal bank transfer. It requires a verified identity check."}
                  </p>
                  {error && <p className="mt-2 text-[12px] text-[var(--color-danger)]">{error}</p>}
                </div>
                <Button size="sm" loading={busy} onClick={provision} disabled={kyc?.kyc_status !== "VERIFIED"}>
                  {account?.status === "FAILED" ? "Retry" : "Request account"}
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* actions + limits */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Card className="p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Quick actions</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/deposit"><Button size="sm"><CreditCard className="h-4 w-4" /> Add money</Button></Link>
              <Link to="/transfer"><Button size="sm" variant="secondary">Send money</Button></Link>
              <button onClick={() => { load(); refresh(); }} className="inline-flex items-center gap-1.5 rounded-full px-3 text-[12.5px] text-[var(--color-ink-soft)] hover:bg-black/5">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
          </Card>
          <Card className="p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Your limits</p>
            <dl className="mt-3 space-y-1.5 text-[12.5px]">
              {[
                ["Per transfer", naira(limits?.max_transfer_minor)],
                ["Daily transfer total", naira(limits?.daily_transfer_minor)],
                ["Transfer fee", limits?.transfer_fee_minor ? naira(limits.transfer_fee_minor) : "Free"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between"><dt className="text-[var(--color-ink-soft)]">{k}</dt><dd className="font-medium tnum">{v}</dd></div>
              ))}
            </dl>
            <Link to="/fees" className="mt-3 inline-block text-[12px] font-semibold text-[var(--color-brand-dark)]">Full fee schedule →</Link>
          </Card>
        </div>

        {/* ledger */}
        <div className="mt-6">
          <SectionTitle title="Wallet statement" subtitle="Every posted ledger entry, newest first" />
          <Card className="overflow-hidden">
            {ledger === null ? (
              <Spinner />
            ) : ledger.length === 0 ? (
              <div className="p-2">
                <EmptyState icon={<ShieldAlert className="h-5 w-5" />} title="No ledger entries yet" body="Fund your wallet and your first entry will appear here." />
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-line)]">
                {ledger.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{e.description ?? titleCase(e.entry_type)}</p>
                      <p className="text-[11.5px] text-[var(--color-ink-soft)]">{titleCase(e.entry_type)} · {formatDateTime(e.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-[13px] font-semibold tnum ${e.direction === "CREDIT" ? "text-[var(--color-brand-dark)]" : ""}`}>
                        {e.direction === "CREDIT" ? "+" : "−"}{naira(e.amount_minor)}
                      </p>
                      <p className="text-[11px] tnum text-[var(--color-ink-soft)]">bal {naira(e.balance_after_minor)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
