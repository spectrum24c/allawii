import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Check, Eye, EyeOff, Fingerprint,
  Lock, Mail, Phone, ShieldCheck, User, Wallet,
} from "lucide-react";
import { Alert, Button, Field, Input, useToast } from "../../components/ui";
import { actions, auth, getMyRole } from "../../lib/api";
import { humanError } from "../../lib/errors";
import { isConfigured } from "../../lib/supabase";

/* ────────────────────────────────────────────────────────────────────────────
   Auth frame: a dark brand panel on the left, a warm paper form column on the
   right. Below lg the panel folds into a slim header so the form stays the
   whole screen. No public nav: an auth screen should feel like a vault door,
   not a marketing page.
   ──────────────────────────────────────────────────────────────────────────── */

function BrandMark({ invert }: { invert?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5">
      <span className={`grid h-9 w-9 place-items-center rounded-[11px] ${invert ? "bg-white/12 ring-1 ring-inset ring-white/15" : "bg-[var(--color-brand)]"}`}>
        <svg viewBox="0 0 32 32" className="h-[18px] w-[18px]" aria-hidden>
          <path d="M9 23 16 9l7 14h-4.2l-2.8-6-2.8 6z" fill="var(--color-lime)" />
        </svg>
      </span>
      <span className={`text-[17px] font-extrabold tracking-[-0.03em] ${invert ? "text-white" : "text-[var(--color-ink)]"}`}>Allawii</span>
    </Link>
  );
}

function TrustRow({ icon: Icon, title, body }: { icon: typeof ShieldCheck; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-inset ring-white/15">
        <Icon className="h-4 w-4 text-[var(--color-lime)]" />
      </span>
      <div>
        <p className="text-[13.5px] font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/55">{body}</p>
      </div>
    </div>
  );
}

function LedgerPreview() {
  return (
    <div className="bezel-dark w-full max-w-[344px]">
      <div className="rounded-[20px] bg-[#071c17]/80 p-5 ring-1 ring-inset ring-white/10 backdrop-blur-md">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-white/45">Available balance</p>
            <p className="mt-1.5 text-[27px] font-bold tracking-[-0.03em] text-white tnum">₦84,250.00</p>
          </div>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
            <Wallet className="h-3.5 w-3.5 text-[var(--color-lime)]" />
          </span>
        </div>
        <div className="mt-4 space-y-2.5 border-t border-white/10 pt-4">
          {[
            { label: "Wallet funding", amount: "+₦12,000", meta: "Card · just now" },
            { label: "ADEBAYO O. JOSHUA", amount: "−₦2,500", meta: "Transfer · verified name" },
          ].map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium text-white/85">{r.label}</p>
                <p className="text-[10.5px] text-white/40">{r.meta}</p>
              </div>
              <p className={`text-[12.5px] font-semibold tnum ${r.amount.startsWith("+") ? "text-[var(--color-lime)]" : "text-white/80"}`}>{r.amount}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-full bg-[var(--color-lime)]/12 px-3 py-2 ring-1 ring-inset ring-[var(--color-lime)]/20">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-lime)]" />
          <p className="text-[10.5px] font-medium text-[var(--color-lime)]">Every movement leaves a ledger entry</p>
        </div>
      </div>
    </div>
  );
}

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[var(--color-paper)] lg:grid lg:grid-cols-[1.02fr_1fr]">
      {/* brand panel */}
      <aside className="panel-forest grain relative hidden flex-col justify-between p-10 lg:flex xl:p-14">
        <div className="pointer-events-none absolute -left-20 top-1/3 h-[380px] w-[380px] rounded-full bg-[#1d8a67]/25 blur-[90px] drift" />
        <div className="relative">
          <BrandMark invert />
        </div>

        <div className="relative my-10 max-w-[440px]">
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--color-lime)]/80">Student wallet · Nigeria</p>
          <h1 className="mt-4 text-[42px] font-extrabold leading-[1.04] tracking-[-0.035em] text-white xl:text-[46px]">
            Money that
            <br />
            <span className="font-[family-name:var(--font-display)] font-normal italic tracking-[-0.01em] text-[var(--color-lime)]">behaves</span> like money.
          </h1>
          <p className="mt-4 max-w-[360px] text-[13.5px] leading-relaxed text-white/60">
            Allowance in, rent still there when rent is due. Deposits, transfers and savings goals in one wallet.
          </p>
          <div className="mt-8">
            <LedgerPreview />
          </div>
        </div>

        <div className="relative space-y-4">
          <TrustRow icon={BadgeCheck} title="Names verified before money moves" body="Account name enquiry on every transfer, so a typo never becomes a loss." />
          <TrustRow icon={Fingerprint} title="PIN and session protected" body="Your BVN is never stored in full and never returned to the browser." />
          <p className="pt-2 text-[10.5px] leading-relaxed text-white/35">
            Allawii is a wallet, not a bank. Balances are held with licensed payment partners and do not earn interest.
          </p>
        </div>
      </aside>

      {/* form column */}
      <main className="relative flex min-h-[100dvh] flex-col px-5 pb-8 pt-5 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between">
          <div className="lg:invisible"><BrandMark /></div>
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold text-[var(--color-ink-soft)] transition-colors hover:bg-black/[.04] hover:text-[var(--color-ink)]">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[420px] rise">{children}</div>
        </div>

        <p className="mx-auto flex max-w-[420px] items-center justify-center gap-1.5 text-center text-[11px] text-[var(--color-ink-faint)]">
          <Lock className="h-3 w-3" /> Encrypted in transit · Session-scoped tokens
        </p>
      </main>
    </div>
  );
}

function Tabs({ active }: { active: "login" | "signup" }) {
  const items = [
    { key: "login", label: "Sign in", to: "/login" },
    { key: "signup", label: "Create account", to: "/signup" },
  ] as const;
  return (
    <div className="mb-7 inline-flex w-full rounded-full bg-[var(--color-paper-deep)] p-1 ring-1 ring-inset ring-[var(--color-line)]">
      {items.map((t) => (
        <Link
          key={t.key}
          to={t.to}
          className={`flex-1 rounded-full py-2.5 text-center text-[12.5px] font-bold transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)] ${
            active === t.key ? "bg-white text-[var(--color-ink)] shadow-[0_2px_8px_-4px_rgba(11,21,18,.35)]" : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

function ConfigWarning() {
  if (isConfigured) return null;
  return (
    <div className="mb-5">
      <Alert tone="info" title="Supabase is not configured">
        Add <code className="font-mono">VITE_SUPABASE_URL</code> and <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to your environment, then rebuild.
      </Alert>
    </div>
  );
}

/* field with an icon well and an optional trailing action (password reveal) */
function IconField({ icon: Icon, children }: { icon: typeof Mail; children: ReactNode }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-faint)]" />
      {children}
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, placeholder }: {
  id: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; autoComplete: string; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-faint)]" />
      <Input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? "••••••••"}
        className="pl-10 pr-11"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[var(--color-ink-soft)] transition-colors hover:bg-black/[.05]"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Strength({ password }: { password: string }) {
  const score = useMemo(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  }, [password]);
  const labels = ["Too short", "Weak", "Fair", "Strong", "Excellent"];
  const tones = ["bg-[var(--color-line-strong)]", "bg-[#d9534f]", "bg-[#d98324]", "bg-[var(--color-brand)]", "bg-[var(--color-brand-dark)]"];
  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < score ? tones[score] : "bg-[var(--color-line)]"}`} />
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--color-ink-faint)]">
        {password ? labels[score] : "8+ characters, a number and a symbol"}
      </p>
    </div>
  );
}

function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-relaxed text-[var(--color-ink-soft)]">
      <span className="relative mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer absolute inset-0 cursor-pointer appearance-none rounded-[6px] border border-[var(--color-line-strong)] bg-white transition-colors checked:border-[var(--color-brand)] checked:bg-[var(--color-brand)]" />
        <Check className="pointer-events-none h-3 w-3 text-white opacity-0 transition-opacity peer-checked:opacity-100" />
      </span>
      <span>{children}</span>
    </label>
  );
}

/* ────────────────────────────────────────────────────────────── sign in ── */
export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { push } = useToast();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.signIn(email, password);
      // An account without a transaction PIN cannot move money, so finish that
      // step before dropping the user on the dashboard.
      const [status, role] = await Promise.all([
        actions.securityStatus().catch(() => null),
        getMyRole().catch(() => "student"),
      ]);
      push({ tone: "success", title: "Welcome back" });
      if (role !== "student") navigate("/admin");
      else navigate(status && !status.pin_set ? "/security-setup" : "/dashboard");
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <Tabs active="login" />

      <p className="eyebrow">Welcome back</p>
      <h2 className="mt-2 text-[30px] font-extrabold leading-[1.08] tracking-[-0.035em]">Sign in to your wallet</h2>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">
        Your balance, goals and transfer history, exactly where you left them.
      </p>

      <div className="mt-7 bezel">
        <div className="bezel-core p-5 sm:p-6">
          <ConfigWarning />
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email address" htmlFor="email">
              <IconField icon={Mail}>
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu.ng" className="pl-10" />
              </IconField>
            </Field>

            <Field label="Password" htmlFor="password">
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>

            <div className="flex items-center justify-between gap-3 pt-0.5">
              <Checkbox checked={remember} onChange={setRemember}>Keep me signed in</Checkbox>
              <Link to="/forgot-password" className="shrink-0 text-[12px] font-bold text-[var(--color-brand-dark)] hover:underline">Forgot password?</Link>
            </div>

            {error && <Alert tone="error">{error}</Alert>}

            <Button type="submit" block size="lg" loading={busy} trailing={<ArrowRight className="h-4 w-4" />}>
              {busy ? "Signing in" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-[12.5px] text-[var(--color-ink-soft)]">
        <span>New to Allawii?</span>
        <Link to="/signup" className="font-bold text-[var(--color-brand-dark)] hover:underline">Create an account</Link>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-[var(--color-ink-faint)]">
        <ShieldCheck className="h-3.5 w-3.5" /> We never ask for your card PIN, OTP or BVN over email or chat.
      </p>
    </AuthLayout>
  );
}

/* ───────────────────────────────────────────────────────────── create ──── */
export function Signup() {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", dob: "", password: "", confirm: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();
  const { push } = useToast();

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function goToSecurity(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.fullName.trim().length < 3) return setError("Enter your full name as it appears on your ID.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return setError("That email address does not look right.");
    if (!form.phone) return setError("Add a phone number so we can send you transaction alerts.");
    if (!/^(\+?234|0)[0-9]{9,10}$/.test(form.phone.replace(/\s/g, ""))) return setError("Enter a Nigerian phone number, e.g. 08012345678.");
    setStep(2);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) return setError("Use at least 8 characters for your password.");
    if (form.password !== form.confirm) return setError("Those passwords do not match.");
    if (!consent) return setError("Accept the terms and privacy policy to continue.");
    setBusy(true);
    try {
      const result = await auth.signUp({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone || undefined,
        dob: form.dob || undefined,
      });
      if (result.session) {
        push({ tone: "success", title: "Account created", body: "Next: create the PIN that authorises your transfers." });
        navigate("/security-setup");
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="bezel">
          <div className="bezel-core p-7 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--color-brand-soft)]">
              <Mail className="h-5 w-5 text-[var(--color-brand-dark)]" />
            </span>
            <h2 className="mt-5 text-[24px] font-extrabold tracking-[-0.03em]">Check your inbox</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
              We sent a confirmation link to <span className="font-semibold text-[var(--color-ink)]">{form.email}</span>. Confirm it, then sign in.
            </p>
            <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--color-ink-faint)]">
              The link expires in 24 hours. If it does not arrive, check spam, then try signing in.
            </p>
            <Link to="/login" className="mt-6 block"><Button block size="lg">Go to sign in</Button></Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Tabs active="signup" />

      <div className="mb-5">
        <div className="flex items-center gap-2.5">
          {[1, 2].map((n) => (
            <div key={n} className="flex flex-1 items-center gap-2.5">
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors duration-300 ${
                step >= n ? "bg-[var(--color-brand)] text-white" : "bg-[var(--color-paper-deep)] text-[var(--color-ink-faint)] ring-1 ring-inset ring-[var(--color-line)]"
              }`}>
                {step > n ? <Check className="h-3 w-3" /> : n}
              </span>
              <span className={`text-[11.5px] font-semibold ${step >= n ? "text-[var(--color-ink)]" : "text-[var(--color-ink-faint)]"}`}>
                {n === 1 ? "Your details" : "Secure it"}
              </span>
              {n === 1 && <span className={`h-px flex-1 ${step > 1 ? "bg-[var(--color-brand)]/40" : "bg-[var(--color-line)]"}`} />}
            </div>
          ))}
        </div>
      </div>

      <h2 className="text-[30px] font-extrabold leading-[1.08] tracking-[-0.035em]">
        {step === 1 ? "Open your Allawii account" : "Almost done"}
      </h2>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">
        {step === 1 ? "About two minutes. Identity verification comes right after." : "Choose a password you have not used anywhere else."}
      </p>

      <div className="mt-6 bezel">
        <div className="bezel-core p-5 sm:p-6">
          <ConfigWarning />

          {step === 1 ? (
            <form onSubmit={goToSecurity} className="space-y-4">
              <Field label="Full name" htmlFor="name">
                <IconField icon={User}>
                  <Input id="name" required autoComplete="name" value={form.fullName} onChange={set("fullName")} placeholder="Amaka Obi" className="pl-10" />
                </IconField>
              </Field>
              <Field label="Email address" htmlFor="email">
                <IconField icon={Mail}>
                  <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={set("email")} placeholder="you@school.edu.ng" className="pl-10" />
                </IconField>
              </Field>
              <Field label="Phone number" htmlFor="phone" hint="Used for transaction alerts only">
                <IconField icon={Phone}>
                  <Input id="phone" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} placeholder="08012345678" className="pl-10" />
                </IconField>
              </Field>
              <Field label="Date of birth" htmlFor="dob" hint="You must be 16 or older">
                <Input id="dob" type="date" max={new Date().toISOString().slice(0, 10)} value={form.dob} onChange={set("dob")} />
              </Field>

              {error && <Alert tone="error">{error}</Alert>}

              <Button type="submit" block size="lg" trailing={<ArrowRight className="h-4 w-4" />}>Continue</Button>
            </form>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Field label="Password" htmlFor="password">
                <PasswordInput id="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
                <Strength password={form.password} />
              </Field>
              <Field label="Confirm password" htmlFor="confirm">
                <PasswordInput id="confirm" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" />
              </Field>

              <div className="rounded-[14px] bg-[var(--color-paper)] p-3 ring-1 ring-inset ring-[var(--color-line)]">
                <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[var(--color-ink-faint)]">Signing up as</p>
                <p className="mt-1.5 text-[13px] font-semibold">{form.fullName}</p>
                <p className="text-[12px] text-[var(--color-ink-soft)]">{form.email} · {form.phone}</p>
                <button type="button" onClick={() => setStep(1)} className="mt-2 text-[11.5px] font-bold text-[var(--color-brand-dark)] hover:underline">Edit details</button>
              </div>

              <Checkbox checked={consent} onChange={setConsent}>
                I accept the <Link to="/terms" className="underline">terms</Link> and <Link to="/privacy" className="underline">privacy policy</Link>, and I understand Allawii is a wallet, not a bank.
              </Checkbox>

              {error && <Alert tone="error">{error}</Alert>}

              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="lg" onClick={() => setStep(1)} aria-label="Back to details" className="px-4">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button type="submit" block size="lg" loading={busy} trailing={<ArrowRight className="h-4 w-4" />}>
                  {busy ? "Creating account" : "Create account"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-[12.5px] text-[var(--color-ink-soft)]">
        <span>Already have an account?</span>
        <Link to="/login" className="font-bold text-[var(--color-brand-dark)] hover:underline">Sign in</Link>
      </div>
    </AuthLayout>
  );
}

/* ──────────────────────────────────────────────────────────── reset ─────── */
export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.resetPassword(email);
      setDone(true);
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <p className="eyebrow">Account recovery</p>
      <h2 className="mt-2 text-[30px] font-extrabold leading-[1.08] tracking-[-0.035em]">Reset your password</h2>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">
        We will email you a secure link to set a new one. It expires in 30 minutes.
      </p>

      <div className="mt-7 bezel">
        <div className="bezel-core p-5 sm:p-6">
          {done ? (
            <div className="text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--color-brand-soft)]">
                <Check className="h-5 w-5 text-[var(--color-brand-dark)]" />
              </span>
              <p className="mt-4 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
                If {email} has an account, a reset link is on its way.
              </p>
              <Link to="/login" className="mt-5 block"><Button block variant="secondary">Back to sign in</Button></Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Field label="Email address" htmlFor="email">
                <IconField icon={Mail}>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu.ng" className="pl-10" />
                </IconField>
              </Field>
              {error && <Alert tone="error">{error}</Alert>}
              <Button type="submit" block size="lg" loading={busy} trailing={<ArrowRight className="h-4 w-4" />}>Send reset link</Button>
            </form>
          )}
        </div>
      </div>

      <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
      </Link>
    </AuthLayout>
  );
}

/* ──────────────────────────────────────────────────── set password ─────── */
export function SetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { push } = useToast();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Those passwords do not match.");
    setBusy(true);
    try {
      await auth.updatePassword(password);
      push({ tone: "success", title: "Password updated" });
      navigate("/dashboard");
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <p className="eyebrow">One last step</p>
      <h2 className="mt-2 text-[30px] font-extrabold leading-[1.08] tracking-[-0.035em]">Set a new password</h2>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">Choose something you have not used elsewhere.</p>

      <div className="mt-7 bezel">
        <div className="bezel-core p-5 sm:p-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label="New password" htmlFor="password">
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              <Strength password={password} />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm">
              <PasswordInput id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </Field>
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" block size="lg" loading={busy}>Update password</Button>
          </form>
        </div>
      </div>
    </AuthLayout>
  );
}
