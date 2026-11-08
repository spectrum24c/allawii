import { clsx } from "clsx";
import { X, CheckCircle2, AlertCircle, Info, Loader2 } from "lucide-react";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
} from "react";

// ---------------------------------------------------------------- button
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "lime" | "invert";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  block?: boolean;
  trailing?: ReactNode;
};

/**
 * Pill button. A trailing icon never sits naked: it lands inside its own
 * circular well so the shape stays whole, like a machined control.
 */
export function Button({ variant = "primary", size = "md", loading, block, trailing, className, children, disabled, ...rest }: ButtonProps) {
  const base =
    "group relative inline-flex items-center justify-center gap-2.5 rounded-full font-semibold tracking-[-0.01em] transition-[background-color,box-shadow,transform,color] duration-300 ease-[cubic-bezier(.16,1,.3,1)] disabled:opacity-55 disabled:cursor-not-allowed select-none active:scale-[.985]";
  const variants = {
    primary: "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)] shadow-[0_1px_0_rgba(255,255,255,.18)_inset,0_10px_24px_-14px_rgba(12,107,76,.9)]",
    secondary: "bg-white text-[var(--color-ink)] ring-1 ring-[var(--color-line-strong)] hover:ring-[var(--color-ink)]/30 hover:bg-[#fbfbf7] shadow-[0_1px_2px_rgba(11,21,18,.04)]",
    ghost: "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:bg-black/[.04]",
    danger: "bg-[var(--color-danger)] text-white hover:brightness-95",
    lime: "bg-[var(--color-lime)] text-[var(--color-ink)] hover:brightness-[.97]",
    invert: "bg-white text-[var(--color-forest)] hover:bg-[#f3f6f1] shadow-[0_10px_24px_-18px_rgba(0,0,0,.8)]",
  };
  const sizes = { sm: "h-9 px-3.5 text-[12.5px]", md: "h-11 px-5 text-[13.5px]", lg: "h-[52px] px-6 text-[15px]" };
  return (
    <button className={clsx(base, variants[variant], sizes[size], block && "w-full", className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
      {trailing && (
        <span className="ml-1 grid h-7 w-7 place-items-center rounded-full bg-white/15 transition-transform duration-300 group-hover:translate-x-0.5">
          {trailing}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------- inputs
export function Field({ label, hint, error, children, htmlFor }: {
  label?: string; hint?: string; error?: string | null; children: ReactNode; htmlFor?: string;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      {label && <span className="mb-2 block text-[12px] font-semibold tracking-[.01em] text-[var(--color-ink-soft)]">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1.5 block text-[11.5px] leading-relaxed text-[var(--color-ink-faint)]">{hint}</span>}
      {error && <span className="mt-1.5 block text-[11.5px] font-medium text-[var(--color-danger)]">{error}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-[14px] border border-[var(--color-line)] bg-white px-4 py-3 text-[14px] text-[var(--color-ink)] shadow-[0_1px_1px_rgba(11,21,18,.03)_inset] placeholder:text-[#a7afaa] transition-[border-color,box-shadow] duration-200 hover:border-[var(--color-line-strong)] focus:border-[var(--color-brand)] focus:outline-none focus:shadow-[0_0_0_4px_rgba(12,107,76,.11)] disabled:bg-[#f4f3ee]";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(inputClass, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(inputClass, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2214%22 height=%2214%22 fill=%22none%22 stroke=%22%2359635c%22 stroke-width=%221.8%22><path d=%22M3 5.5 7 9.5 11 5.5%22/></svg>')] bg-[right_0.9rem_center] bg-no-repeat pr-10", className)} {...rest}>
      {children}
    </select>
  );
}

// ---------------------------------------------------------------- surfaces
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx("rounded-[var(--radius-card)] bg-[var(--color-card)] ring-1 ring-[var(--color-line)] shadow-[0_1px_2px_rgba(11,21,18,.03)]", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[17px] font-bold">{title}</h2>
        {subtitle && <p className="mt-1 text-[13px] text-[var(--color-ink-soft)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- alerts
export function Alert({ tone = "error", title, children }: { tone?: "error" | "info" | "success"; title?: string; children?: ReactNode }) {
  const map = {
    error: "bg-[#fdf0ee] text-[#8a1c12] ring-[#f3d3ce]",
    info: "bg-[#f0f4fb] text-[#1e3a8a] ring-[#d8e2f5]",
    success: "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)] ring-[#cfe3d8]",
  } as const;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={clsx("flex items-start gap-2.5 rounded-[14px] px-3.5 py-3 text-[12.5px] leading-relaxed ring-1", map[tone])}>
      {tone === "error" ? <AlertCircle className="mt-px h-4 w-4 shrink-0" /> : <Info className="mt-px h-4 w-4 shrink-0" />}
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- badges
const toneMap: Record<string, string> = {
  SUCCESSFUL: "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)] ring-[#cfe3d8]",
  VERIFIED: "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)] ring-[#cfe3d8]",
  ACTIVE: "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)] ring-[#cfe3d8]",
  PROCESSING: "bg-[#fdf3e3] text-[var(--color-warn)] ring-[#f0e0c6]",
  PENDING: "bg-[#fdf3e3] text-[var(--color-warn)] ring-[#f0e0c6]",
  REVIEW: "bg-[#fdf3e3] text-[var(--color-warn)] ring-[#f0e0c6]",
  FAILED: "bg-[#fdf0ee] text-[var(--color-danger)] ring-[#f3d3ce]",
  REJECTED: "bg-[#fdf0ee] text-[var(--color-danger)] ring-[#f3d3ce]",
  FROZEN: "bg-[#fdf0ee] text-[var(--color-danger)] ring-[#f3d3ce]",
  CANCELLED: "bg-[#f2f1ea] text-[var(--color-ink-soft)] ring-[#e4e3d8]",
  CLOSED: "bg-[#f2f1ea] text-[var(--color-ink-soft)] ring-[#e4e3d8]",
  PAUSED: "bg-[#f2f1ea] text-[var(--color-ink-soft)] ring-[#e4e3d8]",
  COMPLETED: "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)] ring-[#cfe3d8]",
  NOT_STARTED: "bg-[#f2f1ea] text-[var(--color-ink-soft)] ring-[#e4e3d8]",
  UNVERIFIED: "bg-[#fdf3e3] text-[var(--color-warn)] ring-[#f0e0c6]",
  OPEN: "bg-[#eef3fc] text-[#1d4ed8] ring-[#d8e2f5]",
  RESOLVED: "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)] ring-[#cfe3d8]",
};

export function Badge({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  const key = String(tone ?? children).toUpperCase().replace(/\s+/g, "_");
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-[5px] text-[10.5px] font-bold uppercase tracking-[.07em] ring-1 ring-inset", toneMap[key] ?? "bg-[#f2f1ea] text-[var(--color-ink-soft)] ring-[#e4e3d8]", className)}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- states
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-[13px] text-[var(--color-ink-soft)]">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label ?? "Loading"}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-line-strong)] bg-white/50 px-6 py-12 text-center">
      {icon && (
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-[var(--color-paper-deep)] text-[var(--color-ink-soft)]">
          {icon}
        </div>
      )}
      <p className="text-[14px] font-semibold">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-[var(--color-ink-soft)]">{body}</p>}
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#071c17]/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-md rounded-t-[28px] bg-white p-5 shadow-[0_-20px_60px_-30px_rgba(0,0,0,.5)] sm:rounded-[28px] sm:p-6 rise sm:shadow-[0_40px_80px_-40px_rgba(7,28,23,.55)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-[16px] font-bold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-[var(--color-ink-soft)] transition-colors hover:bg-black/5">
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
          <div key={t.id} className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[18px] bg-white p-3.5 ring-1 ring-[var(--color-line)] shadow-[0_24px_48px_-24px_rgba(11,21,18,.45)] rise">
            {t.tone === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand)]" />}
            {t.tone === "error" && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" />}
            {t.tone === "info" && <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1d4ed8]" />}
            <div className="min-w-0">
              <p className="text-[13px] font-semibold">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--color-ink-soft)]">{t.body}</p>}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
