// POST /functions/v1/transfers
// { action: "name-enquiry", account_number, bank_code }
// { action: "disburse", transaction_id }
// Name enquiry and disbursement never happen in the browser: the Monnify secret
// key stays in this function's environment.
import { json, requireUser, adminClient, cors } from "../_shared/http.ts";
import { nameEnquiry, singleTransfer, monnifyConfigured } from "../_shared/monnify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const { user, client, error } = await requireUser(req);
  if (!user) return json({ error }, 401);

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  if (action === "name-enquiry") {
    const accountNumber = String(body.account_number ?? "");
    const bankCode = String(body.bank_code ?? "");
    if (!/^[0-9]{10}$/.test(accountNumber)) return json({ error: "invalid account number" }, 400);

    if (!monnifyConfigured()) {
      return json({
        mode: "demo",
        resolved: false,
        account_name: null,
        message: "Monnify checkout is not fully configured (a valid contract code is still needed), so account names cannot be resolved. Enter the beneficiary name manually; the demo will record it as unverified.",
      });
    }

    const result = await nameEnquiry(accountNumber, bankCode);
    if (!result.ok || !result.data) return json({ error: result.error ?? "Could not resolve account" }, 502);
    return json({ mode: "monnify", resolved: true, account_name: result.data.accountName });
  }

  if (action === "disburse") {
    const txId = String(body.transaction_id ?? "");
    if (!txId) return json({ error: "transaction_id required" }, 400);

    const { data: tx } = await client.from("transactions").select("*").eq("id", txId).single();
    if (!tx) return json({ error: "transaction not found" }, 404);
    if (tx.type !== "TRANSFER") return json({ error: "not a transfer" }, 400);
    if (tx.status !== "PROCESSING" && tx.status !== "PENDING") return json({ status: tx.status, transaction: tx });

    const { data: ben } = await adminClient()
      .from("beneficiaries")
      .select("account_number, bank_code, account_name")
      .eq("id", tx.beneficiary_id)
      .single();

    if (!monnifyConfigured()) {
      // Demo settlement: explicitly simulated, never presented as a real bank credit.
      const { data: settled } = await adminClient().rpc("rpc_settle_transfer", {
        p_transaction_id: tx.id,
        p_success: true,
        p_provider_reference: `DEMO-${tx.client_reference}`,
        p_reason: null,
      });
      return json({
        mode: "demo",
        simulated: true,
        message: "Demo disbursement only: Monnify is not fully configured, so no bank transfer occurred.",
        transaction: settled,
      });
    }

    if (!ben) return json({ error: "beneficiary missing" }, 400);

    const result = await singleTransfer({
      amount: tx.amount_minor / 100,
      reference: tx.client_reference,
      narration: tx.narration ?? "Allawii transfer",
      destinationBankCode: ben.bank_code,
      destinationAccountNumber: ben.account_number,
      destinationAccountName: ben.account_name,
    });

    const success = result.ok && ["SUCCESS", "PENDING", "COMPLETED"].includes(String(result.data?.status ?? "").toUpperCase());
    const { data: settled } = await adminClient().rpc("rpc_settle_transfer", {
      p_transaction_id: tx.id,
      p_success: success,
      p_provider_reference: result.data?.reference ?? null,
      p_reason: success ? null : (result.error ?? "Monnify disbursement failed"),
    });

    return json({ mode: "monnify", status: result.data?.status ?? "FAILED", transaction: settled });
  }

  return json({ error: "unknown action" }, 400);
});
