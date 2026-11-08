import { clsx } from "clsx";
import { X, CheckCircle2, AlertCircle, Info, Loader2 } from "lucide-react";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
} from "react";

// ---------------------------------------------------------------- button
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "lime";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  block?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, block, className, children, disabled, ...rest }: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[.985]";
  const variants = {
    primary: "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)] shadow-[0_1px_2px_rgba(11,20,17,.18)]",
    secondary: "bg-white text-[var(--color-ink)] border border-[var(--color-line)] hover:border-[var(--color-ink)]/30 hover:bg-[#fafaf7]",
    ghost: "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:bg-black/[.04]",
    danger: "bg-[var(--color-danger)] text-white hover:brightness-95",
    lime: "bg-[var(--color-lime)] text-[var(--color-ink)] hover:brightness-97",
  };
  const sizes = { sm: "h-9 px-3.5 text-[13px]", md: "h-11 px-5 text-sm", lg: "h-12 px-6 text-[15px]" };
  return (
    <button className={clsx(base, variants[variant], sizes[size], block && "w-full", className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- inputs
export function Field({ label, hint, error, children, htmlFor }: {
  label?: string; hint?: string; error?: string | null; children: ReactNode; htmlFor?: string;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      {label && <span className="mb-1.5 block text-[13px] font-medium text-[var(--color-ink-soft)]">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-[var(--color-ink-soft)]">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs text-[var(--color-danger)]">{error}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[#9aa39e] transition-colors focus:border-[var(--color-brand)] focus:outline-none focus:ring-4 focus:ring-[var(--color-brand)]/10 disabled:bg-[#f4f4f0]";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(inputClass, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(inputClass, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2214%22 height=%2214%22 fill=%22none%22 stroke=%22%2348534e%22 stroke-width=%221.8%22><path d=%22M3 5.5 7 9.5 11 5.5%22/></svg>')] bg-[right_0.9rem_center] bg-no-repeat pr-9", className)} {...rest}>
      {children}
    </select>
  );
}

// ---------------------------------------------------------------- surfaces
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx("rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)]", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-[var(--color-ink-soft)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- badges
const toneMap: Record<string, string> = {
  SUCCESSFUL: "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]",
  VERIFIED: "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]",
  ACTIVE: "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]",
  PROCESSING: "bg-[#fef4e6] text-[var(--color-warn)]",
  PENDING: "bg-[#fef4e6] text-[var(--color-warn)]",
  REVIEW: "bg-[#fef4e6] text-[var(--color-warn)]",
  FAILED: "bg-[#fdeceb] text-[var(--color-danger)]",
  REJECTED: "bg-[#fdeceb] text-[var(--color-danger)]",
  FROZEN: "bg-[#fdeceb] text-[var(--color-danger)]",
  CANCELLED: "bg-[#f1f1ec] text-[var(--color-ink-soft)]",
  CLOSED: "bg-[#f1f1ec] text-[var(--color-ink-soft)]",
  PAUSED: "bg-[#f1f1ec] text-[var(--color-ink-soft)]",
  COMPLETED: "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]",
  NOT_STARTED: "bg-[#f1f1ec] text-[var(--color-ink-soft)]",
  UNVERIFIED: "bg-[#fef4e6] text-[var(--color-warn)]",
  OPEN: "bg-[#eaf1fe] text-[#1d4ed8]",
  RESOLVED: "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]",
};

export function Badge({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  const key = String(tone ?? children).toUpperCase().replace(/\s+/g, "_");
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide", toneMap[key] ?? "bg-[#f1f1ec] text-[var(--color-ink-soft)]", className)}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- states
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-[var(--color-ink-soft)]">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label ?? "Loading"}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] px-6 py-12 text-center">
      {icon && <div className="mb-3 text-[var(--color-ink-soft)]">{icon}</div>}
      <p className="text-sm font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[13px] text-[var(--color-ink-soft)]">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0b1411]/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl sm:p-6 rise">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-[var(--color-ink-soft)] hover:bg-black/5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto">{children}</div>
        {footer && <div className="mt-5 flex gap-2">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- toasts
type Toast = { id: number; title: string; body?: string; tone: "success" | "error" | "info" };
const ToastCtx = createContext<{ push: (t: Omit<Toast, "id">) => void }>({ push: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 5200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-[var(--color-line)] bg-white p-3.5 shadow-lg rise">
            {t.tone === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand)]" />}
            {t.tone === "error" && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" />}
            {t.tone === "info" && <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1d4ed8]" />}
            <div className="min-w-0">
              <p className="text-[13px] font-semibold">{t.title}</p>
              {t.body && <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-ink-soft)]">{t.body}</p>}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
