import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge, Button, Card, Field, Input, useToast } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { actions } from "../../lib/api";
import { humanError } from "../../lib/errors";
import { formatDateTime } from "../../lib/format";

const steps = [
  { title: "Account created", body: "Email and phone captured." },
  { title: "Identity check", body: "BVN or NIN verified with our provider." },
  { title: "Wallet unlocked", body: "Deposits, transfers and funding account enabled." },
];

export default function Kyc() {
  const { kyc, profile, refresh } = useAuth();
  const { push } = useToast();
  const [method, setMethod] = useState<"BVN" | "NIN">("BVN");
  const [value, setValue] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = kyc?.kyc_status ?? "NOT_STARTED";
  const verified = status === "VERIFIED";

  async function submit() {
    setError(null);
    if (!/^[0-9]{11}$/.test(value)) return setError(`${method} must be 11 digits.`);
    if (!consent) return setError("Tick the consent box so we can run the check.");
    setBusy(true);
    try {
      await actions.submitKyc(method === "BVN" ? value : null, method === "NIN" ? value : null);
      setValue("");
      await refresh();
      push({ tone: "success", title: "Identity check submitted" });
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl rise">
        <h1 className="text-[24px] tracking-[-0.02em]">KYC centre</h1>
        <p className="mt-1 text-[13.5px] text-[var(--color-ink-soft)]">Identity checks are required before money can move. They take about a minute.</p>

        <Card className="mt-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${verified ? "bg-[var(--color-brand-soft)]" : "bg-[#fef4e6]"}`}>
                {verified ? <ShieldCheck className="h-5 w-5 text-[var(--color-brand-dark)]" /> : status === "REJECTED" ? <XCircle className="h-5 w-5 text-[var(--color-danger)]" /> : <Clock className="h-5 w-5 text-[var(--color-warn)]" />}
              </span>
              <div>
                <p className="text-[14px] font-semibold">Status: {status.replace("_", " ")}</p>
                <p className="text-[12px] text-[var(--color-ink-soft)]">
                  {kyc?.verification_provider ? `Verified with ${kyc.verification_provider}` : "No provider on record"}
                  {kyc?.verified_at ? ` · ${formatDateTime(kyc.verified_at)}` : ""}
                </p>
              </div>
            </div>
            <Badge tone={status}>{status.replace("_", " ")}</Badge>
          </div>

          <div className="mt-5 space-y-3">
            {steps.map((s, i) => {
              const done = verified ? true : i === 0;
              return (
                <div key={s.title} className="flex items-start gap-3">
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${done ? "bg-[var(--color-brand)] text-white" : "bg-[#ecece7] text-[var(--color-ink-soft)]"}`}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <div>
                    <p className="text-[13px] font-medium">{s.title}</p>
                    <p className="text-[11.5px] text-[var(--color-ink-soft)]">{s.body}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {verified && (
            <div className="mt-5 rounded-xl bg-[var(--color-brand-soft)] p-3.5">
              <p className="text-[12.5px] text-[var(--color-brand-dark)]">
                Your identity is verified{kyc?.bvn_last4 ? ` · BVN ending ${kyc.bvn_last4}` : ""}{kyc?.nin_last4 ? ` · NIN ending ${kyc.nin_last4}` : ""}.
              </p>
              <Link to="/wallet" className="mt-2 inline-block text-[12px] font-semibold text-[var(--color-brand-dark)]">Request your funding account →</Link>
            </div>
          )}

          {status === "REJECTED" && (
            <div className="mt-5 rounded-xl bg-[#fdeceb] p-3.5">
              <p className="text-[12.5px] font-medium text-[var(--color-danger)]">{kyc?.failure_reason ?? "Your check could not be verified."}</p>
              <p className="mt-1 text-[11.5px] text-[var(--color-danger)]/80">You can retry below, or raise a support ticket if the details are correct.</p>
            </div>
          )}
        </Card>

        {!verified && (
          <Card className="mt-4 p-5">
            <p className="text-[13.5px] font-semibold">Submit your identity check</p>
            <p className="mt-1 text-[12.5px] text-[var(--color-ink-soft)]">
              We store only a hash and the last four digits. The full value is never returned to this page.
            </p>

            <div className="mt-4 flex gap-2">
              {(["BVN", "NIN"] as const).map((m) => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-[13px] font-medium ${method === m ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
                  Use my {m}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <Field label={`${method} (11 digits)`} htmlFor="kyc-value" hint="Matches the name on your account">
                <Input id="kyc-value" inputMode="numeric" maxLength={11} value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} placeholder="12345678901" />
              </Field>
            </div>

            <label className="mt-4 flex items-start gap-2.5 text-[12px] leading-relaxed text-[var(--color-ink-soft)]">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-[var(--color-line)] accent-[var(--color-brand)]" />
              I consent to Allawii verifying my identity with a licensed verification partner, and I confirm the details
              belong to me{profile?.full_name ? ` (${profile.full_name})` : ""}.
            </label>

            {error && <p className="mt-3 rounded-lg bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[var(--color-danger)]">{error}</p>}

            <Button block className="mt-4" loading={busy} onClick={submit} disabled={value.length !== 11 || !consent}>
              {status === "REJECTED" ? "Retry identity check" : "Submit identity check"}
            </Button>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-ink-soft)]">
              In demo mode the check is verified instantly so you can test deposits and transfers. With live provider keys
              the status becomes PENDING until the provider responds.
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
