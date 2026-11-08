import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PiggyBank, Plus } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, useToast } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { actions, getGoals } from "../../lib/api";
import { humanError } from "../../lib/errors";
import { naira, progressPct, formatDate } from "../../lib/format";
import type { SavingsGoal } from "../../lib/types";

const emojis = ["🎯", "💻", "🏠", "📚", "✈️", "🎓", "🚌", "🍲"];

export default function Savings() {
  const { wallet, refresh } = useAuth();
  const [goals, setGoals] = useState<SavingsGoal[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", target: "", date: "", policy: "FLEXIBLE", emoji: "🎯" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();

  async function load() {
    try { setGoals(await getGoals()); } catch { setGoals([]); }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setError(null);
    setBusy(true);
    try {
      await actions.createGoal(
        form.name,
        Math.round(Number(form.target.replace(/[^0-9.]/g, "") || 0) * 100),
        form.date || null,
        form.policy,
        form.emoji,
      );
      push({ tone: "success", title: "Goal created" });
      setOpen(false);
      setForm({ name: "", target: "", date: "", policy: "FLEXIBLE", emoji: "🎯" });
      await load();
      await refresh();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  const active = (goals ?? []).filter((g) => g.status !== "CLOSED");
  const totalSaved = active.reduce((s, g) => s + g.current_amount_minor, 0);

  return (
    <AppShell>
      <div className="rise">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[24px] tracking-[-0.02em]">Savings goals</h1>
            <p className="mt-1 text-[13.5px] text-[var(--color-ink-soft)]">
              {naira(totalSaved)} set aside across {active.length} goal{active.length === 1 ? "" : "s"} · not interest-bearing
            </p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New goal</Button>
        </div>

        {goals === null ? (
          <Spinner />
        ) : active.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={<PiggyBank className="h-6 w-6" />}
              title="No goals yet"
              body="Name the thing you are saving for, set a target, and move a little in whenever you can."
              action={<Button size="sm" onClick={() => setOpen(true)}>Create your first goal</Button>}
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {active.map((g) => {
              const pct = progressPct(g.current_amount_minor, g.target_amount_minor);
              return (
                <Link key={g.id} to={`/savings/${g.id}`} className="group">
                  <Card className="h-full p-5 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-sm">
                    <div className="flex items-start justify-between">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-paper)] text-[18px]">{g.emoji ?? "🎯"}</span>
                      <Badge tone={g.status}>{g.status}</Badge>
                    </div>
                    <p className="mt-3 text-[15px] font-semibold">{g.name}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--color-ink-soft)]">
                      {g.target_date ? `Target ${formatDate(g.target_date)}` : "No target date"} · {g.withdrawal_policy.toLowerCase().replace("_", " ")}
                    </p>
                    <p className="mt-3 text-[19px] font-semibold tracking-[-0.02em] tnum">
                      {naira(g.current_amount_minor)}
                      <span className="ml-1 text-[12px] font-normal text-[var(--color-ink-soft)]">of {naira(g.target_amount_minor)}</span>
                    </p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-paper)]">
                      <div className="h-full rounded-full bg-[var(--color-brand)] transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1.5 text-[11.5px] font-medium text-[var(--color-brand-dark)]">{pct}% funded</p>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="New savings goal"
          footer={<><Button variant="secondary" block onClick={() => setOpen(false)}>Cancel</Button><Button block loading={busy} onClick={create} disabled={!form.name || !form.target}>Create goal</Button></>}
        >
          <div className="space-y-4">
            <Field label="What are you saving for?" htmlFor="name">
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Laptop" maxLength={40} />
            </Field>
            <Field label="Icon">
              <div className="flex flex-wrap gap-1.5">
                {emojis.map((e) => (
                  <button key={e} onClick={() => setForm({ ...form, emoji: e })}
                    className={`grid h-9 w-9 place-items-center rounded-xl border text-[16px] ${form.emoji === e ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]" : "border-[var(--color-line)]"}`}>
                    {e}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Target amount" htmlFor="target" hint={`Available to allocate now: ${naira(wallet?.available_minor)}`}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-ink-soft)]">₦</span>
                <Input id="target" inputMode="decimal" className="pl-7 tnum" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="150000" />
              </div>
            </Field>
            <Field label="Target date" hint="Optional">
              <Input type="date" value={form.date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Withdrawal policy" hint="Locked and date-locked goals cannot be released early">
              <Select value={form.policy} onChange={(e) => setForm({ ...form, policy: e.target.value })}>
                <option value="FLEXIBLE">Flexible — withdraw any time</option>
                <option value="TARGET_DATE">Date-locked — unlock on the target date</option>
                <option value="LOCKED">Locked — no withdrawals until you unlock it</option>
              </Select>
            </Field>
            {error && <p className="rounded-lg bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[var(--color-danger)]">{error}</p>}
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
