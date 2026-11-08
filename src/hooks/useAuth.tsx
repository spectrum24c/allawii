import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isConfigured } from "../lib/supabase";
import { getKyc, getLimits, getMyRole, getProfile, getWallet } from "../lib/api";
import type { KycProfile, Limits, Profile, WalletSummary } from "../lib/types";

interface AuthState {
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  kyc: KycProfile | null;
  wallet: WalletSummary | null;
  limits: Limits | null;
  role: "student" | "support" | "admin";
  unread: number;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [kyc, setKyc] = useState<KycProfile | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [role, setRole] = useState<"student" | "support" | "admin">("student");
  const [unread, setUnread] = useState(0);
  // Which user's profile/role we have actually finished loading. Without this
  // the app briefly believes every fresh session is a student, which is enough
  // to bounce an operator off /admin on a hard reload.
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);

  const load = useCallback(async (userId: string) => {
    const [p, k, w, l, r] = await Promise.allSettled([getProfile(), getKyc(), getWallet(), getLimits(), getMyRole()]);
    if (p.status === "fulfilled") setProfile(p.value);
    if (k.status === "fulfilled") setKyc(k.value);
    if (w.status === "fulfilled") setWallet(w.value);
    if (l.status === "fulfilled") setLimits(l.value);
    if (r.status === "fulfilled") setRole(r.value as "student" | "support" | "admin");
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    setUnread(count ?? 0);
    loadedFor.current = userId;
    setHydratedFor(userId);
  }, []);

  const refresh = useCallback(async () => {
    if (session?.user?.id) await load(session.user.id);
  }, [session, load]);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setProfile(null); setKyc(null); setWallet(null); setRole("student"); setUnread(0);
        loadedFor.current = null; setHydratedFor(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id && loadedFor.current !== session.user.id) {
      load(session.user.id);
    }
  }, [session, load]);

  // live balance + notification updates
  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel("allawii-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${session.user.id}` }, () => refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${session.user.id}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id, refresh]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    loadedFor.current = null;
    setHydratedFor(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading: loading || Boolean(session?.user?.id && hydratedFor !== session.user.id),
      profile, kyc, wallet, limits, role, unread, refresh, signOut,
    }),
    [session, loading, profile, kyc, wallet, limits, role, unread, refresh, signOut, hydratedFor],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
