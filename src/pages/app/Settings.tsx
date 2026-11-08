import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Lock, MessageCircle, ShieldCheck } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge, Button, Card, Field, Input, useToast } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { actions, auth, getMyRole } from "../../lib/api";
import { humanError } from "../../lib/errors";
import { formatDateTime, naira } from "../../lib/format";

export default function Settings() {
  const { profile, wallet, kyc, limits, signOut } = useAuth();
  const { push } = useToast();
  const [status, setStatus] = useState<{ pin_set: boolean; pin_set_at: string | null; locked_until: string | null } | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ code: string; expires_at: string } | null>(null);
  const [role, setRole] = useState("student");

  useEffect(() => {
    actions.securityStatus().then(setStatus).catch(() => setStatus(null));
    getMyRole().then(setRole).catch(() => {});
  }, []);

  async function savePin() {
    setError(null);
    if (!/^[0-9]{4}$/.test(pin)) return setError("Your PIN must be exactly 4 digits.");
    if (pin !== pin2) return setError("Those PINs do not match.");
    setBusy(true);
    try {
      await actions.setPin(pin);
      setPin(""); setPin2("");
      setStatus(await actions.securityStatus());
      push({ tone: "success", title: "Transaction PIN saved" });
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  async function linkWhatsapp() {
    try {
      const res = await actions.whatsappLinkCode();
      setLink(res);
      push({ tone: "info", title: "Link code generated", body: "Send it from your WhatsApp number." });
    } catch (err) {
      push({ tone: "error", title: "Could not create code", body: humanError(err) });
    }
  }

  async function resetPassword() {
    if (!profile?.email) return;
    try {
      await auth.resetPassword(profile.email);
      push({ tone: "success", title: "Reset link sent", body: profile.email });
    } catch (err) {
      push({ tone: "error", title: "Could not send link", body: humanError(err) });
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl rise">
        <h1 className="text-[24px] tracking-[-0.02em]">Security</h1>
        <p className="mt-1 text-[13.5px] text-[var(--color-ink-soft)]">PIN, password, and the number that can reach your account on WhatsApp.</p>

        <Card className="mt-5 p-5">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-4 w-4 text-[var(--color-ink-soft)]" />
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13.5px] font-semibold">Transaction PIN</p>
                <Badge tone={status?.pin_set ? "VERIFIED" : "PENDING"}>{status?.pin_set ? "Set" : "Not set"}</Badge>
              </div>
              <p className="mt-1 text-[12px] text-[var(--color-ink-soft)]">
                {status?.pin_set
                  ? `Last updated ${formatDateTime(status.pin_set_at)}. Five wrong attempts locks transfers for 15 minutes.`
                  : "You need a PIN to send money. It is hashed; nobody can read it back."}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Field label={status?.pin_set ? "New PIN" : "Choose a PIN"}>
                  <Input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" className="text-center tracking-[0.5em]" />
                </Field>
                <Field label="Confirm PIN">
                  <Input type="password" inputMode="numeric" maxLength={4} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} placeholder="••••" className="text-center tracking-[0.5em]" />
                </Field>
              </div>
              {error && <p className="mt-2 rounded-lg bg-[#fdeceb] px-3 py-2 text-[12px] text-[var(--color-danger)]">{error}</p>}
              <Button size="sm" className="mt-3" loading={busy} onClick={savePin} disabled={pin.length !== 4 || pin2.length !== 4}>
                {status?.pin_set ? "Change PIN" : "Set PIN"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="mt-3 p-5">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 text-[var(--color-ink-soft)]" />
            <div className="flex-1">
              <p className="text-[13.5px] font-semibold">Password</p>
              <p className="mt-1 text-[12px] text-[var(--color-ink-soft)]">We send a secure link to {profile?.email}. Your PIN is never sent by email.</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={resetPassword}>Send password reset link</Button>
            </div>
          </div>
        </Card>

        <Card className="mt-3 p-5">
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 h-4 w-4 text-[var(--color-ink-soft)]" />
            <div className="flex-1">
              <p className="text-[13.5px] font-semibold">WhatsApp</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-ink-soft)]">
                Generate a one-time code, then send <span className="font-mono">LINK 123456</span> from your WhatsApp number.
                Balance and goal checks are read-only; transfers always happen inside the app.
              </p>
              {link ? (
                <div className="mt-3 rounded-xl bg-[var(--color-paper)] p-3">
                  <p className="font-mono text-[20px] font-semibold tracking-[0.2em]">{link.code}</p>
                  <p className="mt-1 text-[11.5px] text-[var(--color-ink-soft)]">Expires {formatDateTime(link.expires_at)}</p>
                </div>
              ) : (
                <Button size="sm" variant="secondary" className="mt-3" onClick={linkWhatsapp}>Generate link code</Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="mt-3 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-[var(--color-ink-soft)]" />
            <div className="flex-1">
              <p className="text-[13.5px] font-semibold">Account</p>
              <dl className="mt-2 space-y-1.5 text-[12.5px]">
                {[
                  ["Email", profile?.email ?? "—"],
                  ["Role", role],
                  ["Account status", profile?.status ?? "—"],
                  ["KYC", kyc?.kyc_status ?? "NOT_STARTED"],
                  ["Available balance", naira(wallet?.available_minor)],
                  ["Demo mode", limits?.demo_mode ? "On (simulated payments)" : "Off (live payment keys)"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-[var(--color-ink-soft)]">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/profile"><Button size="sm" variant="secondary">Edit profile</Button></Link>
                <Button size="sm" variant="ghost" onClick={() => signOut()}>Sign out</Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
