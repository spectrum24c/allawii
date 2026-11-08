import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Mail } from "lucide-react";
import { PublicLayout } from "../../components/layout/PublicLayout";
import { Button, Field, Input, useToast } from "../../components/ui";
import { auth } from "../../lib/api";
import { humanError } from "../../lib/errors";
import { isConfigured } from "../../lib/supabase";

function ConfigWarning() {
  if (isConfigured) return null;
  return (
    <div className="mb-5 rounded-xl border border-[#f3e0c0] bg-[#fdf6e9] p-3.5 text-[12.5px] text-[#7a4a10]">
      <strong className="font-semibold">Supabase is not configured.</strong> Add <code className="font-mono">VITE_SUPABASE_URL</code> and{" "}
      <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to your environment, then rebuild.
    </div>
  );
}

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <PublicLayout>
      <section className="mx-auto flex max-w-md flex-col px-5 pb-16 pt-12">
        <h1 className="text-[1.9rem] leading-tight tracking-[-0.02em]">{title}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">{subtitle}</p>
        <div className="mt-7 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-white p-5 sm:p-6">
          <ConfigWarning />
          {children}
        </div>
        {footer && <div className="mt-5 text-center text-[13px] text-[var(--color-ink-soft)]">{footer}</div>}
      </section>
    </PublicLayout>
  );
}

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      push({ tone: "success", title: "Welcome back" });
      navigate("/dashboard");
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see your balance, goals and transfers."
      footer={<>New to Allawii? <Link to="/signup" className="font-semibold text-[var(--color-brand-dark)]">Create an account</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu.ng" />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        {error && <p className="rounded-lg bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[var(--color-danger)]">{error}</p>}
        <Button type="submit" block loading={busy}>Sign in</Button>
        <div className="flex items-center justify-between text-[12.5px]">
          <Link to="/forgot-password" className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">Forgot password?</Link>
          <Link to="/help" className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">Need help?</Link>
        </div>
      </form>
    </AuthShell>
  );
}

export function Signup() {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", dob: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();
  const { push } = useToast();

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) return setError("Use at least 8 characters for your password.");
    if (form.password !== form.confirm) return setError("Those passwords do not match.");
    if (form.phone && !/^(\+?234|0)[0-9]{9,10}$/.test(form.phone.replace(/\s/g, ""))) {
      return setError("Enter a Nigerian phone number, e.g. 08012345678.");
    }
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
        push({ tone: "success", title: "Account created" });
        navigate("/kyc");
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
      <AuthShell title="Check your inbox" subtitle={`We sent a confirmation link to ${form.email}. Confirm it, then sign in.`}>
        <div className="flex flex-col items-center py-4 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-brand-soft)]">
            <Mail className="h-5 w-5 text-[var(--color-brand-dark)]" />
          </span>
          <p className="mt-4 text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">
            The link expires in 24 hours. If it does not arrive, check spam, then try signing in: some deployments let
            you in without confirmation.
          </p>
          <Link to="/login" className="mt-5 w-full"><Button block>Go to sign in</Button></Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="About two minutes. You will verify your identity after this step."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-[var(--color-brand-dark)]">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" htmlFor="name">
          <Input id="name" required autoComplete="name" value={form.fullName} onChange={set("fullName")} placeholder="Amaka Obi" />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={set("email")} placeholder="you@school.edu.ng" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" htmlFor="phone" hint="Used for alerts">
            <Input id="phone" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} placeholder="08012345678" />
          </Field>
          <Field label="Date of birth" htmlFor="dob">
            <Input id="dob" type="date" max={new Date().toISOString().slice(0, 10)} value={form.dob} onChange={set("dob")} />
          </Field>
        </div>
        <Field label="Password" htmlFor="password" hint="At least 8 characters">
          <Input id="password" type="password" required autoComplete="new-password" value={form.password} onChange={set("password")} placeholder="••••••••" />
        </Field>
        <Field label="Confirm password" htmlFor="confirm">
          <Input id="confirm" type="password" required autoComplete="new-password" value={form.confirm} onChange={set("confirm")} placeholder="••••••••" />
        </Field>

        {error && <p className="rounded-lg bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[var(--color-danger)]">{error}</p>}

        <Button type="submit" block loading={busy}>Create account</Button>
        <p className="text-center text-[11.5px] leading-relaxed text-[var(--color-ink-soft)]">
          By continuing you accept our <Link to="/terms" className="underline">terms</Link> and{" "}
          <Link to="/privacy" className="underline">privacy policy</Link>. Allawii is a wallet, not a bank, and pays no interest.
        </p>
      </form>
    </AuthShell>
  );
}

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
    <AuthShell title="Reset your password" subtitle="We will email you a secure link to set a new one.">
      {done ? (
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--color-brand-soft)]">
            <Check className="h-5 w-5 text-[var(--color-brand-dark)]" />
          </span>
          <p className="mt-4 text-[13.5px] text-[var(--color-ink-soft)]">If {email} has an account, a reset link is on its way.</p>
          <Link to="/login" className="mt-5 block"><Button block variant="secondary">Back to sign in</Button></Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu.ng" />
          </Field>
          {error && <p className="rounded-lg bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[var(--color-danger)]">{error}</p>}
          <Button type="submit" block loading={busy}>Send reset link</Button>
          <Link to="/login" className="flex items-center justify-center gap-1.5 text-[12.5px] text-[var(--color-ink-soft)]">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
        </form>
      )}
    </AuthShell>
  );
}

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
    <AuthShell title="Set a new password" subtitle="Choose something you have not used elsewhere.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" htmlFor="password" hint="At least 8 characters">
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm">
          <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error && <p className="rounded-lg bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[var(--color-danger)]">{error}</p>}
        <Button type="submit" block loading={busy}>Update password</Button>
      </form>
    </AuthShell>
  );
}
