// POST /functions/v1/monnify-webhook  (public, signature verified, idempotent)
import { json, adminClient, cors } from "../_shared/http.ts";
import { verifyWebhookSignature } from "../_shared/monnify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const raw = await req.text();
  const signature = req.headers.get("monnify-signature");
  const valid = await verifyWebhookSignature(raw, signature);

  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(raw); } catch { /* ignore */ }

  const eventType = String(payload.eventType ?? payload.event_type ?? "UNKNOWN");
  const eventBody = (payload.eventBody ?? {}) as Record<string, unknown>;
  const eventId = String(
    eventBody.transactionReference ??
    eventBody.paymentReference ??
    eventBody.reference ??
    payload.eventId ??
    `${eventType}:${eventBody.paymentReference ?? raw.length}`,
  );

  const db = adminClient();

  // Record first, unique on (provider, event_id) => replay safe.
  const { data: inserted, error: insertErr } = await db
    .from("webhook_events")
    .insert({ provider: "monnify", event_type: eventType, event_id: eventId, signature_valid: valid, payload, status: valid ? "RECEIVED" : "IGNORED" })
    .select("id")
    .maybeSingle();

  if (insertErr && /duplicate key/i.test(insertErr.message)) {
    return json({ received: true, duplicate: true });
  }
  if (!valid) return json({ received: true, signature_valid: false }, 202);
  if (!inserted) return json({ received: true }, 202);

  let status: "PROCESSED" | "FAILED" | "IGNORED" = "IGNORED";
  let note: string | null = null;

  try {
    const reference = String(eventBody.paymentReference ?? eventBody.reference ?? "");
    const providerRef = String(eventBody.transactionReference ?? eventBody.reference ?? "");

    if (eventType === "SUCCESSFUL_TRANSACTION" || eventType === "SUCCESSFUL_COLLECTION") {
      const paidAmount = Number(eventBody.amountPaid ?? eventBody.amount ?? 0);
      await db.rpc("rpc_deposit_settle", {
        p_client_reference: reference,
        p_provider_reference: providerRef,
        p_success: paidAmount > 0,
        p_reason: paidAmount > 0 ? null : "Monnify reported a zero amount",
      });
      status = "PROCESSED";
    } else if (eventType === "FAILED_TRANSACTION" || eventType === "REJECTED_TRANSACTION") {
      await db.rpc("rpc_deposit_settle", {
        p_client_reference: reference,
        p_provider_reference: providerRef,
        p_success: false,
        p_reason: String(eventBody.paymentStatus ?? eventBody.status ?? "Payment failed"),
      });
      status = "PROCESSED";
    } else if (eventType === "SUCCESSFUL_DISBURSEMENT" || eventType === "FAILED_DISBURSEMENT") {
      const { data: tx } = await db.from("transactions").select("id").eq("client_reference", reference).maybeSingle();
      if (tx?.id) {
        await db.rpc("rpc_settle_transfer", {
          p_transaction_id: tx.id,
          p_success: eventType === "SUCCESSFUL_DISBURSEMENT",
          p_provider_reference: providerRef,
          p_reason: eventType === "SUCCESSFUL_DISBURSEMENT" ? null : String(eventBody.reason ?? "Disbursement failed"),
        });
        status = "PROCESSED";
      } else {
        note = "no matching transfer";
      }
    } else {
      note = `handled as log-only: ${eventType}`;
    }
  } catch (e) {
    status = "FAILED";
    note = e instanceof Error ? e.message : "processing error";
  }

  await db.from("webhook_events")
    .update({ status, error: note, processed_at: new Date().toISOString() })
    .eq("id", inserted.id);

  return json({ received: true, status });
});
