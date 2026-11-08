// Shared Monnify client. Secrets live only here (edge function environment).
// Base URL: sandbox https://sandbox.monnify.com | live https://api.monnify.com

const BASE = Deno.env.get("MONNIFY_BASE_URL") ?? "https://sandbox.monnify.com";
const API_KEY = Deno.env.get("MONNIFY_API_KEY") ?? "";
const SECRET_KEY = Deno.env.get("MONNIFY_SECRET_KEY") ?? "";
const CONTRACT_CODE = Deno.env.get("MONNIFY_CONTRACT_CODE") ?? "";

// checkout and reserved accounts both need a contract code, so a key pair alone is not enough
// to claim Monnify is ready: without it the platform falls back to labelled demo credits.
export const monnifyConfigured = () => Boolean(API_KEY && SECRET_KEY && CONTRACT_CODE);

// Monnify's sandbox will accept payments but cannot pay out to arbitrary bank
// accounts, so payouts stay explicitly simulated until a live wallet is funded.
// Set MONNIFY_DISBURSEMENT_MODE=live to send real disbursement calls.
export const disbursementSimulated = () =>
  (Deno.env.get("MONNIFY_DISBURSEMENT_MODE") ?? "simulated").toLowerCase() !== "live";

export type MonnifyResult<T> = { ok: boolean; status: number; data: T | null; error: string | null; raw?: unknown };

let cached: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 30_000) return cached.token;
  const basic = btoa(`${API_KEY}:${SECRET_KEY}`);
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.requestSuccessful) {
    throw new Error(`Monnify auth failed (${res.status}): ${json?.responseMessage ?? "no response"}`);
  }
  const ttl = Number(json.responseBody?.expiresIn ?? 3500) * 1000;
  cached = { token: json.responseBody.accessToken, expiresAt: Date.now() + ttl };
  return cached.token;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<MonnifyResult<T>> {
  try {
    const token = await getAccessToken();
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const json = await res.json().catch(() => null);
    const ok = Boolean(json?.requestSuccessful) && res.ok;
    return {
      ok,
      status: res.status,
      data: ok ? (json.responseBody as T) : null,
      error: ok ? null : (json?.responseMessage ?? `HTTP ${res.status}`),
      raw: json,
    };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e instanceof Error ? e.message : "network error" };
  }
}

export async function initTransaction(args: {
  amount: number; // naira
  customerName: string;
  customerEmail: string;
  paymentReference: string;
  paymentDescription: string;
  redirectUrl?: string;
}) {
  return call<{ checkoutUrl: string; transactionReference: string; paymentReference: string }>(
    "/api/v1/merchant/transactions/init-transaction",
    {
      method: "POST",
      body: JSON.stringify({
        amount: args.amount,
        customerName: args.customerName,
        customerEmail: args.customerEmail,
        paymentReference: args.paymentReference,
        paymentDescription: args.paymentDescription,
        currencyCode: "NGN",
        contractCode: CONTRACT_CODE,
        redirectUrl: args.redirectUrl ?? "",
        paymentMethods: ["CARD", "ACCOUNT_TRANSFER"],
      }),
    },
  );
}

export async function verifyTransaction(paymentReference: string) {
  return call<{
    paymentStatus: string;
    amountPaid: number;
    totalPayable: number;
    paymentReference: string;
    transactionReference: string;
    currencyCode: string;
  }>(`/api/v1/merchant/transactions/query?paymentReference=${encodeURIComponent(paymentReference)}`);
}

export async function nameEnquiry(accountNumber: string, bankCode: string) {
  return call<{ accountName: string; accountNumber: string; bankCode: string }>(
    `/api/v2/disbursements/account/validate?accountNumber=${encodeURIComponent(accountNumber)}&bankCode=${encodeURIComponent(bankCode)}`,
  );
}

export async function singleTransfer(args: {
  amount: number;
  reference: string;
  narration: string;
  destinationBankCode: string;
  destinationAccountNumber: string;
  destinationAccountName?: string;
  sourceAccountNumber?: string;
}) {
  return call<{ reference: string; status: string; amount: number }>("/api/v2/disbursements/single", {
    method: "POST",
    body: JSON.stringify({
      amount: args.amount,
      reference: args.reference,
      narration: args.narration,
      destinationBankCode: args.destinationBankCode,
      destinationAccountNumber: args.destinationAccountNumber,
      destinationAccountName: args.destinationAccountName,
      currency: "NGN",
      sourceAccountNumber: args.sourceAccountNumber ?? Deno.env.get("MONNIFY_SOURCE_ACCOUNT") ?? "",
      paymentDescription: args.narration,
    }),
  });
}

// A reservation reference can only be created once, so on a retry we read the
// existing account back instead of asking Monnify to reserve it again.
export async function getReservedAccount(accountReference: string) {
  return call<{
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string;
    reservationReference: string;
    accounts: Array<{ accountNumber: string; bankName: string; bankCode: string }>;
  }>(`/api/v2/bank-transfer/reserved-accounts/${encodeURIComponent(accountReference)}`);
}

export async function createReservedAccount(args: {
  accountReference: string;
  accountName: string;
  customerEmail: string;
  customerName: string;
  bvn?: string;
  nin?: string;
  getAllAvailableBanks?: boolean;
}) {
  return call<{
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string;
    reservationReference: string;
    accounts: Array<{ accountNumber: string; bankName: string; bankCode: string }>;
  }>("/api/v2/bank-transfer/reserved-accounts", {
    method: "POST",
    body: JSON.stringify({
      accountReference: args.accountReference,
      accountName: args.accountName,
      currencyCode: "NGN",
      contractCode: CONTRACT_CODE,
      customerEmail: args.customerEmail,
      customerName: args.customerName,
      bvn: args.bvn,
      nin: args.nin,
      getAllAvailableBanks: args.getAllAvailableBanks ?? false,
    }),
  });
}

export async function listBanks() {
  return call<Array<{ name: string; code: string }>>("/api/v1/banks");
}

// Monnify signs webhook bodies with HMAC-SHA512 using the secret key.
export async function verifyWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature || !SECRET_KEY) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET_KEY),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const a = new TextEncoder().encode(hex.toLowerCase());
  const b = new TextEncoder().encode(signature.toLowerCase());
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
