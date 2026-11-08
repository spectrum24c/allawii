import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Copy, Download, XCircle } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge, Button, Card, Spinner, useToast } from "../../components/ui";
import { actions, getTransaction } from "../../lib/api";
import { humanError } from "../../lib/errors";
import { formatDateTime, naira, titleCase } from "../../lib/format";
import { useAuth } from "../../hooks/useAuth";
import type { Transaction } from "../../lib/types";

export default function TransactionDetail() {
  const { id = "" } = useParams();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();
  const { refresh } = useAuth();

  useEffect(() => { getTransaction(id).then(setTx).catch(() => setTx(null)); }, [id]);

  async function cancel() {
    if (!tx) return;
    setBusy(true);
    try {
      await actions.cancelTransfer(tx.id);
      setTx(await getTransaction(tx.id));
      await refresh();
      push({ tone: "success", title: "Transfer cancelled", body: "The hold was released back to your wallet." });
    } catch (err) {
      push({ tone: "error", title: "Could not cancel", body: humanError(err) });
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => push({ tone: "success", title: "Copied" }));
  }

  if (!tx) return <AppShell><Spinner /></AppShell>;

  const credit = ["DEPOSIT", "REVERSAL", "REFUND"].includes(tx.type) || (tx.type === "SAVINGS" && /withdraw|releas|closed/i.test(tx.narration ?? ""));
  const settled = ["SUCCESSFUL", "FAILED", "REVERSED", "CANCELLED"].includes(tx.status);

  return (
    <AppShell>
      <div className="mx-auto max-w-xl rise">
        <Link to="/transactions" className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--color-ink-soft)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Transactions
        </Link>

        <Card className="mt-3 overflow-hidden">
          <div className="border-b border-[var(--color-line)] bg-[var(--color-paper)] px-5 py-6 text-center">
            <span className={`mx-auto grid h-11 w-11 place-items-center rounded-full ${tx.status === "SUCCESSFUL" ? "bg-[var(--color-brand-soft)]" : tx.status === "FAILED" ? "bg-[#fdeceb]" : "bg-[#fef4e6]"}`}>
              {tx.status === "SUCCESSFUL" ? <Check className="h-5 w-5 text-[var(--color-brand-dark)]" /> : tx.status === "FAILED" ? <XCircle className="h-5 w-5 text-[var(--color-danger)]" /> : <Check className="h-5 w-5 text-[var(--color-warn)]" />}
            </span>
            <p className="mt-3 text-[28px] font-semibold tracking-[-0.02em] tnum">
              {credit ? "+" : "−"}{naira(tx.amount_minor)}
            </p>
            <p className="mt-1 text-[12.5px] text-[var(--color-ink-soft)]">{tx.narration ?? titleCase(tx.type)}</p>
            <div className="mt-2 flex justify-center gap-2">
              <Badge tone={tx.status}>{tx.status}</Badge>
              <Badge>{titleCase(tx.type)}</Badge>
            </div>
          </div>

          <dl className="divide-y divide-[var(--color-line)] px-5 text-[12.5px]">
            {[
              ["Reference", tx.client_reference],
              ["Provider reference", tx.provider_reference ?? "—"],
              ["Provider", tx.provider ? titleCase(tx.provider) : "Allawii ledger"],
              ["Fee", tx.fee_minor ? naira(tx.fee_minor) : "₦0.00"],
              ["Started", formatDateTime(tx.created_at)],
              ["Completed", tx.completed_at ? formatDateTime(tx.completed_at) : "—"],
              ["Recipient", tx.metadata?.account_name ? `${tx.metadata.account_name} · ${tx.metadata.bank_name ?? ""} ${tx.metadata.account_number_masked ?? ""}` : "—"],
            ].filter(([, v]) => v !== "—" || true).map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 py-2.5">
                <dt className="text-[var(--color-ink-soft)]">{k}</dt>
                <dd className="max-w-[62%] break-words text-right font-medium">{v}</dd>
              </div>
            ))}
            {tx.failure_reason && (
              <div className="py-2.5">
                <dt className="text-[var(--color-ink-soft)]">Failure reason</dt>
                <dd className="mt-1 rounded-lg bg-[#fdeceb] px-3 py-2 text-[var(--color-danger)]">{tx.failure_reason}</dd>
              </div>
            )}
          </dl>

          <div className="flex flex-wrap gap-2 border-t border-[var(--color-line)] px-5 py-3.5">
            <Button size="sm" variant="secondary" onClick={() => copy(tx.client_reference)}><Copy className="h-3.5 w-3.5" /> Copy reference</Button>
            <Button size="sm" variant="ghost" onClick={() => window.print()}><Download className="h-3.5 w-3.5" /> Save receipt</Button>
            {tx.type === "TRANSFER" && tx.status === "PENDING" && (
              <Button size="sm" variant="danger" loading={busy} onClick={cancel}>Cancel transfer</Button>
            )}
          </div>
        </Card>

        <p className="mt-4 px-1 text-[11.5px] leading-relaxed text-[var(--color-ink-soft)]">
          {settled
            ? "This receipt is a record of a settled entry in the Allawii ledger. It cannot be edited."
            : "This entry is still in flight. The amount is held and will be released automatically if the provider fails it."}
        </p>
      </div>
    </AppShell>
  );
}
