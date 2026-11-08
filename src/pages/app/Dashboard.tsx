import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Banknote, ArrowRight, PiggyBank, Plus, Receipt, Sparkles } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge, Button, Card, EmptyState, SectionTitle, Spinner } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { getGoals, getTransactions } from "../../lib/api";
import { naira, progressPct, timeAgo, titleCase } from "../../lib/format";
import type { SavingsGoal, Transaction } from "../../lib/types";

export default function Dashboard() {
  const { profile, wallet, kyc, limits } = useAuth();
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const [goals, setGoals] = useState<SavingsGoal[] | null>(null);

  useEffect(() => {
    getTransactions({ limit: 5 }).then(setTxs).catch(() => setTxs([]));
    getGoals().then((g) => setGoals(g.filter((x) => x.status !== "CLOSED").slice(0, 3))).catch(() => setGoals([]));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <AppShell>
      <div className="rise">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[13px] text-[var(--color-ink-soft)]">{greeting},</p>
            <h1 className="text-[26px] leading-tight tracking-[-0.02em]">{firstName}</h1>
          </div>
          <Link to="/deposit"><Button size="sm"><Plus className="h-4 w-4" /> Add money</Button></Link>
        </div>

        {/* balance */}
        <div className="mt-5 grid gap-3 lg:grid-cols-[1.35fr_1fr]">
          <div className="relative overflow-hidden rounded-[22px] bg-[#0b1411] p-5 text-white sm:p-6">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--color-brand)]/30 blur-3xl" />
            <div className="relative">
              <p className="text-[11.5px] font-medium uppercase tracking-widest text-white/60">Available balance</p>
              <p className="mt-1.5 text-[34px] font-semibold leading-none tracking-[-0.03em] tnum sm:text-[40px]">
                {naira(wallet?.available_minor)}
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  { label: "Savings", value: naira(wallet?.savings_minor), to: "/savings" },
                  { label: "Pending", value: naira(wallet?.pending_minor), to: "/transactions" },
                  { label: "Money in", value: naira(wallet?.total_credited_minor), to: "/transactions" },
                ].map((s) => (
                  <Link key={s.label} to={s.to} className="rounded-xl bg-white/[.07] px-2.5 py-2 transition-colors hover:bg-white/[.11]">
                    <p className="text-[10.5px] uppercase tracking-wide text-white/55">{s.label}</p>
                    <p className="mt-0.5 truncate text-[13px] font-semibold tnum">{s.value}</p>
                  </Link>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/deposit"><Button size="sm" variant="lime">Add money</Button></Link>
                <Link to="/transfer"><Button size="sm" variant="secondary" className="bg-white/10 text-white border-white/15 hover:bg-white/15">Send money</Button></Link>
              </div>
            </div>
          </div>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Savings goals</p>
              <Link to="/savings" className="text-[12px] font-semibold text-[var(--color-brand-dark)]">All</Link>
            </div>
            {goals === null ? (
              <Spinner label="" />
            ) : goals.length === 0 ? (
              <div className="py-3">
                <p className="text-[13px] text-[var(--color-ink-soft)]">No goals yet. Set one so the money stops disappearing.</p>
                <Link to="/savings"><Button size="sm" variant="secondary" className="mt-3">Create a goal</Button></Link>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {goals.map((g) => {
                  const pct = progressPct(g.current_amount_minor, g.target_amount_minor);
                  return (
                    <Link key={g.id} to={`/savings/${g.id}`} className="block">
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="font-medium">{g.emoji ?? "🎯"} {g.name}</span>
                        <span className="tnum text-[var(--color-ink-soft)]">{pct}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-paper)]">
                        <div className="h-full rounded-full bg-[var(--color-brand)] transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {limits?.demo_mode && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[#dbe7ff] bg-[#f2f6ff] px-4 py-2.5 text-[12.5px] text-[#1e40af]">
            <Sparkles className="h-3.5 w-3.5" />
            <span><strong className="font-semibold">Demo mode.</strong> Top-ups and transfers are simulated until live payment keys are added. Nothing here moves real money.</span>
          </div>
        )}

        {/* quick actions */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { to: "/deposit", label: "Add money", icon: Banknote, hint: "Card or demo" },
            { to: "/transfer", label: "Send money", icon: ArrowUpRight, hint: "To any bank" },
            { to: "/savings", label: "New goal", icon: PiggyBank, hint: "Save on purpose" },
            { to: "/transactions", label: "History", icon: Receipt, hint: "Receipts" },
          ].map(({ to, label, icon: Icon, hint }) => (
            <Link key={to} to={to} className="rounded-2xl border border-[var(--color-line)] bg-white p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-sm">
              <Icon className="h-4 w-4 text-[var(--color-brand-dark)]" />
              <p className="mt-2 text-[13px] font-semibold">{label}</p>
              <p className="text-[11.5px] text-[var(--color-ink-soft)]">{hint}</p>
            </Link>
          ))}
        </div>

        {/* kyc */}
        {kyc?.kyc_status !== "VERIFIED" && (
          <div className="mt-5 flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-white p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-brand-soft)]">
              <Receipt className="h-4 w-4 text-[var(--color-brand-dark)]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold">Finish your identity check</p>
              <p className="text-[12.5px] text-[var(--color-ink-soft)]">Deposits and transfers stay locked until your BVN or NIN is verified.</p>
            </div>
            <Link to="/kyc"><Button size="sm" variant="secondary">Continue <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
          </div>
        )}

        {/* recent activity */}
        <div className="mt-6">
          <SectionTitle
            title="Recent activity"
            subtitle="Your last five movements"
            action={<Link to="/transactions" className="text-[12.5px] font-semibold text-[var(--color-brand-dark)]">See all</Link>}
          />
          <Card className="divide-y divide-[var(--color-line)]">
            {txs === null ? (
              <Spinner />
            ) : txs.length === 0 ? (
              <div className="p-2">
                <EmptyState
                  icon={<Receipt className="h-5 w-5" />}
                  title="Nothing has moved yet"
                  body="Add money to your wallet or create a savings goal to get started."
                  action={<Link to="/deposit"><Button size="sm">Add money</Button></Link>}
                />
              </div>
            ) : (
              txs.map((t) => <TxRow key={t.id} tx={t} />)
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

export function TxRow({ tx }: { tx: Transaction }) {
  const credit = ["DEPOSIT", "REVERSAL", "REFUND"].includes(tx.type) || (tx.type === "SAVINGS" && /withdraw|releas|closed/i.test(tx.narration ?? ""));
  return (
    <Link to={`/transactions/${tx.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[#fafaf7]">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${credit ? "bg-[var(--color-brand-soft)]" : "bg-[#f1f1ec]"}`}>
        {credit ? <ArrowDownLeft className="h-4 w-4 text-[var(--color-brand-dark)]" /> : <ArrowUpRight className="h-4 w-4 text-[var(--color-ink-soft)]" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium">
          {tx.narration ?? titleCase(tx.type)}
        </p>
        <p className="text-[11.5px] text-[var(--color-ink-soft)]">
          {titleCase(tx.type)} · {timeAgo(tx.created_at)}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-[13.5px] font-semibold tnum ${credit ? "text-[var(--color-brand-dark)]" : ""}`}>
          {credit ? "+" : "−"}{naira(tx.amount_minor)}
        </p>
        <Badge tone={tx.status} className="mt-0.5">{tx.status}</Badge>
      </div>
    </Link>
  );
}
