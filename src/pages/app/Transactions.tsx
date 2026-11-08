import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Receipt, Search } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge, Button, Card, EmptyState, Input, Select, Spinner } from "../../components/ui";
import { getTransactions } from "../../lib/api";
import { formatDateTime, naira, titleCase } from "../../lib/format";
import type { Transaction } from "../../lib/types";

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");

  useEffect(() => {
    getTransactions({ limit: 100 }).then(setTxs).catch(() => setTxs([]));
  }, []);

  const filtered = useMemo(() => {
    return (txs ?? []).filter((t) => {
      if (type !== "ALL" && t.type !== type) return false;
      if (status !== "ALL" && t.status !== status) return false;
      if (q) {
        const hay = `${t.client_reference} ${t.narration ?? ""} ${t.provider_reference ?? ""} ${t.amount_minor}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [txs, type, status, q]);

  const totals = useMemo(() => {
    const list = txs ?? [];
    return {
      in: list.filter((t) => t.type === "DEPOSIT" && t.status === "SUCCESSFUL").reduce((s, t) => s + t.amount_minor, 0),
      out: list.filter((t) => t.type === "TRANSFER" && t.status === "SUCCESSFUL").reduce((s, t) => s + t.amount_minor, 0),
    };
  }, [txs]);

  return (
    <AppShell>
      <div className="rise">
        <h1 className="text-[24px] tracking-[-0.02em]">Transactions</h1>
        <p className="mt-1 text-[13.5px] text-[var(--color-ink-soft)]">
          {naira(totals.in)} in · {naira(totals.out)} out · includes pending holds
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-soft)]" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reference or narration" className="pl-9" />
          </div>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto">
            {["ALL", "DEPOSIT", "TRANSFER", "SAVINGS", "ADJUSTMENT", "FEE", "REVERSAL", "REFUND"].map((t) => (
              <option key={t} value={t}>{t === "ALL" ? "All types" : titleCase(t)}</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
            {["ALL", "SUCCESSFUL", "PENDING", "PROCESSING", "FAILED", "CANCELLED", "REVERSED"].map((s) => (
              <option key={s} value={s}>{s === "ALL" ? "All statuses" : titleCase(s)}</option>
            ))}
          </Select>
        </div>

        <Card className="mt-4 overflow-hidden">
          {txs === null ? (
            <Spinner />
          ) : filtered.length === 0 ? (
            <div className="p-2">
              <EmptyState
                icon={<Receipt className="h-5 w-5" />}
                title={txs.length === 0 ? "No transactions yet" : "Nothing matches those filters"}
                body={txs.length === 0 ? "Fund your wallet to create your first entry." : "Try a different type, status or search term."}
                action={txs.length === 0 ? <Link to="/deposit"><Button size="sm">Add money</Button></Link> : undefined}
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-line)]">
              {filtered.map((t) => {
                const credit = ["DEPOSIT", "REVERSAL", "REFUND"].includes(t.type) || (t.type === "SAVINGS" && /withdraw|releas|closed/i.test(t.narration ?? ""));
                return (
                  <Link key={t.id} to={`/transactions/${t.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#fafaf7]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{t.narration ?? titleCase(t.type)}</p>
                      <p className="truncate text-[11.5px] text-[var(--color-ink-soft)]">
                        {titleCase(t.type)} · {formatDateTime(t.created_at)}
                      </p>
                      <p className="truncate font-mono text-[10.5px] text-[var(--color-ink-soft)]/70">{t.client_reference}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-[13.5px] font-semibold tnum ${credit ? "text-[var(--color-brand-dark)]" : ""}`}>
                        {credit ? "+" : "−"}{naira(t.amount_minor)}
                      </p>
                      <Badge tone={t.status} className="mt-0.5">{t.status}</Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
