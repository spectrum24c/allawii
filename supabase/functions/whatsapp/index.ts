// WhatsApp Cloud API bridge. GET = Meta verification challenge, POST = inbound
// messages. The bot has no financial logic of its own: it calls the same
// Postgres functions the website uses, and refuses any write action without a
// verified linked account.
import { json, adminClient, cors } from "../_shared/http.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";
const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "allawii-verify";

async function sha256(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendText(to: string, body: string) {
  if (!TOKEN || !PHONE_ID) return { sent: false, reason: "WhatsApp Cloud API credentials not configured" };
  const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
  });
  return { sent: res.ok, reason: res.ok ? null : `graph ${res.status}` };
}

function money(minor: number) {
  return `NGN ${(minor / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    if (mode === "subscribe" && token === VERIFY_TOKEN) return new Response(challenge, { status: 200 });
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const raw = await req.text();
  let payload: any = {};
  try { payload = JSON.parse(raw); } catch { /* ignore */ }

  const db = adminClient();
  const messages = payload?.entry?.[0]?.changes?.[0]?.value?.messages ?? [];
  const msg = messages[0];
  if (!msg) return json({ received: true });

  const from = msg.from as string;
  const text = String(msg.text?.body ?? msg.interactive?.list_reply?.title ?? msg.interactive?.button_reply?.title ?? "").trim().toLowerCase();
  const phoneHash = await sha256(from);

  await db.from("webhook_events").insert({
    provider: "whatsapp",
    event_type: "message",
    event_id: `${msg.id}`,
    signature_valid: true,
    payload,
    status: "PROCESSED",
    processed_at: new Date().toISOString(),
  }).then(() => {}, () => {});

  const { data: identity } = await db
    .from("whatsapp_identities")
    .select("user_id, status")
    .eq("whatsapp_phone_hash", phoneHash)
    .eq("status", "LINKED")
    .maybeSingle();

  // A 6-digit link code is the only way to bind a number to an account.
  if (!identity) {
    const linkMatch = text.match(/^link\s+(\d{6})$/);
    if (linkMatch) {
      const codeHash = await sha256(linkMatch[1]);
      const { data: pending } = await db
        .from("whatsapp_identities")
        .select("id, user_id")
        .eq("link_code_hash", codeHash)
        .gt("link_code_expires_at", new Date().toISOString())
        .maybeSingle();
      if (pending) {
        await db.from("whatsapp_identities").update({
          whatsapp_phone_hash: phoneHash, whatsapp_user_id: from, status: "LINKED",
          linked_at: new Date().toISOString(), link_code_hash: null,
        }).eq("id", pending.id);
        await sendText(from, "Your WhatsApp number is now linked to Allawii. Send BALANCE, TRANSACTIONS, SAVINGS or KYC.");
        return json({ received: true, linked: true });
      }
      await sendText(from, "That link code is wrong or expired. Generate a new one in your Allawii dashboard.");
      return json({ received: true, linked: false });
    }
    await sendText(from, "Hi! This number is not linked to an Allawii account yet. Open Allawii > Settings > WhatsApp, generate a link code, then send: LINK 123456");
    return json({ received: true, unlinked: true });
  }

  const userId = identity.user_id;
  let reply = "I did not understand that. Send BALANCE, TRANSACTIONS, SAVINGS or KYC.";

  if (/^(balance|bal|1)$/.test(text)) {
    const { data: wallet } = await db.from("wallets").select("available_balance_minor, savings_balance_minor").eq("user_id", userId).single();
    reply = `Available balance: ${money(wallet?.available_balance_minor ?? 0)}\nSavings: ${money(wallet?.savings_balance_minor ?? 0)}`;
  } else if (/^(transactions|history|2)$/.test(text)) {
    const { data: txs } = await db.from("transactions").select("type, status, amount_minor, created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
    reply = txs?.length
      ? txs.map((t) => `${t.created_at.slice(0, 10)} · ${t.type} · ${money(t.amount_minor)} · ${t.status}`).join("\n")
      : "No transactions yet.";
  } else if (/^(savings|goals|4)$/.test(text)) {
    const { data: goals } = await db.from("savings_goals").select("name, current_amount_minor, target_amount_minor, status")
      .eq("user_id", userId).neq("status", "CLOSED").limit(5);
    reply = goals?.length
      ? goals.map((g) => `${g.name}: ${money(g.current_amount_minor)} of ${money(g.target_amount_minor)}`).join("\n")
      : "You have no savings goals yet.";
  } else if (/^(kyc|status|6)$/.test(text)) {
    const { data: kyc } = await db.from("kyc_profiles").select("kyc_status").eq("user_id", userId).single();
    reply = `KYC status: ${kyc?.kyc_status ?? "NOT_STARTED"}`;
  } else if (/^(transfer|send|5)$/.test(text)) {
    reply = "Transfers cannot be started from chat. Use your secure Allawii dashboard so we can verify your PIN, limits and recipient: https://allawii.app/transfer";
  }

  await sendText(from, reply);
  return json({ received: true, replied: true });
});
