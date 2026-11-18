import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const auth = req.headers.get("Authorization");
  if (!auth) return Response.json({ error: "Authentification requise" }, { status: 401 });
  const db = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Session invalide" }, { status: 401 });
  const { ad_submission_id } = await req.json();
  const { data: ad, error } = await db.from("ad_submissions").select("id,user_id,status,payment_status").eq("id", ad_submission_id).eq("user_id", user.id).single();
  if (error || !ad || ad.status !== "pending" || ad.payment_status === "paid") return Response.json({ error: "Demande invalide ou déjà réglée" }, { status: 400 });
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: prior } = await service.from("nafa_payments").select("*").eq("ad_submission_id", ad.id).maybeSingle();
  if (prior?.checkout_url && prior.status === "pending") return Response.json({ checkout_url: prior.checkout_url });
  const reference = `YM-${ad.id}`;
  const amount = 5000;
  const key = Deno.env.get("NAFA_SECRET_KEY");
  if (!key) return Response.json({ error: "Configuration de paiement indisponible" }, { status: 503 });
  const response = await fetch("https://nafa.me/api/merchant/v1/payments", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ amount, reference, description: "Publicité TOI&MOI", mode: "hosted", return_url: `${Deno.env.get("APP_ORIGIN")}/profile?payment=return` }) });
  const payment = await response.json();
  if (!response.ok || !payment.checkout_url) return Response.json({ error: "NAFA n’a pas pu créer le paiement" }, { status: 502 });
  const { error: saveError } = await service.from("nafa_payments").upsert({ user_id: user.id, ad_submission_id: ad.id, nafa_payment_id: payment.id, reference, amount, currency: payment.currency, status: "pending", checkout_url: payment.checkout_url }, { onConflict: "ad_submission_id" });
  if (saveError) return Response.json({ error: "Impossible d’enregistrer le paiement" }, { status: 500 });
  return Response.json({ checkout_url: payment.checkout_url });
});
