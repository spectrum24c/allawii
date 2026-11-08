// POST /functions/v1/payments
// { action: "init-deposit", amount_minor } -> { mode: "monnify" | "demo", checkoutUrl?, reference }
// { action: "verify-deposit", reference }    -> verifies server-side, settles ledger
import { json, requireUser, adminClient, cors } from "../_shared/http.ts";
import { initTransaction, verifyTransaction, monnifyConfigured } from "../_shared/monnify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const { user, client, error } = await requireUser(req);
  if (!user) return json({ error }, 401);

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  const { data: profile } = await client.from("profiles").select("full_name, email").eq("id", user.id).single();

  if (action === "init-deposit") {
    const amountMinor = Number(body.amount_minor);
    // rpc_deposit_start enforces KYC, limits and returns a labelled demo credit
    // when the platform is in demo mode.
    const { data: tx, error: txErr } = await client.rpc("rpc_deposit_start", {
      p_amount_minor: amountMinor,
      p_channel: monnifyConfigured() ? "monnify" : "demo",
    });
    if (txErr) return json({ error: txErr.message }, 400);

    if (tx.status === "SUCCESSFUL") {
      return json({ mode: "demo", transaction: tx, message: "Demo funds added. No real money moved." });
    }

    const init = await initTransaction({
      amount: amountMinor / 100,
      customerName: profile?.full_name ?? "Allawii student",
      customerEmail: profile?.email ?? user.email ?? "student@allawii.app",
      paymentReference: tx.client_reference,
      paymentDescription: "Allawii wallet funding",
      redirectUrl: body.redirect_url ?? "",
    });

    if (!init.ok || !init.data?.checkoutUrl) {
      await adminClient().rpc("rpc_deposit_settle", {
        p_client_reference: tx.client_reference,
        p_provider_reference: null,
        p_success: false,
        p_reason: init.error ?? "Could not start Monnify checkout",
      });
      return json({ error: init.error ?? "Could not start checkout", transaction: tx }, 502);
    }

    await adminClient().from("transactions")
      .update({ provider_reference: init.data.transactionReference })
      .eq("id", tx.id);

    return json({ mode: "monnify", checkoutUrl: init.data.checkoutUrl, reference: tx.client_reference, transaction: tx });
  }

  if (action === "verify-deposit") {
    const reference = String(body.reference ?? "");
    if (!reference) return json({ error: "reference required" }, 400);
    if (!monnifyConfigured()) return json({ error: "Monnify is not configured on this deployment" }, 400);

    const { data: tx } = await client.from("transactions").select("*").eq("client_reference", reference).single();
    if (!tx) return json({ error: "transaction not found" }, 404);

    const result = await verifyTransaction(reference);
    if (!result.ok || !result.data) return json({ error: result.error ?? "Monnify verification failed" }, 502);

    const paid = result.data.paymentStatus === "PAID" && Number(result.data.amountPaid) * 100 >= tx.amount_minor;
    const { data: settled } = await adminClient().rpc("rpc_deposit_settle", {
      p_client_reference: reference,
      p_provider_reference: result.data.transactionReference ?? null,
      p_success: paid,
      p_reason: paid ? null : `Monnify status: ${result.data.paymentStatus}`,
    });
    return json({ status: result.data.paymentStatus, transaction: settled });
  }

  return json({ error: "unknown action" }, 400);
});
