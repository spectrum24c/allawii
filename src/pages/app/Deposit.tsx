import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge, Button, Card, Field, Input, useToast } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { actions } from "../../lib/api";
import { naira, toMinor } from "../../lib/format";
import { humanError } from "../../lib/errors";

const quick = [200000, 500000, 1000000, 2000000]; // ₦2,000 / 5,000 / 10,000 / 20,000

export default function Deposit() {
  const { kyc, limits, wallet, refresh } = useAuth();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ mode: string; reference?: string; message?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const { push } = useToast();

  const verified = kyc?.kyc_status === "VERIFIED";
  const minor = toMinor(amount);

  // Returning from a hosted checkout: verify server-side, never trust the URL.
  useEffect(() => {
    const reference = params.get("paymentReference") ?? params.get("reference");
    if (!reference) return;
    actions.verifyDeposit(reference)
      .then((res) => {
        setResult({ mode: "monnify", reference });
        push({ tone: res.status === "PAID" ? "success" : "info", title: `Payment ${res.status}` });
      })
      .catch((err) => setError(humanError(err)))
      .finally(() => refresh());
  }, [params, push, refresh]);

  async function submit() {
    setError(null);
    if (minor < 10000) return setError("The smallest deposit is ₦100.");
    setBusy(true);
    try {
      const res = await actions.deposit(minor);
      if (res.mode === "monnify" && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      setResult({ mode: "demo", reference: res.reference, message: res.message });
      push({ tone: "success", title: "Demo funds added", body: "No real money moved." });
      await refresh();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-xl rise">
        <Link to="/wallet" className="text-[12.5px] text-[var(--color-ink-soft)]">← Wallet</Link>
        <h1 className="mt-2 text-[24px] tracking-[-0.02em]">Add money</h1>
        <p className="mt-1 text-[13.5px] text-[var(--color-ink-soft)]">
          Current available balance: <span className="font-semibold text-[var(--color-ink)] tnum">{naira(wallet?.available_minor)}</span>
        </p>

        {!verified && (
          <Card className="mt-5 border-[#f3e0c0] bg-[#fdf6e9] p-4">
            <p className="text-[13px] font-semibold text-[#7a4a10]">Identity check required</p>
            <p className="mt-1 text-[12.5px] text-[#7a4a10]/90">Deposits unlock once your KYC is verified.</p>
            <Link to="/kyc"><Button size="sm" className="mt-3">Go to KYC</Button></Link>
          </Card>
        )}

        <Card className="mt-5 p-5">
          <Field label="Amount" htmlFor="amount" hint={limits ? `Minimum ₦100 · Maximum ₦10,000,000` : undefined}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-ink-soft)]">₦</span>
              <Input
                id="amount"
                inputMode="decimal"
                className="pl-7 text-[18px] font-semibold tnum"
                placeholder="0.00"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setResult(null); }}
                disabled={!verified}
              />
            </div>
          </Field>

          <div className="mt-3 flex flex-wrap gap-2">
            {quick.map((q) => (
              <button
                key={q}
                onClick={() => setAmount((q / 100).toFixed(0))}
                disabled={!verified}
                className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-[12.5px] font-medium hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-brand-soft)] disabled:opacity-50"
              >
                ₦{(q / 100).toLocaleString("en-NG")}
              </button>
            ))}
          </div>

          {error && <p className="mt-4 rounded-lg bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[var(--color-danger)]">{error}</p>}

          <Button block className="mt-5" loading={busy} disabled={!verified || minor < 10000} onClick={submit}>
            {limits?.demo_mode ? "Add demo funds" : `Pay ${minor ? naira(minor) : ""}`}
          </Button>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-[var(--color-paper)] p-3">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-ink-soft)]" />
            <p className="text-[11.5px] leading-relaxed text-[var(--color-ink-soft)]">
              {limits?.demo_mode
                ? "This deployment has no live payment keys, so top-ups are simulated and clearly labelled. Every simulated credit is marked DEMO in its reference."
                : "You will be redirected to our payment partner. Your wallet is only credited after the payment is verified server-side, never from the redirect alone."}
            </p>
          </div>
        </Card>

        {result && (
          <Card className="mt-4 border-[var(--color-brand)]/30 bg-[var(--color-brand-soft)] p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-[var(--color-brand-dark)]" />
              <div>
                <p className="text-[13.5px] font-semibold text-[var(--color-brand-dark)]">
                  {result.mode === "demo" ? "Demo funds added" : "Payment received"}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--color-brand-dark)]/85">{result.message ?? "Your balance has been updated."}</p>
                {result.reference && <p className="mt-1 font-mono text-[11px] text-[var(--color-brand-dark)]/70">{result.reference}</p>}
              </div>
            </div>
          </Card>
        )}

        <div className="mt-5 flex items-start gap-2.5 px-1">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-ink-soft)]" />
          <p className="text-[11.5px] leading-relaxed text-[var(--color-ink-soft)]">
            Allawii never stores card details. Deposits are verified with the payment provider before your ledger is credited,
            and duplicate webhooks are ignored. <Badge tone="SUCCESSFUL" className="ml-1 align-middle">Idempotent</Badge>
          </p>
        </div>
      </div>
    </AppShell>
  );
}
