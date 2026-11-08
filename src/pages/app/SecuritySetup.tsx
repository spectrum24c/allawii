import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Lock, ShieldCheck } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Button, useToast } from "../../components/ui";
import { actions } from "../../lib/api";
import { humanError } from "../../lib/errors";

/* Four boxes, one digit each, with auto-advance and paste support. */
function PinBoxes({ value, onChange, autoFocus, label }: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  label: string;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(4, " ").slice(0, 4).split("");

  function setAt(i: number, d: string) {
    const next = value.padEnd(4, " ").split("");
    next[i] = d || " ";
    onChange(next.join("").replace(/ /g, "").slice(0, 4));
  }

  return (
    <div role="group" aria-label={label} className="flex gap-2.5">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={d.trim()}
          onChange={(e) => {
            const clean = e.target.value.replace(/\D/g, "");
            if (clean.length > 1) {
              onChange(clean.slice(0, 4));
              refs.current[Math.min(3, clean.length)]?.focus();
              return;
            }
            setAt(i, clean);
            if (clean && i < 3) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d.trim() && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < 3) refs.current[i + 1]?.focus();
          }}
          autoFocus={autoFocus && i === 0}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          aria-label={`${label} digit ${i + 1}`}
          className="h-14 w-full rounded-[16px] border border-[var(--color-line)] bg-white text-center text-[22px] font-bold tracking-[0.1em] text-[var(--color-ink)] tabular-nums shadow-[0_1px_1px_rgba(11,21,18,.03)_inset] transition-[border-color,box-shadow] duration-200 focus:border-[var(--color-brand)] focus:outline-none focus:shadow-[0_0_0_4px_rgba(12,107,76,.11)]"
        />
      ))}
    </div>
  );
}

export default function SecuritySetup() {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadySet, setAlreadySet] = useState(false);
  const navigate = useNavigate();
  const { push } = useToast();

  useEffect(() => {
    actions.securityStatus().then((s) => setAlreadySet(Boolean(s?.pin_set))).catch(() => setAlreadySet(false));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[0-9]{4}$/.test(pin)) return setError("Enter a 4-digit PIN.");
    if (pin !== confirm) return setError("Those PINs do not match.");
    if (/^(\d)\1{3}$/.test(pin)) return setError("Avoid four identical digits.");
    setBusy(true);
    try {
      await actions.setPin(pin);
      push({ tone: "success", title: "Transaction PIN saved" });
      navigate("/kyc");
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  const ready = pin.length === 4 && confirm.length === 4;

  return (
    <AppShell>
      <div className="mx-auto max-w-[560px] rise">
        <div className="flex items-center gap-2">
          {["Account", "PIN", "Identity"].map((step, i) => (
            <div key={step} className="flex flex-1 items-center gap-2">
              <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${
                i <= 1 ? "bg-[var(--color-brand)] text-white" : "bg-[var(--color-paper-deep)] text-[var(--color-ink-faint)] ring-1 ring-inset ring-[var(--color-line)]"
              }`}>
                {i === 0 ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={`text-[11.5px] font-semibold ${i <= 1 ? "text-[var(--color-ink)]" : "text-[var(--color-ink-faint)]"}`}>{step}</span>
              {i < 2 && <span className={`h-px flex-1 ${i === 0 ? "bg-[var(--color-brand)]/40" : "bg-[var(--color-line)]"}`} />}
            </div>
          ))}
        </div>

        <div className="mt-6">
          <p className="eyebrow">{alreadySet ? "Security" : "Step 2 of 3"}</p>
          <h1 className="mt-2 text-[28px] font-extrabold leading-[1.1] tracking-[-0.035em]">
            {alreadySet ? "Change your transaction PIN" : "Create your transaction PIN"}
          </h1>
          <p className="mt-2.5 max-w-[440px] text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">
            This 4-digit PIN authorises every transfer and savings withdrawal. It is separate from your password and
            we never store it in readable form.
          </p>
        </div>

        <div className="mt-6 bezel">
          <div className="bezel-core p-5 sm:p-6">
            <form onSubmit={submit} className="space-y-5">
              <div>
                <span className="mb-2 block text-[12px] font-semibold text-[var(--color-ink-soft)]">Choose a PIN</span>
                <PinBoxes label="PIN" value={pin} onChange={setPin} autoFocus />
              </div>

              <div>
                <span className="mb-2 block text-[12px] font-semibold text-[var(--color-ink-soft)]">Enter it again</span>
                <PinBoxes label="Confirm PIN" value={confirm} onChange={setConfirm} />
              </div>

              {error && <Alert tone="error">{error}</Alert>}

              <div className="flex items-start gap-2.5 rounded-[14px] bg-[var(--color-paper)] p-3.5 ring-1 ring-inset ring-[var(--color-line)]">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-ink-faint)]" />
                <p className="text-[11.5px] leading-relaxed text-[var(--color-ink-soft)]">
                  Five wrong attempts lock transfers for 15 minutes. If you forget it, you can reset it later with your
                  password from Settings.
                </p>
              </div>

              <Button type="submit" block size="lg" loading={busy} disabled={!ready} trailing={<ArrowRight className="h-4 w-4" />}>
                {busy ? "Saving" : alreadySet ? "Update PIN" : "Save PIN and continue"}
              </Button>
            </form>
          </div>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11.5px] text-[var(--color-ink-faint)]">
          <ShieldCheck className="h-3.5 w-3.5" /> Stored as a salted hash. Allawii staff cannot see it.
        </p>
      </div>
    </AppShell>
  );
}
