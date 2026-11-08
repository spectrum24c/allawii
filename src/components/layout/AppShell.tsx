import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Bell, ChevronDown, CreditCard, Home, LifeBuoy, LogOut, PiggyBank,
  Receipt, Settings, Shield, ShieldCheck, Send, Wallet, Menu, X,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { naira, initials } from "../../lib/format";
import { Badge, Button } from "../ui";
import { actions } from "../../lib/api";

const nav = [
  { to: "/dashboard", label: "Overview", icon: Home },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/transfer", label: "Send money", icon: Send },
  { to: "/savings", label: "Savings", icon: PiggyBank },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/support", label: "Support", icon: LifeBuoy },
];

const mobileNav = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/transfer", label: "Send", icon: Send },
  { to: "/savings", label: "Savings", icon: PiggyBank },
  { to: "/transactions", label: "History", icon: Receipt },
];

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--color-brand)]">
        <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden><path d="M9 23 16 9l7 14h-4.2l-2.8-6-2.8 6z" fill="var(--color-lime)" /></svg>
      </span>
      {!compact && <span className="text-[17px] font-semibold tracking-[-0.02em]">Allawii</span>}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, wallet, kyc, role, unread, signOut } = useAuth();
  // Operators are not customers: the console must never nag them for an identity check.
  const isOperator = role !== "student";
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { setMenuOpen(false); setUserMenu(false); }, [location.pathname]);

  // A wallet without a transaction PIN cannot move money, so finish that step
  // before anything else in the app is reachable.
  useEffect(() => {
    let alive = true;
    actions.securityStatus()
      .then((s) => {
        if (alive && s && !s.pin_set && !isOperator && location.pathname !== "/security-setup") {
          navigate("/security-setup", { replace: true });
        }
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOperator]);

  const kycIncomplete = !isOperator && (!kyc || kyc.kyc_status !== "VERIFIED");

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] flex-col border-r border-[var(--color-line)] bg-white px-4 py-5 lg:flex">
        <div className="px-2"><Logo /></div>

        <nav className="mt-7 flex flex-1 flex-col gap-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-[13px] px-3 py-2.5 text-[13px] font-semibold transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)] ${
                  isActive ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]" : "text-[var(--color-ink-soft)] hover:bg-black/[.035] hover:text-[var(--color-ink)]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-4 w-4 transition-transform duration-300 ${isActive ? "" : "group-hover:scale-105"}`} />
                  {label}
                  {isActive && <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />}
                </>
              )}
            </NavLink>
          ))}
          {role !== "student" && (
            <NavLink to="/admin" className={({ isActive }) =>
              `flex items-center gap-3 rounded-[13px] px-3 py-2.5 text-[13px] font-semibold transition-all duration-300 ${
                isActive ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]" : "text-[var(--color-ink-soft)] hover:bg-black/[.035] hover:text-[var(--color-ink)]"
              }`}>
              <Shield className="h-4 w-4" /> Admin
            </NavLink>
          )}
        </nav>

        <div className="panel-forest grain rounded-[16px] p-4">
          <p className="text-[9.5px] font-bold uppercase tracking-[.16em] text-white/45">Available</p>
          <p className="mt-1 text-[19px] font-extrabold tracking-[-0.03em] text-white tnum">{naira(wallet?.available_minor)}</p>
          <Link to="/wallet" className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-[var(--color-lime)] ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/15">
            <CreditCard className="h-3 w-3" /> Fund wallet
          </Link>
        </div>

        <div className="mt-3 flex items-center gap-1">
          <Link to="/settings" className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-[var(--color-ink-soft)] hover:bg-black/[.03]">
            <Settings className="h-4 w-4" /> Settings
          </Link>
          <button onClick={() => signOut().then(() => navigate("/"))} className="rounded-xl p-2 text-[var(--color-ink-soft)] hover:bg-black/[.03]" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-[var(--color-line)]/80 bg-[var(--color-paper)]/80 backdrop-blur-xl lg:pl-[248px]">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-3 px-4 sm:px-6">
          <button className="-ml-2 rounded-lg p-2 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden"><Logo /></div>

          <div className="ml-auto flex items-center gap-1.5">
            <Link to="/notifications" className="relative rounded-full p-2.5 hover:bg-black/[.04]" aria-label="Notifications">
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--color-brand)] px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>

            <div className="relative">
              <button onClick={() => setUserMenu((v) => !v)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-black/[.04]">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-ink)] text-[12px] font-semibold text-white">
                  {initials(profile?.full_name)}
                </span>
                <span className="hidden text-[13px] font-medium sm:block">{profile?.full_name?.split(" ")[0] ?? "You"}</span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-[var(--color-ink-soft)] sm:block" />
              </button>
              {userMenu && (
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white py-1 shadow-lg rise">
                  <div className="border-b border-[var(--color-line)] px-3.5 py-2.5">
                    <p className="truncate text-[13px] font-semibold">{profile?.full_name}</p>
                    <p className="truncate text-[11.5px] text-[var(--color-ink-soft)]">{profile?.email}</p>
                  </div>
                  {[
                    { to: "/profile", label: "Profile", icon: Settings },
                    { to: "/kyc", label: "KYC centre", icon: ShieldCheck },
                    { to: "/settings", label: "Security", icon: Shield },
                  ].map(({ to, label, icon: Icon }) => (
                    <Link key={to} to={to} className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] hover:bg-black/[.03]">
                      <Icon className="h-4 w-4 text-[var(--color-ink-soft)]" /> {label}
                    </Link>
                  ))}
                  <button onClick={() => signOut().then(() => navigate("/"))} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--color-danger)] hover:bg-black/[.03]">
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[#0b1411]/40 backdrop-blur-[2px]" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] bg-white p-4 rise">
            <div className="flex items-center justify-between">
              <Logo />
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="rounded-full p-2 hover:bg-black/5"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-6 flex flex-col gap-1">
              {[...nav, { to: "/profile", label: "Profile", icon: Settings }, { to: "/kyc", label: "KYC centre", icon: ShieldCheck }, { to: "/settings", label: "Security", icon: Shield }]
                .map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]" : "text-[var(--color-ink-soft)]"}`}>
                    <Icon className="h-4 w-4" /> {label}
                  </NavLink>
                ))}
              {role !== "student" && (
                <NavLink to="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--color-ink-soft)]">
                  <Shield className="h-4 w-4" /> Admin
                </NavLink>
              )}
            </div>
            <Button variant="secondary" block className="mt-6" onClick={() => signOut().then(() => navigate("/"))}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1120px] px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pl-[272px]">
        {kycIncomplete && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[16px] bg-[#fdf6e9] px-4 py-3 ring-1 ring-[#f2e2c4]">
            <Badge tone={kyc?.kyc_status ?? "NOT_STARTED"}>{kyc?.kyc_status?.replace("_", " ") ?? "NOT STARTED"}</Badge>
            <p className="text-[13px] text-[#7a4a10]">
              {kyc?.kyc_status === "REJECTED" ? "Your identity check needs attention." : "Verify your identity to unlock deposits and transfers."}
            </p>
            <Link to="/kyc" className="ml-auto text-[13px] font-semibold text-[var(--color-brand-dark)]">Finish KYC →</Link>
          </div>
        )}
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(10px,env(safe-area-inset-bottom))] lg:hidden">
        <div className="island mx-auto flex max-w-md items-stretch justify-between px-1.5 py-1.5">
          {mobileNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[10px] font-semibold transition-colors duration-300 ${
                  isActive ? "text-[var(--color-brand-dark)]" : "text-[var(--color-ink-soft)]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-[19px] w-[19px] transition-transform duration-300 ${isActive ? "scale-105" : ""}`} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
