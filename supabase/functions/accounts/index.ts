// POST /functions/v1/accounts
// { action: "provision-funding-account" } | { action: "banks" }
import { json, requireUser, adminClient, cors } from "../_shared/http.ts";
import { createReservedAccount, listBanks, monnifyConfigured } from "../_shared/monnify.ts";

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
    if (existing?.status === "ACTIVE") return json({ mode: "existing", funding_account: existing });
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

    const result = await createReservedAccount({
      accountReference: existing?.account_reference ?? `ALW-${user.id.slice(0, 12).toUpperCase()}`,
      accountName: `Allawii / ${profile?.full_name ?? "Student"}`,
      customerEmail: profile?.email ?? user.email ?? "",
      customerName: profile?.full_name ?? "Allawii student",
      getAllAvailableBanks: true,
    });

    if (!result.ok || !result.data) {
      await adminClient().from("funding_accounts").update({ status: "FAILED", failure_reason: result.error }).eq("user_id", user.id);
      return json({ error: result.error ?? "Monnify did not create the account" }, 502);
    }

    const primary = result.data;
    const { data: saved } = await adminClient().rpc("rpc_funding_account_set", {
      p_user_id: user.id,
      p_status: "ACTIVE",
      p_account_number: primary.accountNumber,
      p_bank_name: primary.bankName,
      p_bank_code: primary.bankCode,
      p_account_name: primary.accountName,
      p_provider_reference: primary.reservationReference,
      p_failure_reason: null,
    });
    return json({ mode: "monnify", funding_account: saved });
  }

  return json({ error: "unknown action" }, 400);
});
