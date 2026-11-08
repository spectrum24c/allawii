import { type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity, ArrowUpRight, LogOut, Settings, ShieldCheck, Sliders, Users, Webhook,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

export type AdminTab = "overview" | "kyc" | "users" | "ledger" | "webhooks" | "settings";

const items: Array<{ key: AdminTab; label: string; icon: typeof Activity }> = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "kyc", label: "KYC queue", icon: ShieldCheck },
  { key: "users", label: "People", icon: Users },
  { key: "ledger", label: "Transactions", icon: Sliders },
  { key: "webhooks", label: "Webhooks", icon: Webhook },
  { key: "settings", label: "Settings", icon: Settings },
];

/**
 * Operations console shell. Deliberately a different room from the student app:
 * dark, dense, no identity gating, no marketing chrome.
 */
export function AdminShell({ active, onChange, pendingKyc, children }: {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
  pendingKyc?: number;
  children: ReactNode;
}) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="admin-root min-h-screen text-[#E9F1EC]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px]">
        {/* rail */}
        <aside className="hidden w-[236px] shrink-0 flex-col border-r border-white/8 px-4 py-6 lg:flex">
          <Link to="/dashboard" className="group flex items-center gap-2.5 px-2 outline-none">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#C8F169] text-[13px] font-black text-[#0A120F] transition-transform duration-500 group-hover:rotate-[-8deg]">A</span>
            <span className="leading-none">
              <span className="block text-[14px] font-semibold tracking-[-0.01em]">Allawii</span>
              <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-[#7E988C]">Operations</span>
            </span>
          </Link>

          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {items.map(({ key, label, icon: Icon }) => {
              const on = active === key;
              return (
                <button
                  key={key}
                  onClick={() => onChange(key)}
                  aria-current={on ? "page" : undefined}
                  className={`group relative flex items-center gap-2.5 rounded-[11px] px-3 py-2.5 text-left text-[13px] transition-colors duration-300 ${
                    on ? "bg-white/[.07] font-semibold text-white" : "text-[#9DB3A8] hover:bg-white/[.04] hover:text-white"
                  }`}
                >
                  <span className={`absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-[#C8F169] transition-opacity duration-300 ${on ? "opacity-100" : "opacity-0"}`} />
                  <Icon className="h-4 w-4" />
                  {label}
                  {key === "kyc" && pendingKyc ? (
                    <span className="ml-auto rounded-full bg-[#C8F169] px-1.5 py-[1px] text-[10.5px] font-bold text-[#0A120F] tnum">{pendingKyc}</span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-6 space-y-1 border-t border-white/8 pt-4">
            <Link to="/dashboard" className="flex items-center gap-2.5 rounded-[11px] px-3 py-2.5 text-[12.5px] text-[#9DB3A8] transition-colors hover:bg-white/[.04] hover:text-white">
              <ArrowUpRight className="h-4 w-4" /> Back to wallet
            </Link>
            <button
              onClick={async () => { await signOut(); navigate("/login"); }}
              className="flex w-full items-center gap-2.5 rounded-[11px] px-3 py-2.5 text-left text-[12.5px] text-[#9DB3A8] transition-colors hover:bg-white/[.04] hover:text-white"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* top bar */}
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/8 bg-[#0A120F]/85 px-4 py-3 backdrop-blur-xl sm:px-6">
            <div className="flex items-center gap-2 lg:hidden">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#C8F169] text-[12px] font-black text-[#0A120F]">A</span>
            </div>
            <p className="text-[12.5px] font-medium text-[#9DB3A8]">
              {items.find((i) => i.key === active)?.label}
            </p>
            <span className="hidden items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[10.5px] font-medium text-[#9DB3A8] sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C8F169]" /> Monnify sandbox
            </span>
            <div className="ml-auto flex items-center gap-2.5">
              <div className="hidden text-right sm:block">
                <p className="text-[12px] font-semibold leading-tight">{profile?.full_name ?? "Admin"}</p>
                <p className="text-[10.5px] text-[#7E988C]">Administrator</p>
              </div>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-[11px] font-bold uppercase">
                {(profile?.full_name ?? "A").slice(0, 2)}
              </span>
            </div>
          </header>

          {/* mobile tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-white/8 px-4 py-2 lg:hidden">
            {items.map(({ key, label }) => (
              <button key={key} onClick={() => onChange(key)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  active === key ? "bg-[#C8F169] text-[#0A120F]" : "text-[#9DB3A8] hover:bg-white/[.05]"
                }`}>{label}</button>
            ))}
          </div>

          <main className="px-4 pb-16 pt-5 sm:px-6 sm:pt-7">{children}</main>
        </div>
      </div>
    </div>
  );
}

/** Dark panel used by every console surface. */
export function Panel({ children, className = "", title, subtitle, action }: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`rounded-[16px] border border-white/8 bg-[#101A16]/90 shadow-[0_1px_0_rgba(255,255,255,.04)_inset] ${className}`}>
      {(title || action) && (
        <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="truncate text-[13px] font-semibold text-white">{title}</h2>}
            {subtitle && <p className="mt-0.5 truncate text-[11.5px] text-[#8AA398]">{subtitle}</p>}
          </div>
          {action && <div className="ml-auto shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone = "default" }: {
  label: string; value: string; sub?: string; tone?: "default" | "warn" | "good";
}) {
  const accent = tone === "warn" ? "text-[#FFCF8B]" : tone === "good" ? "text-[#C8F169]" : "text-white";
  return (
    <div className="console-tile rounded-[14px] border border-white/8 bg-[#101A16] p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#7E988C]">{label}</p>
      <p className={`mt-2 text-[22px] font-semibold tracking-[-0.03em] tnum ${accent}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-[#8AA398]">{sub}</p>}
    </div>
  );
}

export function AdminStatus({ children }: { children: ReactNode }) {
  const map: Record<string, string> = {
    VERIFIED: "border-[#C8F169]/30 bg-[#C8F169]/10 text-[#C8F169]",
    ACTIVE: "border-[#C8F169]/30 bg-[#C8F169]/10 text-[#C8F169]",
    SUCCESSFUL: "border-[#C8F169]/30 bg-[#C8F169]/10 text-[#C8F169]",
    PENDING: "border-[#FFCF8B]/30 bg-[#FFCF8B]/10 text-[#FFCF8B]",
    REVIEW: "border-[#9BC7FF]/30 bg-[#9BC7FF]/10 text-[#9BC7FF]",
    PROCESSED: "border-[#C8F169]/30 bg-[#C8F169]/10 text-[#C8F169]",
    FAILED: "border-[#FF9A8B]/30 bg-[#FF9A8B]/10 text-[#FF9A8B]",
    REJECTED: "border-[#FF9A8B]/30 bg-[#FF9A8B]/10 text-[#FF9A8B]",
    FROZEN: "border-[#FF9A8B]/30 bg-[#FF9A8B]/10 text-[#FF9A8B]",
  };
  const key = String(children).toUpperCase().replace(/ /g, "_");
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[10.5px] font-semibold tracking-wide ${map[key] ?? "border-white/12 bg-white/[.05] text-[#B8CBC1]"}`}>
      {children}
    </span>
  );
}
