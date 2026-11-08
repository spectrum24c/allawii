const MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Please sign in again to continue.",
  ADMIN_ONLY: "You do not have access to that area.",
  FORBIDDEN: "That action is not allowed for your account.",
  INVALID_AMOUNT: "Enter an amount greater than zero.",
  INSUFFICIENT_FUNDS: "Your available balance is too low for this. Top up and try again.",
  KYC_REQUIRED: "Verify your identity first. It takes about a minute.",
  WALLET_NOT_ACTIVE: "Your wallet is not active. Contact support if this looks wrong.",
  WALLET_NOT_FOUND: "We could not find your wallet. Refresh and try again.",
  ACCOUNT_NOT_ACTIVE: "Your account is currently restricted. Contact support.",
  BELOW_MIN_TRANSFER: "That is below the minimum transfer amount.",
  ABOVE_MAX_TRANSFER: "That is above the maximum transfer amount for your account.",
  DAILY_LIMIT_EXCEEDED: "This transfer would pass your daily limit.",
  INVALID_PIN: "That transaction PIN is not correct.",
  PIN_LOCKED: "Too many wrong PIN attempts. Try again in 15 minutes.",
  PIN_NOT_SET: "Set your 4-digit transaction PIN before sending money.",
  PIN_MUST_BE_4_DIGITS: "Your PIN must be exactly 4 digits.",
  BENEFICIARY_NOT_FOUND: "That beneficiary no longer exists.",
  INVALID_ACCOUNT_NUMBER: "Nigerian account numbers are 10 digits.",
  ACCOUNT_NAME_REQUIRED: "Enter or confirm the account name.",
  TRANSACTION_NOT_FOUND: "We could not find that transaction.",
  NOT_CANCELLABLE: "This transfer can no longer be cancelled.",
  GOAL_NOT_FOUND: "That savings goal no longer exists.",
  GOAL_NOT_ACTIVE: "This goal is paused or closed.",
  GOAL_LOCKED: "This goal is locked until you unlock it.",
  GOAL_LOCKED_UNTIL_TARGET_DATE: "This goal only releases funds on its target date.",
  INSUFFICIENT_GOAL_BALANCE: "You cannot withdraw more than the goal holds.",
  MIN_DEPOSIT_100: "The smallest deposit is ₦100.",
  MAX_DEPOSIT_EXCEEDED: "That deposit is larger than the platform allows.",
  MIN_CONTRIBUTION_10: "The smallest contribution is ₦10.",
  TARGET_TOO_SMALL: "Set a target of at least ₦100.",
  NAME_REQUIRED: "Give your goal a name.",
  SUBJECT_REQUIRED: "Add a subject so we can route your message.",
  MESSAGE_REQUIRED: "Write a message first.",
  TICKET_NOT_FOUND: "We could not find that ticket.",
  CONSENT_REQUIRED: "Tick the consent box so we can run the identity check.",
  BVN_OR_NIN_REQUIRED: "Enter your BVN or your NIN.",
  INVALID_BVN: "A BVN is 11 digits.",
  INVALID_NIN: "A NIN is 11 digits.",
  ALREADY_VERIFIED: "Your identity is already verified.",
  REASON_REQUIRED: "Add a reason for the adjustment.",
  INVALID_DECISION: "Pick a valid KYC decision.",
};

/** Maps Postgres/edge-function errors to something a student can act on. */
export function humanError(error: unknown): string {
  const raw =
    typeof error === "string"
      ? error
      : (error as { message?: string })?.message ?? "Something went wrong. Please try again.";

  for (const [code, message] of Object.entries(MESSAGES)) {
    if (raw.includes(code)) return message;
  }

  if (/invalid login credentials/i.test(raw)) return "Wrong email or password.";
  if (/email not confirmed/i.test(raw)) return "Confirm your email first. Check your inbox.";
  if (/user already registered/i.test(raw)) return "That email already has an Allawii account. Sign in instead.";
  if (/password should be at least/i.test(raw)) return "Use at least 8 characters for your password.";
  if (/rate limit|too many/i.test(raw)) return "Too many attempts. Wait a moment and try again.";
  if (/duplicate key/i.test(raw)) return "That already exists.";
  if (/Failed to fetch|NetworkError/i.test(raw)) return "Network issue. Check your connection and retry.";

  return raw;
}
