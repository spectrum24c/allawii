export type KycStatus = "NOT_STARTED" | "PENDING" | "VERIFIED" | "REVIEW" | "REJECTED";
export type AccountStatus = "ACTIVE" | "FROZEN" | "CLOSED";
export type TxType = "DEPOSIT" | "TRANSFER" | "FEE" | "REVERSAL" | "REFUND" | "ADJUSTMENT" | "SAVINGS";
export type TxStatus = "PENDING" | "PROCESSING" | "SUCCESSFUL" | "FAILED" | "REVERSED" | "CANCELLED";
export type GoalStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CLOSED";
export type Policy = "FLEXIBLE" | "TARGET_DATE" | "LOCKED";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  date_of_birth: string | null;
  status: AccountStatus;
  avatar_url: string | null;
  onboarding_completed: boolean;
  created_at: string;
}

export interface KycProfile {
  user_id: string;
  kyc_status: KycStatus;
  verification_level: number;
  bvn_last4: string | null;
  nin_last4: string | null;
  verification_provider: string | null;
  verification_reference: string | null;
  verified_at: string | null;
  failure_reason: string | null;
  submitted_at: string | null;
  updated_at: string;
}

export interface WalletSummary {
  wallet_id: string;
  currency: string;
  wallet_status: string;
  available_minor: number;
  pending_minor: number;
  savings_minor: number;
  total_credited_minor: number;
  total_debited_minor: number;
}

export interface Limits {
  min_transfer_minor: number;
  max_transfer_minor: number;
  daily_transfer_minor: number;
  transfer_fee_minor: number;
  fee_cap_minor: number;
  demo_mode: boolean;
}

export interface FundingAccount {
  id: string;
  account_reference: string;
  account_number: string | null;
  bank_name: string | null;
  bank_code: string | null;
  account_name: string | null;
  status: "NOT_PROVISIONED" | "PENDING" | "ACTIVE" | "FAILED";
  failure_reason: string | null;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TxType;
  status: TxStatus;
  amount_minor: number;
  fee_minor: number;
  currency: string;
  provider: string | null;
  provider_reference: string | null;
  client_reference: string;
  narration: string | null;
  beneficiary_id: string | null;
  goal_id: string | null;
  failure_reason: string | null;
  metadata: Record<string, any>;
  created_at: string;
  completed_at: string | null;
}

export interface Beneficiary {
  id: string;
  bank_code: string;
  bank_name: string;
  account_number_masked: string;
  account_name: string | null;
  status: "UNVERIFIED" | "VERIFIED" | "DISABLED";
  verified_at: string | null;
  created_at: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount_minor: number;
  current_amount_minor: number;
  currency: string;
  target_date: string | null;
  status: GoalStatus;
  withdrawal_policy: Policy;
  emoji: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
  reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bank {
  code: string;
  name: string;
}

export interface AdminUserRow {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  status: AccountStatus;
  kyc_status: KycStatus;
  available_minor: number;
  savings_minor: number;
  goals_count: number;
  tx_count: number;
  created_at: string;
}
