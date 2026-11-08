import { type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity, ArrowUpRight, ChevronsUpDown, Cog, FileClock, LogOut, Search, ShieldCheck, Users, Webhook, Wallet,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

export type AdminTab = "overview" | "kyc" | "users" | "ledger" | "webhooks" | "audit" | "settings";

export const adminSections: Array<{ group: string; items: Array<{ key: AdminTab; label: string; icon: typeof Activity }> }> = [
  {
    group: "Monitor",
    items: [
      { key: "overview", label: "Overview", icon: Activity },
      { key: "ledger", label: "Ledger", icon: Wallet },
      { key: "webhooks", label: "Webhooks", icon: Webhook },
      { key: "audit", label: "Audit trail", icon: FileClock },
    ],
  },
  {
    group: "Operate",
    items: [
      { key: "kyc", label: "Verification", icon: ShieldCheck },
      { key: "users", label: "Customers", icon: Users },
    ],
  },
  {
    group: "Platform",
    items: [{ key: "settings", label: "Settings", icon: Cog }],
  },
];

const flat = adminSections.flatMap((s) => s.items);

/**
 * Operations console shell. A deliberate different room from the customer app:
 * dark, dense, keyboard-first, no verification gates, no marketing chrome.
 */
export function AdminShell({ active, onChange, pendingKyc, children }: {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
  pendingKyc?: number;
  children: ReactNode;
}) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const section = flat.find((i) => i.key === active);

  return (
    <div className="admin-root min-h-screen text-[#E8F0EB]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1560px]">
        {/* rail */}
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-white/[.07] px-4 py-5 lg:flex">
          <Link to="/dashboard" className="group flex items-center gap-2.5 px-2 outline-none">
            <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-[9px] bg-[#C9F06A] text-[13px] font-black text-[#080D0B] transition-transform duration-500 group-hover:rotate-[-6deg]">
              A
            </span>
            <span className="leading-none">
              <span className="block text-[13.5px] font-semibold tracking-[-0.01em]">Allawii</span>
              <span className="mt-[3px] block text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[#5F7A6E]">Operations console</span>
            </span>
          </Link>

          <nav className="mt-7 flex flex-1 flex-col gap-6 overflow-y-auto">
            {adminSections.map((section) => (
              <div key={section.group}>
                <p className="px-3 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#4E675C]">{section.group}</p>
                <div className="mt-1.5 flex flex-col gap-[2px]">
                  {section.items.map(({ key, label, icon: Icon }) => {
                    const on = active === key;
                    return (
                      <button
                        key={key}
                        onClick={() => onChange(key)}
                        aria-current={on ? "page" : undefined}
                        className={`group relative flex items-center gap-2.5 rounded-[9px] px-3 py-[9px] text-left text-[12.5px] transition-all duration-300 ${
                          on ? "bg-white/[.06] font-semibold text-white" : "text-[#93A99F] hover:bg-white/[.03] hover:text-white"
                        }`}
                      >
                        <span className={`absolute left-0 top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-full bg-[#C9F06A] transition-all duration-300 ${on ? "opacity-100" : "opacity-0"}`} />
                        <Icon className={`h-[15px] w-[15px] ${on ? "text-[#C9F06A]" : "text-[#6B857A] group-hover:text-[#93A99F]"}`} />
                        {label}
                        {key === "kyc" && pendingKyc ? (
                          <span className="ml-auto rounded-full bg-[#C9F06A] px-1.5 py-[1px] text-[10px] font-bold text-[#080D0B] tnum">{pendingKyc}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-5 space-y-[2px] border-t border-white/[.07] pt-4">
            <Link to="/dashboard" className="flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-[12px] text-[#93A99F] transition-colors hover:bg-white/[.03] hover:text-white">
              <ArrowUpRight className="h-3.5 w-3.5" /> Customer app
            </Link>
            <button
              onClick={async () => { await signOut(); navigate("/login"); }}
              className="flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-left text-[12px] text-[#93A99F] transition-colors hover:bg-white/[.03] hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* command bar */}
          <header className="sticky top-0 z-30 border-b border-white/[.07] bg-[#080D0B]/80 backdrop-blur-xl">
            <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[#C9F06A] text-[11px] font-black text-[#080D0B] lg:hidden">A</span>
              <div className="hidden items-center gap-1.5 text-[12px] sm:flex">
                <span className="text-[#5F7A6E]">Operations</span>
                <span className="text-[#3D534A]">/</span>
                <span className="font-medium text-[#DCE8E1]">{section?.label}</span>
              </div>
              <button
                onClick={() => onChange("users")}
                className="ml-auto flex items-center gap-2 rounded-[8px] border border-white/[.08] bg-white/[.03] px-2.5 py-1.5 text-[11.5px] text-[#7E988C] transition-colors hover:border-white/15 hover:text-white sm:ml-6 sm:w-[240px]"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Search customers</span>
                <kbd className="ml-auto hidden rounded border border-white/10 px-1 py-px text-[9.5px] text-[#5F7A6E] sm:inline">⌘K</kbd>
              </button>
              <div className="ml-auto flex items-center gap-2 sm:ml-3">
                <span className="hidden items-center gap-1.5 rounded-full border border-[#C9F06A]/25 bg-[#C9F06A]/[.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#C9F06A] md:flex">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C9F06A]" /> Sandbox
                </span>
                <button onClick={() => onChange("users")} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-white/[.05]">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[10.5px] font-bold uppercase">
                    {(profile?.full_name ?? "A").slice(0, 2)}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-[11.5px] font-semibold leading-tight">{profile?.full_name ?? "Admin"}</span>
                    <span className="block text-[9.5px] uppercase tracking-[0.1em] text-[#5F7A6E]">Operator</span>
                  </span>
                  <ChevronsUpDown className="hidden h-3 w-3 text-[#5F7A6E] sm:block" />
                </button>
              </div>
            </div>
          </header>

          {/* mobile section switcher */}
          <div className="flex gap-1 overflow-x-auto border-b border-white/[.07] px-4 py-2 lg:hidden">
            {flat.map(({ key, label }) => (
              <button key={key} onClick={() => onChange(key)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                  active === key ? "bg-[#C9F06A] text-[#080D0B]" : "text-[#93A99F] hover:bg-white/[.05]"
                }`}>{label}</button>
            ))}
          </div>

          <main className="px-4 pb-20 pt-5 sm:px-6 sm:pt-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

/* ── console primitives ─────────────────────────────────────────────────── */

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[21px] font-semibold tracking-[-0.03em] text-white sm:text-[23px]">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[#8AA398]">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ children, className = "", title, subtitle, action, flush = false }: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-[13px] border border-white/[.07] bg-[#0E1613] ${className}`}>
      {(title || action) && (
        <div className="flex items-center gap-3 border-b border-white/[.07] px-4 py-2.5">
          <div className="min-w-0">
            {title && <h2 className="truncate text-[12px] font-semibold uppercase tracking-[0.1em] text-[#B9CCC2]">{title}</h2>}
            {subtitle && <p className="mt-0.5 truncate text-[11px] text-[#6B857A]">{subtitle}</p>}
          </div>
          {action && <div className="ml-auto shrink-0">{action}</div>}
        </div>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone = "default", icon }: {
  label: string; value: string; sub?: string; tone?: "default" | "warn" | "good" | "bad"; icon?: ReactNode;
}) {
  const accent = tone === "warn" ? "text-[#F0C572]" : tone === "good" ? "text-[#C9F06A]" : tone === "bad" ? "text-[#F09A8B]" : "text-white";
  return (
    <div className="console-tile group relative overflow-hidden rounded-[13px] border border-white/[.07] bg-[#0E1613] p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#6B857A]">{label}</p>
        {icon && <span className="text-[#3F564C] transition-colors duration-300 group-hover:text-[#C9F06A]">{icon}</span>}
      </div>
      <p className={`mt-2.5 text-[24px] font-semibold leading-none tracking-[-0.04em] tnum ${accent}`}>{value}</p>
      {sub && <p className="mt-1.5 text-[10.5px] leading-snug text-[#6B857A]">{sub}</p>}
    </div>
  );
}

const statusMap: Record<string, string> = {
  VERIFIED: "border-[#C9F06A]/25 bg-[#C9F06A]/[.08] text-[#C9F06A]",
  ACTIVE: "border-[#C9F06A]/25 bg-[#C9F06A]/[.08] text-[#C9F06A]",
  SUCCESSFUL: "border-[#C9F06A]/25 bg-[#C9F06A]/[.08] text-[#C9F06A]",
  PROCESSED: "border-[#C9F06A]/25 bg-[#C9F06A]/[.08] text-[#C9F06A]",
  PENDING: "border-[#F0C572]/25 bg-[#F0C572]/[.08] text-[#F0C572]",
  REVIEW: "border-[#93C5FD]/25 bg-[#93C5FD]/[.08] text-[#93C5FD]",
  FAILED: "border-[#F09A8B]/25 bg-[#F09A8B]/[.08] text-[#F09A8B]",
  REJECTED: "border-[#F09A8B]/25 bg-[#F09A8B]/[.08] text-[#F09A8B]",
  FROZEN: "border-[#F09A8B]/25 bg-[#F09A8B]/[.08] text-[#F09A8B]",
};

export function Status({ children }: { children: ReactNode }) {
  const key = String(children).toUpperCase().replace(/ /g, "_");
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-[5px] border px-1.5 py-[1px] text-[9.5px] font-semibold uppercase tracking-[0.06em] ${statusMap[key] ?? "border-white/10 bg-white/[.04] text-[#9DB3A8]"}`}>
      {children}
    </span>
  );
}

export const consoleBtn = {
  primary: "inline-flex items-center justify-center gap-1.5 rounded-[8px] bg-[#C9F06A] px-3 py-[7px] text-[11.5px] font-semibold text-[#080D0B] transition-all duration-300 hover:brightness-105 active:scale-[.985] disabled:opacity-40",
  ghost: "inline-flex items-center justify-center gap-1.5 rounded-[8px] border border-white/[.1] px-3 py-[7px] text-[11.5px] font-medium text-[#C9D9D0] transition-colors hover:border-white/20 hover:bg-white/[.04] disabled:opacity-40",
  danger: "inline-flex items-center justify-center gap-1.5 rounded-[8px] border border-[#F09A8B]/25 bg-[#F09A8B]/[.07] px-3 py-[7px] text-[11.5px] font-semibold text-[#F09A8B] transition-colors hover:bg-[#F09A8B]/[.12] disabled:opacity-40",
};

export function Row({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid items-center gap-3 border-b border-white/[.05] px-4 py-2.5 transition-colors last:border-0 hover:bg-white/[.025] ${className}`}>{children}</div>;
}
