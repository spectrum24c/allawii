import { useEffect, useState } from "react";
import { LifeBuoy, Plus, Send } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, useToast } from "../../components/ui";
import { actions, getTicketMessages, getTickets } from "../../lib/api";
import { humanError } from "../../lib/errors";
import { formatDateTime, timeAgo } from "../../lib/format";
import type { Ticket } from "../../lib/types";

export default function Support() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [active, setActive] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Array<{ id: string; body: string; author_role: string; created_at: string }>>([]);
  const [reply, setReply] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "payments", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();

  async function load() {
    try { setTickets(await getTickets()); } catch { setTickets([]); }
  }
  useEffect(() => { load(); }, []);

  async function openTicket(t: Ticket) {
    setActive(t);
    try { setMessages(await getTicketMessages(t.id)); } catch { setMessages([]); }
  }

  async function create() {
    setError(null);
    setBusy(true);
    try {
      const t = await actions.createTicket(form.subject, form.category, form.message);
      setOpen(false);
      setForm({ subject: "", category: "payments", message: "" });
      await load();
      await openTicket(t);
      push({ tone: "success", title: "Ticket created", body: t.reference ?? undefined });
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!active || !reply.trim()) return;
    try {
      await actions.replyTicket(active.id, reply.trim());
      setReply("");
      setMessages(await getTicketMessages(active.id));
      await load();
    } catch (err) {
      push({ tone: "error", title: "Could not send", body: humanError(err) });
    }
  }

  return (
    <AppShell>
      <div className="rise">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[24px] tracking-[-0.02em]">Support</h1>
            <p className="mt-1 text-[13.5px] text-[var(--color-ink-soft)]">Tickets carry your account context, so we can actually help.</p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New ticket</Button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="h-fit overflow-hidden">
            {tickets === null ? (
              <Spinner label="" />
            ) : tickets.length === 0 ? (
              <div className="p-2"><EmptyState icon={<LifeBuoy className="h-5 w-5" />} title="No tickets" body="Open one if something looks wrong with a payment or your account." /></div>
            ) : (
              <div className="divide-y divide-[var(--color-line)]">
                {tickets.map((t) => (
                  <button key={t.id} onClick={() => openTicket(t)} className={`block w-full px-4 py-3 text-left hover:bg-[#fafaf7] ${active?.id === t.id ? "bg-[var(--color-brand-soft)]/40" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[13px] font-medium">{t.subject}</p>
                      <Badge tone={t.status}>{t.status}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--color-ink-soft)]">{t.reference} · {timeAgo(t.created_at)}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="flex min-h-[320px] flex-col p-5">
            {!active ? (
              <div className="flex flex-1 items-center justify-center">
                <EmptyState title="Pick a ticket" body="Or open a new one and describe what happened, including the reference if you have it." />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] pb-3">
                  <div>
                    <p className="text-[14px] font-semibold">{active.subject}</p>
                    <p className="text-[11.5px] text-[var(--color-ink-soft)]">{active.reference} · opened {formatDateTime(active.created_at)}</p>
                  </div>
                  <Badge tone={active.status}>{active.status}</Badge>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto py-4">
                  {messages.length === 0 && <p className="text-[12.5px] text-[var(--color-ink-soft)]">No messages yet.</p>}
                  {messages.map((m) => (
                    <div key={m.id} className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed ${m.author_role === "student" ? "ml-auto bg-[var(--color-brand)] text-white" : "bg-[var(--color-paper)]"}`}>
                      {m.body}
                      <p className={`mt-1 text-[10.5px] ${m.author_role === "student" ? "text-white/70" : "text-[var(--color-ink-soft)]"}`}>{timeAgo(m.created_at)}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 border-t border-[var(--color-line)] pt-3">
                  <Input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendReply()} placeholder="Write a reply…" />
                  <Button size="sm" onClick={sendReply} disabled={!reply.trim()} aria-label="Send reply"><Send className="h-3.5 w-3.5" /></Button>
                </div>
              </>
            )}
          </Card>
        </div>

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="New support ticket"
          footer={<><Button variant="secondary" block onClick={() => setOpen(false)}>Cancel</Button><Button block loading={busy} onClick={create} disabled={!form.subject.trim()}>Create</Button></>}
        >
          <div className="space-y-4">
            <Field label="Subject" htmlFor="subject">
              <Input id="subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Transfer not received" maxLength={80} />
            </Field>
            <Field label="Category">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {["payments", "transfers", "kyc", "account", "other"].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
              </Select>
            </Field>
            <Field label="What happened?" htmlFor="message">
              <textarea id="message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={4} className="w-full rounded-xl border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-sm focus:border-[var(--color-brand)] focus:outline-none focus:ring-4 focus:ring-[var(--color-brand)]/10"
                placeholder="Include the transaction reference if you have one." />
            </Field>
            {error && <p className="rounded-lg bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[var(--color-danger)]">{error}</p>}
            <p className="text-[11px] text-[var(--color-ink-soft)]">Never include your BVN, PIN or card details in a ticket.</p>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
