// POST /functions/v1/accounts
// { action: "provision-funding-account" } | { action: "banks" }
import { json, requireUser, adminClient, cors } from "../_shared/http.ts";
import { createReservedAccount, getReservedAccount, listBanks, monnifyConfigured } from "../_shared/monnify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const { user, client, error } = await requireUser(req);
  if (!user) return json({ error }, 401);

  const body = await req.json().catch(() => ({}));

  if (body.action === "banks") {
    if (!monnifyConfigured()) {
      const { data } = await client.from("banks").select("code, name").eq("is_active", true).order("name");
      return json({ mode: "local", banks: data ?? [] });
    }
    const result = await listBanks();
    if (!result.ok || !result.data) return json({ error: result.error ?? "could not load banks" }, 502);
    await adminClient().from("banks").upsert(result.data.map((b) => ({ code: b.code, name: b.name })));
    return json({ mode: "monnify", banks: result.data });
  }

  if (body.action === "provision-funding-account") {
    const { data: kyc } = await client.from("kyc_profiles").select("kyc_status").eq("user_id", user.id).single();
    if (kyc?.kyc_status !== "VERIFIED") return json({ error: "KYC must be verified before a funding account is created" }, 400);

    const { data: existing } = await client.from("funding_accounts").select("*").eq("user_id", user.id).single();
    // A row can be ACTIVE with no number if an earlier attempt failed before the
    // provider returned one. Only a numbered account is final.
    if (existing?.status === "ACTIVE" && existing.account_number) {
      return json({ mode: "existing", funding_account: existing });
    }
    if (existing?.status === "PENDING") return json({ error: "A funding account request is already pending", funding_account: existing }, 409);

    const { data: profile } = await client.from("profiles").select("full_name, email").eq("id", user.id).single();

    if (!monnifyConfigured()) {
      // No Monnify test keys on this deployment: never invent an account number.
      await adminClient().from("funding_accounts").update({ status: "NOT_PROVISIONED", failure_reason: "Monnify not fully configured (contract code missing)" }).eq("user_id", user.id);
      return json({
        mode: "demo",
        funding_account: null,
        message: "Monnify API keys are present but the contract code is not valid yet, so no real funding account can be created. Use the demo top-up, or set a valid MONNIFY_CONTRACT_CODE.",
      });
    }

    await client.from("funding_accounts").update({ status: "PENDING" }).eq("user_id", user.id);

    const reference = existing?.account_reference ?? `ALW-${user.id.slice(0, 12).toUpperCase()}`;

    // A previous run may have reserved the account without us storing the number.
    const reserved = await getReservedAccount(reference);
    // The reserved account name becomes the bank-facing account name, so it must
    // be the customer's own name, never a product label.
    const holderName = (profile?.full_name ?? "Allawii student").replace(/\s+/g, " ").trim();
    const result = reserved.ok && reserved.data
      ? reserved
      : await createReservedAccount({
      accountReference: reference,
      accountName: holderName,
      customerEmail: profile?.email ?? user.email ?? "",
      customerName: profile?.full_name ?? "Allawii student",
      getAllAvailableBanks: true,
    });

    if (!result.ok || !result.data) {
      const raw = result.error ?? "Monnify did not create the account";
      // Translate provider wording into something a student can act on, and keep
      // the raw message in the row so support can see exactly what happened.
      const kycProblem = /kyc/i.test(raw);
      const message = kycProblem
        ? "Monnify rejected this because the customer KYC record is incomplete. Finish the BVN step of your identity check, then retry."
        : raw;
      await adminClient().from("funding_accounts").update({ status: "FAILED", failure_reason: `${message} (provider: ${raw})` }).eq("user_id", user.id);
      return json({ error: message }, 502);
    }

    // The read endpoint nests the numbers under accounts[] while create returns
    // them at the top level, so accept either shape.
    const primary = result.data;
    const first = (primary.accounts ?? []).find((a) => a.accountNumber) ?? null;
    const accountNumber = primary.accountNumber ?? first?.accountNumber ?? null;
    if (!accountNumber) {
      await adminClient().from("funding_accounts").update({ status: "FAILED", failure_reason: "Monnify returned no account number" }).eq("user_id", user.id);
      return json({ error: "Monnify did not return an account number" }, 502);
    }

    const { data: saved } = await adminClient().rpc("rpc_funding_account_set", {
      p_user_id: user.id,
      p_status: "ACTIVE",
      p_account_number: accountNumber,
      p_bank_name: primary.bankName ?? first?.bankName ?? "Monnify",
      p_bank_code: primary.bankCode ?? first?.bankCode ?? null,
      p_account_name: primary.accountName,
      p_provider_reference: primary.reservationReference,
      p_failure_reason: null,
    });
    return json({ mode: "monnify", funding_account: saved });
  }

  return json({ error: "unknown action" }, 400);
});
