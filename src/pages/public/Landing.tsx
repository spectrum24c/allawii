import { Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Banknote, Check, Lock, MessageCircle,
  PiggyBank, Receipt, ShieldCheck, Smartphone, Sparkles, Wallet,
} from "lucide-react";
import { PublicLayout } from "../../components/layout/PublicLayout";
import { Button, Card } from "../../components/ui";

const steps = [
  { n: "01", title: "Create your account", body: "Email, phone, and a quick identity check. No paperwork, no branch visit." },
  { n: "02", title: "Fund your wallet", body: "Get a dedicated account number, or top up with card. Balance lands in your Allawii wallet." },
  { n: "03", title: "Save and send", body: "Split money into goals, then send to any Nigerian bank with a verified account name." },
];

const features = [
  { icon: Wallet, title: "One wallet, clear balance", body: "Available, pending and savings balances are separated so you always know what you can actually spend." },
  { icon: PiggyBank, title: "Goals that hold you to it", body: "Create 'Laptop', 'Rent', 'Exam fees'. Lock the goal until a date, or keep it flexible." },
  { icon: BadgeCheck, title: "Verified recipients", body: "Name enquiry before you send, so money never goes to the wrong account." },
  { icon: Receipt, title: "Receipts and history", body: "Every movement has a reference, a status trail and a receipt you can screenshot." },
  { icon: MessageCircle, title: "WhatsApp balance checks", body: "Link your number and check balance or goal progress from chat. Transfers still need the app." },
  { icon: ShieldCheck, title: "Built around your data", body: "Your BVN is never stored in full and never returned to the browser. Session and PIN protected." },
];

export default function Landing() {
  return (
    <PublicLayout>
      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-[var(--color-brand)]/8 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-[360px] w-[360px] rounded-full bg-[var(--color-lime)]/25 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-14 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pb-24 lg:pt-20">
          <div className="rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--color-ink-soft)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--color-brand)]" />
              Student wallet and savings goals
            </span>
            <h1 className="mt-5 text-[2.6rem] leading-[1.04] tracking-[-0.03em] sm:text-6xl">
              Money that finally
              <br />
              <span className="font-[family-name:var(--font-display)] italic text-[var(--color-brand)]">makes sense</span> for school.
            </h1>
            <p className="mt-5 max-w-[520px] text-[15.5px] leading-relaxed text-[var(--color-ink-soft)]">
              Allowance comes in, then disappears. Allawii gives students one wallet for deposits, transfers and
              savings goals, so the money for rent is still there when rent is due.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/signup"><Button size="lg">Create your account <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="/how-it-works"><Button size="lg" variant="secondary">See how it works</Button></Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-[var(--color-ink-soft)]">
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[var(--color-brand)]" /> No monthly fee</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[var(--color-brand)]" /> Name-verified transfers</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[var(--color-brand)]" /> Not a bank. Not credit.</span>
            </div>
          </div>

          {/* product card */}
          <div className="relative mx-auto w-full max-w-[420px]">
            <div className="rounded-[28px] border border-[var(--color-line)] bg-white p-5 shadow-[0_30px_60px_-30px_rgba(11,20,17,.35)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Available balance</p>
                  <p className="mt-1 text-[32px] font-semibold tracking-[-0.03em] tnum">₦84,250.00</p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-brand-soft)]">
                  <Wallet className="h-4.5 w-4.5 text-[var(--color-brand-dark)]" />
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Add money", icon: Banknote },
                  { label: "Send", icon: ArrowUpRight },
                  { label: "Save", icon: PiggyBank },
                ].map(({ label, icon: Icon }) => (
                  <div key={label} className="rounded-2xl bg-[var(--color-paper)] px-2 py-2.5 text-center">
                    <Icon className="mx-auto h-4 w-4 text-[var(--color-brand-dark)]" />
                    <p className="mt-1 text-[11px] font-medium text-[var(--color-ink-soft)]">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Goals</p>
                {[
                  { name: "Laptop", emoji: "💻", now: 96000, target: 150000 },
                  { name: "Rent top-up", emoji: "🏠", now: 42000, target: 120000 },
                ].map((g) => {
                  const pct = Math.round((g.now / g.target) * 100);
                  return (
                    <div key={g.name}>
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="font-medium">{g.emoji} {g.name}</span>
                        <span className="tnum text-[var(--color-ink-soft)]">₦{(g.now / 1000).toFixed(0)}k / ₦{(g.target / 1000).toFixed(0)}k</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-paper)]">
                        <div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center gap-2 rounded-2xl bg-[var(--color-lime)]/25 px-3 py-2.5">
                <ShieldCheck className="h-4 w-4 text-[var(--color-brand-dark)]" />
                <p className="text-[11.5px] text-[var(--color-ink-soft)]">Transfer to <span className="font-semibold text-[var(--color-ink)]">ADEBAYO O. JOSHUA</span> · verified</p>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-3 hidden rounded-2xl border border-[var(--color-line)] bg-white px-3 py-2 text-[11px] shadow-md sm:block">
              <span className="font-semibold">₦12,000</span> added · just now
            </div>
          </div>
        </div>
      </section>

      {/* steps */}
      <section className="border-y border-[var(--color-line)] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-[430px] text-3xl tracking-[-0.02em] sm:text-[2.1rem]">
              Three steps between you and <span className="font-[family-name:var(--font-display)] italic text-[var(--color-brand)]">a plan</span>.
            </h2>
            <Link to="/signup" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--color-brand-dark)]">
              Start now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-9 grid gap-5 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="rounded-[var(--radius-card)] border border-[var(--color-line)] p-5">
                <p className="text-[11px] font-semibold tracking-widest text-[var(--color-brand)]">{s.n}</p>
                <h3 className="mt-2 text-[15px] font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* features */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-[var(--color-brand)]">What you get</p>
        <h2 className="mt-2 max-w-[560px] text-3xl tracking-[-0.02em] sm:text-[2.1rem]">
          Everything a student wallet should do. Nothing it shouldn't.
        </h2>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="p-5 transition-transform duration-300 hover:-translate-y-0.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-brand-soft)]">
                <Icon className="h-4 w-4 text-[var(--color-brand-dark)]" />
              </span>
              <h3 className="mt-3.5 text-[14.5px] font-semibold">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* savings showcase */}
      <section className="border-y border-[var(--color-line)] bg-[#0b1411] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-widest text-[var(--color-lime)]">Savings goals</p>
            <h2 className="mt-3 text-3xl leading-tight tracking-[-0.02em] sm:text-[2.1rem]">
              The money for rent stays money for rent.
            </h2>
            <p className="mt-4 max-w-[460px] text-[14.5px] leading-relaxed text-white/70">
              Goals are an internal allocation of your own wallet balance, not an investment and not interest.
              You decide when it is locked, and you can always see exactly what is set aside.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Flexible, date-locked, or fully locked goals",
                "Move money in and out with a full trail",
                "Progress that survives a bad week",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[13.5px] text-white/85">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--color-lime)]">
                    <Check className="h-3 w-3 text-[#0b1411]" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <Link to="/signup" className="mt-7 inline-block">
              <Button variant="lime" size="lg">Create your first goal</Button>
            </Link>
          </div>

          <div className="rounded-[24px] bg-white/[.04] p-4 ring-1 ring-white/10">
            <div className="rounded-[18px] bg-white p-4 text-[var(--color-ink)]">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Savings total</p>
                <PiggyBank className="h-4 w-4 text-[var(--color-brand)]" />
              </div>
              <p className="mt-1 text-2xl font-semibold tnum">₦138,000.00</p>
              <div className="mt-4 space-y-3">
                {[
                  { name: "Laptop", emoji: "💻", now: 96000, target: 150000, pct: 64 },
                  { name: "Rent top-up", emoji: "🏠", now: 42000, target: 120000, pct: 35 },
                ].map((g) => (
                  <div key={g.name} className="rounded-xl border border-[var(--color-line)] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-medium">{g.emoji} {g.name}</p>
                      <span className="rounded-full bg-[var(--color-brand-soft)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--color-brand-dark)]">{g.pct}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-paper)]">
                      <div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: `${g.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* security + whatsapp */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-start gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-brand-soft)]">
                <Lock className="h-5 w-5 text-[var(--color-brand-dark)]" />
              </span>
              <div>
                <h3 className="text-[15.5px] font-semibold">Your identity stays yours</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">
                  BVN and NIN are verified once and stored as a reference with only the last four digits visible.
                  Raw bank account numbers never leave the backend. Transfers need your 4-digit PIN, and five wrong
                  attempts locks the PIN for 15 minutes.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {["Row-level security on every table", "Ledger entries are immutable", "Idempotent payment webhooks", "Admin actions fully audited"].map((t) => (
                    <p key={t} className="flex items-center gap-2 text-[12.5px] text-[var(--color-ink-soft)]">
                      <Check className="h-3.5 w-3.5 text-[var(--color-brand)]" /> {t}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </Card>
          <Card className="flex flex-col justify-between bg-[var(--color-brand)] p-6 text-white">
            <div>
              <Smartphone className="h-5 w-5 text-[var(--color-lime)]" />
              <h3 className="mt-3 text-[15.5px] font-semibold">Balance on WhatsApp</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/75">
                Link your number, then ask for your balance or goals. Money can only move inside the app.
              </p>
            </div>
            <Link to="/how-it-works" className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-lime)]">
              See the commands <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Card>
        </div>
      </section>

      {/* final cta */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="rounded-[28px] border border-[var(--color-line)] bg-white px-6 py-12 text-center">
          <h2 className="mx-auto max-w-[520px] text-3xl tracking-[-0.02em] sm:text-[2.2rem]">
            Start with the allowance you have <span className="font-[family-name:var(--font-display)] italic text-[var(--color-brand)]">right now</span>.
          </h2>
          <p className="mx-auto mt-3 max-w-[460px] text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
            Free to open, no monthly charge, no credit. Just a wallet, goals, and transfers that show their work.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/signup"><Button size="lg">Create your account <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link to="/fees"><Button size="lg" variant="secondary">Check fees and limits</Button></Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
