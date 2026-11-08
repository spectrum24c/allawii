import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "./AppShell";
import { Button } from "../ui";
import { useAuth } from "../../hooks/useAuth";

const links = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/fees", label: "Fees" },
  { to: "/security", label: "Security" },
  { to: "/help", label: "Help" },
];

export function PublicLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { session } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <header className="sticky top-0 z-40 border-b border-[var(--color-line)]/70 bg-[var(--color-paper)]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-7 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) =>
                `text-[13.5px] font-medium transition-colors ${isActive ? "text-[var(--color-ink)]" : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"}`}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {session ? (
              <Link to="/dashboard"><Button size="sm">Open dashboard</Button></Link>
            ) : (
              <>
                <Link to="/login"><Button size="sm" variant="ghost">Log in</Button></Link>
                <Link to="/signup"><Button size="sm">Create account</Button></Link>
              </>
            )}
          </div>
          <button className="p-2 md:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-[#0b1411]/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[290px] bg-white p-5 rise">
            <div className="flex items-center justify-between">
              <Logo />
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-2 hover:bg-black/5"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-7 flex flex-col gap-1">
              {links.map((l) => (
                <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-black/[.03]">
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <Link to={session ? "/dashboard" : "/signup"} onClick={() => setOpen(false)}>
                <Button block>{session ? "Open dashboard" : "Create account"}</Button>
              </Link>
              {!session && <Link to="/login" onClick={() => setOpen(false)}><Button block variant="secondary">Log in</Button></Link>}
            </div>
          </div>
        </div>
      )}

      {children}

      <footer className="border-t border-[var(--color-line)] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Logo />
              <p className="mt-3 max-w-[260px] text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
                A student wallet and savings-goal platform. Built for the way students actually get money and spend it.
              </p>
            </div>
            <FooterCol title="Product" links={[["How it works", "/how-it-works"], ["Fees and limits", "/fees"], ["Security", "/security"], ["Help centre", "/help"]]} />
            <FooterCol title="Company" links={[["Contact", "/contact"], ["Terms of service", "/terms"], ["Privacy policy", "/privacy"], ["KYC disclosures", "/disclosures"]]} />
            <FooterCol title="Account" links={[["Create account", "/signup"], ["Log in", "/login"], ["Forgot password", "/forgot-password"]]} />
          </div>
          <div className="mt-10 flex flex-col gap-2 border-t border-[var(--color-line)] pt-6 text-[12px] text-[var(--color-ink-soft)] sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Allawii. All rights reserved.</p>
            <p>Allawii is not a bank and does not pay interest. Demo build for evaluation.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-ink)]">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map(([label, to]) => (
          <li key={to}><Link to={to} className="text-[13px] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
