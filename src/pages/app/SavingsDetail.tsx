import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Lock, Pause, Play, Plus, Trash2 } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Spinner, useToast } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { actions, getGoal, getGoalTransactions } from "../../lib/api";
import { humanError } from "../../lib/errors";
import { formatDate, formatDateTime, naira, progressPct, titleCase, toMinor } from "../../lib/format";
import type { SavingsGoal, Transaction } from "../../lib/types";

export default function SavingsDetail() {
  const { id = "" } = useParams();
  const { wallet, refresh } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [goal, setGoal] = useState<SavingsGoal | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [mode, setMode] = useState<"contribute" | "withdraw" | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setGoal(await getGoal(id));
      setTxs(await getGoalTransactions(id));
    } catch {
      setGoal(null);
    }
  }
  useEffect(() => { load(); }, [id]);

  async function submit() {
    if (!goal) return;
    setError(null);
    setBusy(true);
    try {
      const minor = toMinor(amount);
      if (mode === "contribute") await actions.contribute(goal.id, minor);
      else await actions.withdraw(goal.id, minor);
      push({ tone: "success", title: mode === "contribute" ? "Added to goal" : "Moved to wallet" });
      setMode(null);
      setAmount("");
      await load();
      await refresh();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  async function togglePause() {
    if (!goal) return;
    try {
      await actions.setGoalStatus(goal.id, goal.status === "PAUSED" ? "ACTIVE" : "PAUSED");
      push({ tone: "success", title: goal.status === "PAUSED" ? "Goal resumed" : "Goal paused" });
      await load();
    } catch (err) {
      push({ tone: "error", title: "Could not update", body: humanError(err) });
    }
  }

  async function closeGoal() {
    if (!goal) return;
    try {
      await actions.setGoalStatus(goal.id, "CLOSED");
      push({ tone: "success", title: "Goal closed", body: goal.current_amount_minor ? "Balance returned to your wallet." : undefined });
      await refresh();
      navigate("/savings");
    } catch (err) {
      push({ tone: "error", title: "Could not close", body: humanError(err) });
    }
  }

  if (!goal) return <AppShell><Spinner /></AppShell>;

  const pct = progressPct(goal.current_amount_minor, goal.target_amount_minor);
  const locked = goal.withdrawal_policy !== "FLEXIBLE" && (goal.withdrawal_policy === "LOCKED" || (goal.target_date ? new Date(goal.target_date) > new Date() : false));

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl rise">
        <Link to="/savings" className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--color-ink-soft)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Savings
        </Link>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[22px] ring-1 ring-[var(--color-line)]">{goal.emoji ?? "🎯"}</span>
            <div>
              <h1 className="text-[22px] leading-tight tracking-[-0.02em]">{goal.name}</h1>
              <p className="text-[12.5px] text-[var(--color-ink-soft)]">
                {titleCase(goal.withdrawal_policy)} · {goal.target_date ? `unlocks ${formatDate(goal.target_date)}` : "no target date"}
              </p>
            </div>
          </div>
          <Badge tone={goal.status}>{goal.status}</Badge>
        </div>

        <Card className="mt-5 p-5">
          <p className="text-[32px] font-semibold leading-none tracking-[-0.03em] tnum">{naira(goal.current_amount_minor)}</p>
          <p className="mt-1 text-[12.5px] text-[var(--color-ink-soft)]">of {naira(goal.target_amount_minor)} target · {pct}% funded</p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--color-paper)]">
            <div className="h-full rounded-full bg-[var(--color-brand)] transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-[12px] text-[var(--color-ink-soft)]">
            {naira(Math.max(0, goal.target_amount_minor - goal.current_amount_minor))} to go
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { setMode("contribute"); setAmount(""); setError(null); }} disabled={goal.status === "CLOSED"}>
              <Plus className="h-3.5 w-3.5" /> Add money
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setMode("withdraw"); setAmount(""); setError(null); }} disabled={locked || goal.current_amount_minor === 0}>
              {locked ? <><Lock className="h-3.5 w-3.5" /> Locked</> : "Withdraw"}
            </Button>
            <Button size="sm" variant="ghost" onClick={togglePause} disabled={goal.status === "CLOSED"}>
              {goal.status === "PAUSED" ? <><Play className="h-3.5 w-3.5" /> Resume</> : <><Pause className="h-3.5 w-3.5" /> Pause</>}
            </Button>
          </div>

          {locked && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--color-paper)] p-3 text-[11.5px] text-[var(--color-ink-soft)]">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              This goal cannot release funds yet. You can still keep adding to it, or close it and move the balance back to your wallet.
            </p>
          )}
        </Card>

        <div className="mt-4">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Goal activity</p>
          <Card className="divide-y divide-[var(--color-line)]">
            {txs.length === 0 ? (
              <div className="p-2"><EmptyState title="No movement yet" body="Contributions to this goal will show here." /></div>
            ) : txs.map((t) => {
              const out = /withdraw|releas|closed/i.test(t.narration ?? "");
              return (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-[13px] font-medium">{t.narration ?? titleCase(t.type)}</p>
                    <p className="text-[11.5px] text-[var(--color-ink-soft)]">{formatDateTime(t.created_at)} · {t.client_reference}</p>
                  </div>
                  <p className={`text-[13px] font-semibold tnum ${out ? "text-[var(--color-brand-dark)]" : ""}`}>
                    {out ? "+" : "−"}{naira(t.amount_minor)}
                  </p>
                </div>
              );
            })}
          </Card>
        </div>

        {goal.status !== "CLOSED" && (
          <button onClick={closeGoal} className="mt-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-danger)]">
            <Trash2 className="h-3.5 w-3.5" /> Close goal{goal.current_amount_minor ? " and return balance to wallet" : ""}
          </button>
        )}

        <Modal
          open={mode !== null}
          onClose={() => setMode(null)}
          title={mode === "contribute" ? "Add to this goal" : "Move back to wallet"}
          footer={<><Button variant="secondary" block onClick={() => setMode(null)}>Cancel</Button><Button block loading={busy} onClick={submit} disabled={!amount}>{mode === "contribute" ? "Add" : "Withdraw"}</Button></>}
        >
          <Field
            label="Amount"
            htmlFor="goal-amount"
            hint={mode === "contribute" ? `Available in wallet: ${naira(wallet?.available_minor)}` : `In this goal: ${naira(goal.current_amount_minor)}`}
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-ink-soft)]">₦</span>
              <Input id="goal-amount" inputMode="decimal" className="pl-7 text-[17px] font-semibold tnum" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
          </Field>
          {error && <p className="mt-3 rounded-lg bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[var(--color-danger)]">{error}</p>}
          <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--color-ink-soft)]">
            Savings goals are an allocation inside your own wallet. No interest is paid and no investment is made.
          </p>
        </Modal>
      </div>
    </AppShell>
  );
}
