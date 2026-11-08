import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Badge, Button, Card, Field, Input, useToast } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { actions } from "../../lib/api";
import { humanError } from "../../lib/errors";
import { formatDate, initials } from "../../lib/format";

export default function Profile() {
  const { profile, kyc, refresh } = useAuth();
  const { push } = useToast();
  const [form, setForm] = useState({ fullName: "", phone: "", dob: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) setForm({ fullName: profile.full_name ?? "", phone: profile.phone_number ?? "", dob: profile.date_of_birth ?? "" });
  }, [profile]);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await actions.updateProfile(form.fullName, form.phone, form.dob || null);
      await refresh();
      push({ tone: "success", title: "Profile updated" });
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl rise">
        <h1 className="text-[24px] tracking-[-0.02em]">Profile</h1>
        <p className="mt-1 text-[13.5px] text-[var(--color-ink-soft)]">Keep your details accurate: the name here is the name on your transfers.</p>

        <Card className="mt-5 p-5">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-ink)] text-[18px] font-semibold text-white">
              {initials(profile?.full_name)}
            </span>
            <div>
              <p className="text-[15px] font-semibold">{profile?.full_name}</p>
              <p className="text-[12.5px] text-[var(--color-ink-soft)]">{profile?.email}</p>
              <div className="mt-1.5 flex gap-1.5">
                <Badge tone={profile?.status ?? "ACTIVE"}>{profile?.status ?? "ACTIVE"}</Badge>
                <Badge tone={kyc?.kyc_status ?? "NOT_STARTED"}>KYC {kyc?.kyc_status?.replace("_", " ") ?? "NOT STARTED"}</Badge>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <Field label="Full name" htmlFor="name" hint="Changing this may require a new identity check">
              <Input id="name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </Field>
            <Field label="Email" htmlFor="email" hint="Contact support to change your sign-in email">
              <Input id="email" value={profile?.email ?? ""} disabled />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone number" htmlFor="phone">
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08012345678" />
              </Field>
              <Field label="Date of birth" htmlFor="dob">
                <Input id="dob" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
              </Field>
            </div>
            <Field label="Member since">
              <Input value={formatDate(profile?.created_at)} disabled />
            </Field>

            {error && <p className="rounded-lg bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[var(--color-danger)]">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button loading={busy} onClick={save}>Save changes</Button>
              <Link to="/kyc"><Button variant="secondary">KYC centre</Button></Link>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
