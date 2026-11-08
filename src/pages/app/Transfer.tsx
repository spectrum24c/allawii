import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Check, Info, Plus, Trash2, UserRound } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, useToast } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { actions, deleteBeneficiary, getBanks, getBeneficiaries } from "../../lib/api";
import { humanError } from "../../lib/errors";
import { naira, toMinor } from "../../lib/format";
import type { Bank, Beneficiary, Transaction } from "../../lib/types";

type Step = "beneficiary" | "amount" | "authorise" | "done";

export default function Transfer() {
  const { wallet, kyc, limits, refresh } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[] | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selected, setSelected] = useState<Beneficiary | null>(null);
  const [step, setStep] = useState<Step>("beneficiary");
  const [addOpen, setAddOpen] = useState(false);

  // add-beneficiary form
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveNote, setResolveNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // amount + quote
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Record<string, number> | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [narration, setNarration] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ simulated?: boolean; message?: string; transaction: Transaction } | null>(null);

  const verified = kyc?.kyc_status === "VERIFIED";
  const minor = toMinor(amount);

  useEffect(() => {
    getBeneficiaries().then(setBeneficiaries).catch(() => setBeneficiaries([]));
    getBanks().then(setBanks).catch(() => setBanks([]));
  }, []);

  useEffect(() => {
    if (step !== "amount" || minor < 100) { setQuote(null); return; }
    setQuoting(true);
    const t = setTimeout(() => {
      actions.quote(minor).then(setQuote).catch(() => setQuote(null)).finally(() => setQuoting(false));
    }, 350);
    return () => clearTimeout(t);
  }, [minor, step]);

  async function resolveName() {
    setResolveNote(null);
    if (!/^[0-9]{10}$/.test(accountNumber)) return setResolveNote("Enter the 10-digit account number.");
    if (!bankCode) return setResolveNote("Pick the beneficiary's bank.");
    setResolving(true);
    try {
      const res = await actions.nameEnquiry(accountNumber, bankCode);
      if (res.resolved && res.account_name) {
        setAccountName(res.account_name);
        setResolveNote(null);
        push({ tone: "success", title: "Account name found", body: res.account_name });
      } else {
        setResolveNote(res.message ?? "We could not resolve that account. Confirm the details with the recipient.");
      }
    } catch (err) {
      setResolveNote(humanError(err));
    } finally {
      setResolving(false);
    }
  }

  async function saveBeneficiary() {
    setError(null);
    if (!accountName.trim()) return setError("Confirm the account name first.");
    const bank = banks.find((b) => b.code === bankCode);
    setSaving(true);
    try {
      const ben = await actions.addBeneficiary(bankCode, bank?.name ?? "Bank", accountNumber, accountName, Boolean(accountName) && !resolveNote);
      setBeneficiaries((prev) => [ben, ...(prev ?? []).filter((b) => b.id !== ben.id)]);
      setSelected(ben);
      setAddOpen(false);
      setAccountNumber(""); setAccountName(""); setBankCode(""); setResolveNote(null);
    } catch (err) {
      setError(humanError(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(ben: Beneficiary) {
    try {
      await deleteBeneficiary(ben.id);
      setBeneficiaries((prev) => (prev ?? []).filter((b) => b.id !== ben.id));
      if (selected?.id === ben.id) setSelected(null);
      push({ tone: "success", title: "Beneficiary removed" });
    } catch (err) {
      push({ tone: "error", title: "Could not remove", body: humanError(err) });
    }
  }

  async function submitTransfer() {
    if (!selected) return;
    setError(null);
    if (!/^[0-9]{4}$/.test(pin)) return setError("Your transaction PIN is 4 digits.");
    setBusy(true);
    try {
      const tx = await actions.transfer(selected.id, minor, narration, pin);
      // Server-side call to the provider. The ledger hold already exists.
      const settled = await actions.disburse(tx.id);
      setResult({ simulated: settled.simulated, message: settled.message, transaction: settled.transaction });
      setStep("done");
      setPin("");
      await refresh();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl rise">
        <button onClick={() => (step === "beneficiary" ? navigate("/dashboard") : setStep(step === "authorise" ? "amount" : "beneficiary"))}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--color-ink-soft)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <h1 className="mt-2 text-[24px] tracking-[-0.02em]">Send money</h1>
        <p className="mt-1 text-[13.5px] text-[var(--color-ink-soft)]">
          Available <span className="font-semibold text-[var(--color-ink)] tnum">{naira(wallet?.available_minor)}</span>
          {limits && <> · max {naira(limits.max_transfer_minor)} per transfer</>}
        </p>

        {!verified && (
          <Card className="mt-4 border-[#f3e0c0] bg-[#fdf6e9] p-4">
            <p className="text-[13px] font-semibold text-[#7a4a10]">Verify your identity to send money</p>
            <Link to="/kyc"><Button size="sm" className="mt-2.5">Go to KYC</Button></Link>
          </Card>
        )}

        {/* step indicator */}
        <div className="mt-5 flex items-center gap-2">
          {["Recipient", "Amount", "Authorise"].map((label, i) => {
            const active = (step === "beneficiary" && i === 0) || (step === "amount" && i === 1) || (step === "authorise" && i === 2) || step === "done";
            return (
              <div key={label} className="flex flex-1 items-center gap-2">
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${active ? "bg-[var(--color-brand)] text-white" : "bg-[#ecece7] text-[var(--color-ink-soft)]"}`}>{i + 1}</span>
                <span className={`text-[11.5px] font-medium ${active ? "text-[var(--color-ink)]" : "text-[var(--color-ink-soft)]"}`}>{label}</span>
                {i < 2 && <span className="h-px flex-1 bg-[var(--color-line)]" />}
              </div>
            );
          })}
        </div>

        {/* STEP 1 */}
        {step === "beneficiary" && (
          <Card className="mt-4 p-5">
            <div className="flex items-center justify-between">
              <p className="text-[13.5px] font-semibold">Who are you paying?</p>
              <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}><Plus className="h-3.5 w-3.5" /> New</Button>
            </div>

            <div className="mt-3">
              {beneficiaries === null ? (
                <Spinner label="" />
              ) : beneficiaries.length === 0 ? (
                <EmptyState icon={<UserRound className="h-5 w-5" />} title="No saved recipients" body="Add a bank account. We verify the name with the bank before you send anything." action={<Button size="sm" onClick={() => setAddOpen(true)}>Add recipient</Button>} />
              ) : (
                <div className="space-y-2">
                  {beneficiaries.map((b) => (
                    <div key={b.id} className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${selected?.id === b.id ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]/40" : "border-[var(--color-line)]"}`}>
                      <button onClick={() => { setSelected(b); setStep("amount"); }} className="flex flex-1 items-center gap-3 text-left">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-[12px] font-semibold text-[var(--color-ink-soft)] ring-1 ring-[var(--color-line)]">
                          {b.account_name?.slice(0, 2).toUpperCase() ?? "AL"}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 truncate text-[13.5px] font-medium">
                            {b.account_name ?? "Unverified account"}
                            {b.status === "VERIFIED" && <BadgeCheck className="h-3.5 w-3.5 text-[var(--color-brand)]" />}
                          </span>
                          <span className="block truncate text-[11.5px] text-[var(--color-ink-soft)]">{b.bank_name} · {b.account_number_masked}</span>
                        </span>
                      </button>
                      <button onClick={() => remove(b)} aria-label="Remove beneficiary" className="rounded-lg p-2 text-[var(--color-ink-soft)] hover:bg-black/5">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* STEP 2 */}
        {step === "amount" && selected && (
          <Card className="mt-4 p-5">
            <div className="rounded-xl bg-[var(--color-paper)] p-3">
              <p className="text-[13px] font-semibold">{selected.account_name}</p>
              <p className="text-[11.5px] text-[var(--color-ink-soft)]">{selected.bank_name} · {selected.account_number_masked}</p>
            </div>

            <div className="mt-4">
              <Field label="Amount" htmlFor="amount" hint={limits ? `Minimum ${naira(limits.min_transfer_minor)}` : undefined}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-ink-soft)]">₦</span>
                  <Input id="amount" inputMode="decimal" className="pl-7 text-[18px] font-semibold tnum" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Narration" htmlFor="note" hint="Shows on both statements">
                <Input id="note" maxLength={60} value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. Rent top-up" />
              </Field>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--color-line)] p-3 text-[12.5px]">
              {quoting ? <p className="text-[var(--color-ink-soft)]">Calculating…</p> : quote ? (
                <dl className="space-y-1.5">
                  <Row k="Amount" v={naira(quote.amount_minor)} />
                  <Row k="Fee" v={quote.fee_minor ? naira(quote.fee_minor) : "Free"} />
                  <div className="border-t border-[var(--color-line)] pt-1.5"><Row k="Total debit" v={naira(quote.total_minor)} bold /></div>
                  <Row k="Available after" v={naira(Math.max(0, quote.available_minor - quote.total_minor))} muted />
                  <Row k="Daily limit used" v={`${naira(quote.daily_used_minor)} of ${naira(quote.daily_limit_minor)}`} muted />
                </dl>
              ) : (
                <p className="text-[var(--color-ink-soft)]">Enter an amount to see the exact debit.</p>
              )}
            </div>

            {error && <p className="mt-3 rounded-lg bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[var(--color-danger)]">{error}</p>}

            <Button block className="mt-4" disabled={!quote || minor < (limits?.min_transfer_minor ?? 10000)} onClick={() => { setError(null); setStep("authorise"); }}>
              Continue
            </Button>
          </Card>
        )}

        {/* STEP 3 */}
        {step === "authorise" && selected && quote && (
          <Card className="mt-4 p-5">
            <p className="text-[13.5px] font-semibold">Authorise with your PIN</p>
            <p className="mt-1 text-[12.5px] text-[var(--color-ink-soft)]">
              You are sending <span className="font-semibold text-[var(--color-ink)] tnum">{naira(quote.amount_minor)}</span> to {selected.account_name}.
            </p>

            <div className="mt-4">
              <Field label="4-digit transaction PIN" htmlFor="pin" hint="Five wrong attempts locks transfers for 15 minutes">
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className="text-center text-[20px] tracking-[0.6em] tnum"
                />
              </Field>
            </div>

            {error && <p className="mt-3 rounded-lg bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[var(--color-danger)]">{error}</p>}

            <Button block className="mt-4" loading={busy} onClick={submitTransfer} disabled={pin.length !== 4}>
              Send {naira(quote.amount_minor)}
            </Button>
            <p className="mt-3 flex items-start gap-1.5 text-[11.5px] text-[var(--color-ink-soft)]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              The amount is held the moment you confirm. If the bank fails the transfer, the hold is released automatically.
            </p>
            <Link to="/settings" className="mt-1 inline-block text-[11.5px] font-semibold text-[var(--color-brand-dark)]">No PIN yet? Set one in Security</Link>
          </Card>
        )}

        {/* DONE */}
        {step === "done" && result && (
          <Card className="mt-4 p-6 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--color-brand-soft)]">
              <Check className="h-5 w-5 text-[var(--color-brand-dark)]" />
            </span>
            <p className="mt-4 text-[15px] font-semibold">
              {result.simulated ? "Simulated transfer recorded" : "Transfer submitted"}
            </p>
            <p className="mt-1 text-[13px] text-[var(--color-ink-soft)]">
              {naira(result.transaction.amount_minor)} to {String(result.transaction.metadata?.account_name ?? selected?.account_name ?? "recipient")}
            </p>
            {result.simulated && (
              <p className="mx-auto mt-3 max-w-sm rounded-xl bg-[var(--color-paper)] p-3 text-[11.5px] leading-relaxed text-[var(--color-ink-soft)]">
                {result.message ?? "No live payment keys are configured, so this transfer was simulated. No money left any bank account."}
              </p>
            )}
            <p className="mt-3 font-mono text-[11px] text-[var(--color-ink-soft)]">{result.transaction.client_reference}</p>
            <div className="mt-5 flex justify-center gap-2">
              <Link to="/transactions"><Button size="sm" variant="secondary">See transactions</Button></Link>
              <Button size="sm" onClick={() => { setStep("beneficiary"); setAmount(""); setResult(null); setSelected(null); }}>Send another</Button>
            </div>
          </Card>
        )}

        {/* add beneficiary modal */}
        <Modal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          title="Add a recipient"
          footer={<><Button variant="secondary" block onClick={() => setAddOpen(false)}>Cancel</Button><Button block loading={saving} onClick={saveBeneficiary} disabled={!accountName.trim()}>Save</Button></>}
        >
          <div className="space-y-4">
            <Field label="Bank">
              <Select value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
                <option value="">Select a bank</option>
                {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Account number" hint="10 digits">
              <Input inputMode="numeric" maxLength={10} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} placeholder="0123456789" />
            </Field>
            <Button variant="secondary" block loading={resolving} onClick={resolveName} disabled={accountNumber.length !== 10 || !bankCode}>
              Verify account name
            </Button>
            <Field label="Account name" hint={resolveNote ? undefined : "Auto-filled when the bank responds"}>
              <Input value={accountName} onChange={(e) => setAccountName(e.target.value.toUpperCase())} placeholder="Account holder name" />
            </Field>
            {resolveNote && <p className="rounded-lg bg-[#fdf6e9] px-3 py-2 text-[12px] text-[#7a4a10]">{resolveNote}</p>}
            {error && <p className="rounded-lg bg-[#fdeceb] px-3 py-2 text-[12px] text-[var(--color-danger)]">{error}</p>}
            <Badge tone="PENDING">Unverified labels are kept until the bank confirms</Badge>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}

function Row({ k, v, bold, muted }: { k: string; v: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? "text-[var(--color-ink-soft)]" : ""}>{k}</dt>
      <dd className={`tnum ${bold ? "font-semibold" : "font-medium"} ${muted ? "text-[var(--color-ink-soft)]" : ""}`}>{v}</dd>
    </div>
  );
}
