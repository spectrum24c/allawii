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
      {/* ── hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-32 -top-32 h-[460px] w-[460px] rounded-full bg-[#0c6b4c]/10 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-40 left-1/4 h-[380px] w-[380px] rounded-full bg-[var(--color-lime)]/30 blur-[90px]" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-16 pt-12 lg:grid-cols-[1.06fr_.94fr] lg:gap-10 lg:pb-24 lg:pt-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/70 py-1.5 pl-2 pr-3.5 text-[11.5px] font-semibold text-[var(--color-ink-soft)] ring-1 ring-inset ring-[var(--color-line)] backdrop-blur">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-brand-soft)]">
                <Sparkles className="h-3 w-3 text-[var(--color-brand-dark)]" />
              </span>
              Student wallet · built for Nigeria
            </span>

            <h1 className="mt-5 text-[clamp(2.5rem,6.4vw,4.15rem)] font-extrabold leading-[0.98] tracking-[-0.04em]">
              Money that finally
              <br />
              <span className="font-[family-name:var(--font-display)] font-normal italic tracking-[-0.015em] text-[var(--color-brand)]">makes sense</span> for school.
            </h1>

            <p className="mt-5 max-w-[520px] text-[15px] leading-relaxed text-[var(--color-ink-soft)] sm:text-[15.5px]">
              Allowance comes in, then disappears. Allawii gives students one wallet for deposits, transfers and
              savings goals, so the money for rent is still there when rent is due.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/signup">
                <Button size="lg" trailing={<ArrowRight className="h-4 w-4" />}>Open your account</Button>
              </Link>
              <Link to="/how-it-works">
                <Button size="lg" variant="secondary">See how it works</Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2.5 border-t border-[var(--color-line)] pt-5 text-[12px] font-medium text-[var(--color-ink-soft)]">
              {["No monthly fee", "Name-verified transfers", "Not a bank. Not credit."].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[var(--color-brand)]" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* product preview: tray + core */}
          <div className="relative mx-auto w-full max-w-[430px]">
            <div className="absolute -left-6 top-10 hidden -rotate-3 rounded-[18px] bg-white/75 px-3.5 py-2.5 ring-1 ring-[var(--color-line)] backdrop-blur sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--color-ink-faint)]">Deposit</p>
              <p className="mt-0.5 text-[12.5px] font-bold text-[var(--color-brand-dark)]">+₦12,000 settled</p>
            </div>

            <div className="bezel relative shadow-[0_40px_80px_-50px_rgba(11,21,18,.6)]">
              <div className="bezel-core p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--color-ink-faint)]">Available balance</p>
                    <p className="mt-1.5 text-[31px] font-extrabold tracking-[-0.035em] tnum">₦84,250.00</p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-brand-soft)]">
                    <Wallet className="h-4 w-4 text-[var(--color-brand-dark)]" />
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { label: "Add money", icon: Banknote },
                    { label: "Send", icon: ArrowUpRight },
                    { label: "Save", icon: PiggyBank },
                  ].map(({ label, icon: Icon }) => (
                    <div key={label} className="rounded-[14px] bg-[var(--color-paper)] px-2 py-3 text-center ring-1 ring-inset ring-[var(--color-line)]">
                      <Icon className="mx-auto h-4 w-4 text-[var(--color-brand-dark)]" />
                      <p className="mt-1.5 text-[10.5px] font-semibold text-[var(--color-ink-soft)]">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <p className="eyebrow">Savings goals</p>
                    <span className="text-[10.5px] font-semibold text-[var(--color-ink-faint)]">2 active</span>
                  </div>
                  <div className="mt-3 space-y-3.5">
                    {[
                      { name: "Laptop", now: 96000, target: 150000 },
                      { name: "Rent top-up", now: 42000, target: 120000 },
                    ].map((g) => {
                      const pct = Math.round((g.now / g.target) * 100);
                      return (
                        <div key={g.name}>
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="font-semibold">{g.name}</span>
                            <span className="tnum text-[11.5px] text-[var(--color-ink-soft)]">
                              ₦{(g.now / 1000).toFixed(0)}k <span className="text-[var(--color-ink-faint)]">of</span> ₦{(g.target / 1000).toFixed(0)}k
                            </span>
                          </div>
                          <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-[var(--color-paper-deep)]">
                            <div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2 rounded-[14px] bg-[var(--color-lime)]/25 px-3 py-2.5 ring-1 ring-inset ring-[#c6e070]/50">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--color-brand-dark)]" />
                  <p className="text-[11px] leading-snug text-[var(--color-ink-soft)]">
                    Sending to <span className="font-bold text-[var(--color-ink)]">ADEBAYO O. JOSHUA</span> · name verified
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-5 right-0 hidden rotate-2 rounded-[18px] bg-white px-3.5 py-2.5 ring-1 ring-[var(--color-line)] shadow-[0_18px_36px_-24px_rgba(11,21,18,.5)] sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--color-ink-faint)]">Goal</p>
              <p className="mt-0.5 text-[12.5px] font-bold">Laptop · 64%</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── steps ────────────────────────────────────────────────────────── */}
      <section className="border-y border-[var(--color-line)] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="eyebrow">Three steps</p>
              <h2 className="mt-2.5 max-w-[470px] text-[clamp(1.8rem,3.4vw,2.4rem)] font-extrabold leading-[1.06]">
                From download to <span className="font-[family-name:var(--font-display)] font-normal italic text-[var(--color-brand)]">a plan</span> in one sitting.
              </h2>
            </div>
            <Link to="/signup" className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--color-brand-dark)] hover:underline">
              Start now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="relative mt-10 grid gap-4 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="lift relative rounded-[var(--radius-card)] bg-[var(--color-paper)] p-5 ring-1 ring-[var(--color-line)]">
                <span className="font-[family-name:var(--font-display)] text-[30px] leading-none text-[var(--color-brand)]/35">{s.n}</span>
                <h3 className="mt-3 text-[15px] font-bold">{s.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── features ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-18 sm:py-20">
        <div className="max-w-[560px]">
          <p className="eyebrow">What you get</p>
          <h2 className="mt-2.5 text-[clamp(1.8rem,3.4vw,2.4rem)] font-extrabold leading-[1.06]">
            Everything a student wallet should do. Nothing it shouldn't.
          </h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="lift group p-5">
              <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[var(--color-brand-soft)] transition-colors duration-300 group-hover:bg-[var(--color-brand)]">
                <Icon className="h-4 w-4 text-[var(--color-brand-dark)] transition-colors duration-300 group-hover:text-[var(--color-lime)]" />
              </span>
              <h3 className="mt-4 text-[14.5px] font-bold">{title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-ink-soft)]">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── savings showcase ─────────────────────────────────────────────── */}
      <section className="panel-forest grain">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1fr_.9fr] lg:items-center lg:py-20">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--color-lime)]/85">Savings goals</p>
            <h2 className="mt-3.5 text-[clamp(1.9rem,3.6vw,2.5rem)] font-extrabold leading-[1.05] text-white">
              The money for rent stays money for rent.
            </h2>
            <p className="mt-4 max-w-[460px] text-[14px] leading-relaxed text-white/65">
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
                    <Check className="h-3 w-3 text-[#08211a]" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <Link to="/signup" className="mt-8 inline-block">
              <Button variant="lime" size="lg" trailing={<ArrowRight className="h-4 w-4" />}>Create your first goal</Button>
            </Link>
          </div>

          <div className="bezel-dark">
            <div className="rounded-[20px] bg-white p-5 text-[var(--color-ink)]">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--color-ink-faint)]">Savings total</p>
                <PiggyBank className="h-4 w-4 text-[var(--color-brand)]" />
              </div>
              <p className="mt-1.5 text-[26px] font-extrabold tracking-[-0.03em] tnum">₦138,000.00</p>
              <div className="mt-4 space-y-3">
                {[
                  { name: "Laptop", now: 96000, target: 150000, pct: 64 },
                  { name: "Rent top-up", now: 42000, target: 120000, pct: 35 },
                ].map((g) => (
                  <div key={g.name} className="rounded-[14px] bg-[var(--color-paper)] p-3 ring-1 ring-inset ring-[var(--color-line)]">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold">{g.name}</p>
                      <span className="rounded-full bg-[var(--color-brand-soft)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--color-brand-dark)]">{g.pct}%</span>
                    </div>
                    <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-[var(--color-paper-deep)]">
                      <div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: `${g.pct}%` }} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-[var(--color-ink-soft)] tnum">
                      ₦{g.now.toLocaleString()} of ₦{g.target.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── security + whatsapp ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-start gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-[var(--color-brand-soft)]">
                <Lock className="h-5 w-5 text-[var(--color-brand-dark)]" />
              </span>
              <div>
                <h3 className="text-[16px] font-bold">Your identity stays yours</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
                  BVN and NIN are verified once and stored as a reference with only the last four digits visible.
                  Raw bank account numbers never leave the backend. Transfers need your 4-digit PIN, and five wrong
                  attempts locks the PIN for 15 minutes.
                </p>
                <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  {["Row-level security on every table", "Ledger entries are immutable", "Idempotent payment webhooks", "Admin actions fully audited"].map((t) => (
                    <p key={t} className="flex items-center gap-2 text-[12.5px] text-[var(--color-ink-soft)]">
                      <Check className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand)]" /> {t}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <div className="panel-forest grain rounded-[var(--radius-card)] p-6">
            <Smartphone className="h-5 w-5 text-[var(--color-lime)]" />
            <h3 className="mt-3 text-[16px] font-bold text-white">Balance on WhatsApp</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-white/65">
              Link your number, then ask for your balance or goals. Money can only move inside the app.
            </p>
            <Link to="/how-it-works" className="mt-5 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--color-lime)] hover:underline">
              See the commands <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── final CTA ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="panel-forest grain overflow-hidden rounded-[30px] px-6 py-14 text-center sm:px-10">
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--color-lime)]/80">Open in two minutes</p>
          <h2 className="mx-auto mt-4 max-w-[560px] text-[clamp(1.9rem,4vw,2.7rem)] font-extrabold leading-[1.03] text-white">
            Start with the allowance you have{" "}
            <span className="font-[family-name:var(--font-display)] font-normal italic text-[var(--color-lime)]">right now</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-[460px] text-[13.5px] leading-relaxed text-white/60">
            Free to open, no monthly charge, no credit. Just a wallet, goals, and transfers that show their work.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" variant="lime" trailing={<ArrowRight className="h-4 w-4" />}>Create your account</Button>
            </Link>
            <Link to="/fees">
              <Button size="lg" variant="invert">Check fees and limits</Button>
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
