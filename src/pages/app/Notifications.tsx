import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge, Button, Card, EmptyState, Spinner, useToast } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { actions, getNotifications } from "../../lib/api";
import { humanError } from "../../lib/errors";
import { timeAgo } from "../../lib/format";
import type { Notification } from "../../lib/types";

export default function Notifications() {
  const [items, setItems] = useState<Notification[] | null>(null);
  const { refresh } = useAuth();
  const { push } = useToast();

  async function load() {
    try { setItems(await getNotifications()); } catch { setItems([]); }
  }
  useEffect(() => { load(); }, []);

  async function markAll() {
    try {
      await actions.markNotificationsRead();
      await load();
      await refresh();
      push({ tone: "success", title: "All caught up" });
    } catch (err) {
      push({ tone: "error", title: "Could not update", body: humanError(err) });
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl rise">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[24px] tracking-[-0.02em]">Notifications</h1>
            <p className="mt-1 text-[13.5px] text-[var(--color-ink-soft)]">Payment, security and savings alerts.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={markAll}><CheckCheck className="h-3.5 w-3.5" /> Mark all read</Button>
        </div>

        <Card className="mt-5 divide-y divide-[var(--color-line)]">
          {items === null ? (
            <Spinner />
          ) : items.length === 0 ? (
            <div className="p-2"><EmptyState icon={<Bell className="h-5 w-5" />} title="Nothing yet" body="You will see payment and security updates here." /></div>
          ) : items.map((n) => (
            <Link key={n.id} to={n.link ?? "/dashboard"} className={`block px-4 py-3.5 hover:bg-[#fafaf7] ${n.read_at ? "" : "bg-[var(--color-brand-soft)]/25"}`}>
              <div className="flex items-start gap-3">
                {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-brand)]" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-[13.5px] font-medium">{n.title}</p>
                    <span className="shrink-0 text-[11px] text-[var(--color-ink-soft)]">{timeAgo(n.created_at)}</span>
                  </div>
                  {n.body && <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--color-ink-soft)]">{n.body}</p>}
                  <Badge className="mt-1.5">{n.type}</Badge>
                </div>
              </div>
            </Link>
          ))}
        </Card>
      </div>
    </AppShell>
  );
}
