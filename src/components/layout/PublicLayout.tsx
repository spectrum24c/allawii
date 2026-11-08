import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowUpRight, Menu, ShieldCheck, X } from "lucide-react";
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
      {/* floating nav island: detached from the edge, hairline ring, glass fill */}
      <header className="sticky top-0 z-40 px-4 pt-3 sm:px-5 sm:pt-4">
        <div className="island mx-auto flex h-[58px] max-w-6xl items-center justify-between gap-3 pl-4 pr-2 sm:pr-2.5">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors duration-300 ${
                    isActive ? "bg-[var(--color-forest)] text-white" : "text-[var(--color-ink-soft)] hover:bg-black/[.045] hover:text-[var(--color-ink)]"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-1.5 md:flex">
            {session ? (
              <Link to="/dashboard">
                <Button size="sm" trailing={<ArrowUpRight className="h-3.5 w-3.5" />}>Open dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/login"><Button size="sm" variant="ghost">Log in</Button></Link>
                <Link to="/signup"><Button size="sm">Create account</Button></Link>
              </>
            )}
          </div>
          <button className="rounded-full p-2.5 text-[var(--color-ink)] transition-colors hover:bg-black/5 md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-[#071c17]/45 backdrop-blur-[3px] fade" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[300px] bg-white p-5 shadow-2xl rise">
            <div className="flex items-center justify-between">
              <Logo />
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-2 hover:bg-black/5"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-7 flex flex-col gap-1">
              {links.map((l) => (
                <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="rounded-[14px] px-3 py-3 text-[14px] font-semibold text-[var(--color-ink-soft)] transition-colors hover:bg-black/[.035] hover:text-[var(--color-ink)]">
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-2 border-t border-[var(--color-line)] pt-5">
              <Link to={session ? "/dashboard" : "/signup"} onClick={() => setOpen(false)}>
                <Button block>{session ? "Open dashboard" : "Create account"}</Button>
              </Link>
              {!session && <Link to="/login" onClick={() => setOpen(false)}><Button block variant="secondary">Log in</Button></Link>}
            </div>
            <p className="mt-5 flex items-center gap-1.5 text-[11.5px] text-[var(--color-ink-faint)]">
              <ShieldCheck className="h-3.5 w-3.5" /> Balance moves only after server verification
            </p>
          </div>
        </div>
      )}

      {children}

      <footer className="mt-8 border-t border-[var(--color-line)] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Logo />
              <p className="mt-4 max-w-[280px] text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
                A student wallet and savings-goal platform. Built for the way students actually get money and spend it.
              </p>
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-soft)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--color-brand-dark)]">
                <ShieldCheck className="h-3.5 w-3.5" /> Payments verified server-side
              </p>
            </div>
            <FooterCol title="Product" links={[["How it works", "/how-it-works"], ["Fees and limits", "/fees"], ["Security", "/security"], ["Help centre", "/help"]]} />
            <FooterCol title="Company" links={[["Contact", "/contact"], ["Terms of service", "/terms"], ["Privacy policy", "/privacy"], ["KYC disclosures", "/disclosures"]]} />
            <FooterCol title="Account" links={[["Create account", "/signup"], ["Log in", "/login"], ["Forgot password", "/forgot-password"]]} />
          </div>
          <div className="mt-12 flex flex-col gap-2 border-t border-[var(--color-line)] pt-6 text-[11.5px] text-[var(--color-ink-faint)] sm:flex-row sm:items-center sm:justify-between">
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
      <p className="eyebrow">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {links.map(([label, to]) => (
          <li key={to}>
            <Link to={to} className="text-[13px] text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
