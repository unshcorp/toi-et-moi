import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const raw = await req.text();
  const signature = req.headers.get("X-Nafa-Signature") ?? "";
  const parts = signature.match(/t=(\d+),v1=([a-f0-9]{64})/);
  const secret = Deno.env.get("NAFA_WEBHOOK_SECRET");
  if (!parts || !secret || Math.abs(Date.now() / 1000 - Number(parts[1])) > 300) return new Response("Invalid signature", { status: 401 });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts[1]}.${raw}`)));
  const expected = [...mac].map(x => x.toString(16).padStart(2,"0")).join("");
  if (expected.length !== parts[2].length || !crypto.subtle.timingSafeEqual) {
    if (expected !== parts[2]) return new Response("Invalid signature", { status: 401 });
  } else if (expected !== parts[2]) return new Response("Invalid signature", { status: 401 });
  const event = JSON.parse(raw), payment = event.data;
  if (!payment?.id || !payment.reference) return new Response("Invalid payload", { status: 400 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: row } = await db.from("nafa_payments").select("*").eq("nafa_payment_id", payment.id).eq("reference", payment.reference).maybeSingle();
  if (!row || Number(payment.amount) !== row.amount || payment.currency !== row.currency) return new Response("Payment mismatch", { status: 409 });
  const status = event.event === "payment.completed" && payment.status === "completed" ? "completed" : event.event === "payment.failed" ? "failed" : event.event === "payment.expired" ? "expired" : "pending";
  const { error } = await db.from("nafa_payments").update({ status, completed_at: status === "completed" ? new Date().toISOString() : null }).eq("id", row.id);
  if (error) return new Response("Database error", { status: 500 });
  if (status === "completed") {
    const { error: paidError } = await db.from("ad_submissions").update({ payment_status: "paid" }).eq("id", row.ad_submission_id).eq("user_id", row.user_id);
    if (paidError) return new Response("Database error", { status: 500 });
  }
  return new Response("ok", { status: 200 });
});
