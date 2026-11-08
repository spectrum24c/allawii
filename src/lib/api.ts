import { supabase, callFunction, ApiError } from "./supabase";
import { humanError } from "./errors";
import type {
  Beneficiary, Bank, FundingAccount, KycProfile, Limits, Notification,
  Profile, SavingsGoal, Ticket, Transaction, WalletSummary,
} from "./types";

function fail(error: { message?: string } | null) {
  if (error) throw new ApiError(humanError(error), 400);
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  fail(error);
  return data as T;
}

// ---------------------------------------------------------------- auth
export const auth = {
  async signUp(input: { email: string; password: string; fullName: string; phone?: string; dob?: string }) {
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        data: {
          full_name: input.fullName.trim(),
          phone_number: input.phone?.trim() ?? null,
          date_of_birth: input.dob ?? null,
        },
      },
    });
    fail(error);
    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    fail(error);
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    fail(error);
  },

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}set-password`,
    });
    fail(error);
  },

  async updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    fail(error);
  },
};

// ---------------------------------------------------------------- reads
export async function getProfile(): Promise<Profile> {
  const { data, error } = await supabase.from("profiles").select("*").single();
  fail(error);
  return data as Profile;
}

// kyc_profiles is column-restricted for the authenticated role (BVN/NIN hashes and the
// raw consent record stay server-side), so ask only for the columns the UI needs.
const KYC_COLUMNS =
  "user_id, kyc_status, verification_level, verification_provider, verified_at, submitted_at, failure_reason, bvn_last4, nin_last4, updated_at";

export async function getKyc(): Promise<KycProfile> {
  const { data, error } = await supabase.from("kyc_profiles").select(KYC_COLUMNS).single();
  fail(error);
  return data as KycProfile;
}

export async function getWallet(): Promise<WalletSummary | null> {
  const rows = await rpc<WalletSummary[]>("rpc_wallet_summary");
  return rows?.[0] ?? null;
}

export async function getLimits(): Promise<Limits> {
  return rpc<Limits>("rpc_wallet_limits");
}

export async function getFundingAccount(): Promise<FundingAccount | null> {
  const { data, error } = await supabase
    .from("funding_accounts")
    .select("id, account_reference, account_number, bank_name, bank_code, account_name, status, failure_reason")
    .maybeSingle();
  fail(error);
  return (data as FundingAccount) ?? null;
}

export async function getTransactions(opts?: { limit?: number; type?: string; status?: string }): Promise<Transaction[]> {
  let query = supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.type && opts.type !== "ALL") query = query.eq("type", opts.type);
  if (opts?.status && opts.status !== "ALL") query = query.eq("status", opts.status);
  const { data, error } = await query;
  fail(error);
  return (data ?? []) as Transaction[];
}

export async function getTransaction(id: string): Promise<Transaction> {
  const { data, error } = await supabase.from("transactions").select("*").eq("id", id).single();
  fail(error);
  return data as Transaction;
}

export async function getBeneficiaries(): Promise<Beneficiary[]> {
  const { data, error } = await supabase
    .from("beneficiaries")
    .select("id, bank_code, bank_name, account_number_masked, account_name, status, verified_at, created_at")
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []) as Beneficiary[];
}

export async function deleteBeneficiary(id: string) {
  const { error } = await supabase.from("beneficiaries").delete().eq("id", id);
  fail(error);
}

export async function getGoals(): Promise<SavingsGoal[]> {
  const { data, error } = await supabase
    .from("savings_goals")
    .select("*")
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []) as SavingsGoal[];
}

export async function getGoal(id: string): Promise<SavingsGoal> {
  const { data, error } = await supabase.from("savings_goals").select("*").eq("id", id).single();
  fail(error);
  return data as SavingsGoal;
}

export async function getGoalTransactions(id: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("goal_id", id)
    .order("created_at", { ascending: false })
    .limit(30);
  fail(error);
  return (data ?? []) as Transaction[];
}

export async function getNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(40);
  fail(error);
  return (data ?? []) as Notification[];
}

export async function getTickets(): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []) as Ticket[];
}

export async function getTicketMessages(ticketId: string) {
  const { data, error } = await supabase
    .from("support_messages")
    .select("id, body, author_role, created_at, author_id")
    .eq("ticket_id", ticketId)
    .order("created_at");
  fail(error);
  return (data ?? []) as Array<{ id: string; body: string; author_role: string; created_at: string; author_id: string }>;
}

export async function getBanks(): Promise<Bank[]> {
  try {
    const result = await callFunction<{ banks: Bank[] }>("accounts", { action: "banks" });
    if (result?.banks?.length) return result.banks;
  } catch {
    // fall back to the locally seeded list
  }
  const { data, error } = await supabase.from("banks").select("code, name").eq("is_active", true).order("name");
  fail(error);
  return (data ?? []) as Bank[];
}

// ---------------------------------------------------------------- actions
export const actions = {
  updateProfile: (fullName: string, phone: string, dob: string | null) =>
    rpc<Profile>("rpc_update_profile", { p_full_name: fullName, p_phone: phone, p_dob: dob }),

  completeOnboarding: () => rpc<void>("rpc_complete_onboarding"),

  setPin: (pin: string) => rpc<void>("rpc_set_pin", { p_pin: pin }),

  securityStatus: () => rpc<{ pin_set: boolean; pin_set_at: string | null; locked_until: string | null }>("rpc_security_status"),

  submitKyc: (bvn: string | null, nin: string | null) =>
    rpc<KycProfile>("rpc_submit_kyc", { p_bvn: bvn, p_nin: nin, p_consent: true }),

  deposit: (amountMinor: number) =>
    callFunction<{ mode: "demo" | "monnify"; checkoutUrl?: string; reference?: string; message?: string; transaction: Transaction }>(
      "payments",
      { action: "init-deposit", amount_minor: amountMinor, redirect_url: `${window.location.origin}${import.meta.env.BASE_URL}deposit` },
    ),

  verifyDeposit: (reference: string) =>
    callFunction<{ status: string; transaction: Transaction }>("payments", { action: "verify-deposit", reference }),

  provisionFundingAccount: () =>
    callFunction<{ mode: string; funding_account: FundingAccount | null; message?: string }>("accounts", {
      action: "provision-funding-account",
    }),

  nameEnquiry: (accountNumber: string, bankCode: string) =>
    callFunction<{ mode: string; resolved: boolean; account_name: string | null; message?: string }>("transfers", {
      action: "name-enquiry",
      account_number: accountNumber,
      bank_code: bankCode,
    }),

  addBeneficiary: (bankCode: string, bankName: string, accountNumber: string, accountName: string, verified: boolean) =>
    rpc<Beneficiary>("rpc_create_beneficiary", {
      p_bank_code: bankCode,
      p_bank_name: bankName,
      p_account_number: accountNumber,
      p_account_name: accountName,
      p_verified: verified,
    }),

  quote: (amountMinor: number) => rpc<Record<string, number>>("rpc_transfer_quote", { p_amount_minor: amountMinor }),

  transfer: (beneficiaryId: string, amountMinor: number, narration: string, pin: string) =>
    rpc<Transaction>("rpc_initiate_transfer", {
      p_beneficiary_id: beneficiaryId,
      p_amount_minor: amountMinor,
      p_narration: narration,
      p_pin: pin,
    }),

  disburse: (transactionId: string) =>
    callFunction<{ mode: string; simulated?: boolean; message?: string; transaction: Transaction }>("transfers", {
      action: "disburse",
      transaction_id: transactionId,
    }),

  cancelTransfer: (id: string) => rpc<Transaction>("rpc_cancel_transfer", { p_transaction_id: id }),

  createGoal: (name: string, targetMinor: number, targetDate: string | null, policy: string, emoji: string | null) =>
    rpc<SavingsGoal>("rpc_savings_create", {
      p_name: name, p_target_minor: targetMinor, p_target_date: targetDate, p_policy: policy, p_emoji: emoji,
    }),

  updateGoal: (id: string, patch: { name?: string; targetMinor?: number; targetDate?: string | null; policy?: string; emoji?: string | null }) =>
    rpc<SavingsGoal>("rpc_savings_update", {
      p_goal_id: id,
      p_name: patch.name ?? null,
      p_target_minor: patch.targetMinor ?? null,
      p_target_date: patch.targetDate ?? null,
      p_policy: patch.policy ?? null,
      p_emoji: patch.emoji ?? null,
    }),

  contribute: (id: string, amountMinor: number) =>
    rpc<SavingsGoal>("rpc_savings_contribute", { p_goal_id: id, p_amount_minor: amountMinor }),

  withdraw: (id: string, amountMinor: number) =>
    rpc<SavingsGoal>("rpc_savings_withdraw", { p_goal_id: id, p_amount_minor: amountMinor }),

  setGoalStatus: (id: string, status: string) =>
    rpc<SavingsGoal>("rpc_savings_set_status", { p_goal_id: id, p_status: status }),

  markNotificationsRead: (ids?: string[]) => rpc<number>("rpc_mark_notifications_read", { p_ids: ids ?? null }),

  createTicket: (subject: string, category: string, message: string) =>
    rpc<Ticket>("rpc_create_ticket", { p_subject: subject, p_category: category, p_message: message }),

  replyTicket: (ticketId: string, body: string) =>
    rpc("rpc_reply_ticket", { p_ticket_id: ticketId, p_body: body }),

  whatsappLinkCode: () => rpc<{ code: string; expires_at: string }>("rpc_whatsapp_start_link"),
};

// ---------------------------------------------------------------- admin
export const admin = {
  stats: () => rpc<Record<string, number>>("rpc_admin_stats"),
  users: (search: string, limit = 50, offset = 0) =>
    rpc<import("./types").AdminUserRow[]>("rpc_admin_users", { p_search: search, p_limit: limit, p_offset: offset }),
  setAccountStatus: (userId: string, status: string, reason?: string) =>
    rpc("rpc_admin_set_account_status", { p_user_id: userId, p_status: status, p_reason: reason ?? null }),
  kycQueue: (status: string | null = null) =>
    rpc<Array<{
      user_id: string; full_name: string; email: string; phone_number: string | null;
      kyc_status: string; verification_level: number | null; bvn_last4: string | null;
      nin_last4: string | null; submitted_at: string | null; failure_reason: string | null;
      available_minor: number;
    }>>("rpc_admin_kyc_queue", { p_status: status }),
  kycDecision: (userId: string, decision: string, reason?: string) =>
    rpc("rpc_admin_kyc_decision", { p_user_id: userId, p_decision: decision, p_reason: reason ?? null }),
  adjustWallet: (userId: string, amountMinor: number, direction: "CREDIT" | "DEBIT", reason: string) =>
    rpc("rpc_admin_adjust_wallet", { p_user_id: userId, p_amount_minor: amountMinor, p_direction: direction, p_reason: reason }),
  updateSettings: (patch: Record<string, unknown>) => rpc<Record<string, unknown>>("rpc_admin_update_settings", { p_patch: patch }),
  setTicketStatus: (ticketId: string, status: string) =>
    rpc("rpc_admin_set_ticket_status", { p_ticket_id: ticketId, p_status: status }),
};

export async function getMyRole(): Promise<string> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "");
  fail(error);
  const roles = (data ?? []).map((r) => r.role);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("support")) return "support";
  return "student";
}
