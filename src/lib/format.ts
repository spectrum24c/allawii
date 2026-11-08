export const naira = (minor: number | null | undefined) => {
  const value = (minor ?? 0) / 100;
  return `₦${value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const nairaShort = (minor: number | null | undefined) => {
  const value = (minor ?? 0) / 100;
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}m`;
  if (value >= 10_000) return `₦${(value / 1000).toFixed(0)}k`;
  return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
};

/** Converts a user-typed naira string ("1,500.50") into minor units. */
export const toMinor = (input: string) => {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  const parts = cleaned.split(".");
  const whole = Number(parts[0] || 0);
  const frac = Number((parts[1] ?? "").slice(0, 2).padEnd(2, "0") || 0);
  return Math.round(whole * 100 + frac);
};

export const formatDate = (value?: string | null, opts?: Intl.DateTimeFormatOptions) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-NG", opts ?? { day: "numeric", month: "short", year: "numeric" });
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-NG", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
};

export const timeAgo = (value?: string | null) => {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
};

export const initials = (name?: string | null) =>
  (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("") || "A";

export const titleCase = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export const progressPct = (current: number, target: number) =>
  target <= 0 ? 0 : Math.min(100, Math.round((current / target) * 100));
