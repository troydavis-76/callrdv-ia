import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Webhook Stripe : abonnement CallRDV à prix unique (20€/mois)
// - checkout.session.completed      -> le compte passe en "pro"
// - customer.subscription.deleted   -> le compte repasse en "free"
// Stripe n'envoie pas de jeton Supabase : la fonction vérifie elle-même la signature Stripe.
// La clé whsec_… vient UNIQUEMENT du secret Supabase STRIPE_WEBHOOK_SECRET (jamais écrite dans le code).
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://vcnguzlwyacnlysnsogv.supabase.co";
// Clé serveur : nouvelle clé secrète (sb_secret_…, « default ») si elle existe, sinon l'ancienne service_role.
// Les nouvelles clés passent seulement dans l'en-tête apikey (pas dans Authorization : ce ne sont pas des JWT).
function cleServeur(): string {
  try { const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")?.default; if (typeof k === "string" && k) return k; } catch { /* ignoré */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}
const SUPABASE_KEY = cleServeur();
const AUTH_DB: Record<string, string> = SUPABASE_KEY.startsWith("sb_") ? { "apikey": SUPABASE_KEY } : { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };
const DB = { ...AUTH_DB, "Content-Type": "application/json", "Prefer": "return=representation" };

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

// Vérifie l'en-tête Stripe-Signature (t=...,v1=...) : HMAC-SHA256 de "t.body", tolérance 5 minutes
async function signatureOk(body: string, header: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = parts["t"];
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)));
  const attendu = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === attendu.length && [...s].every((c, i) => c === attendu[i]));
}

async function majProfil(filtre: string, data: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?${filtre}`, { method: "PATCH", headers: DB, body: JSON.stringify(data) });
  const rows = await r.json();
  return Array.isArray(rows) ? rows.length : 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  // Sans clé configurée, on refuse tout (jamais d'acceptation par défaut)
  if (!WEBHOOK_SECRET.startsWith("whsec_")) return json({ error: "config" }, 500);
  const body = await req.text();
  if (!(await signatureOk(body, req.headers.get("stripe-signature") ?? ""))) return json({ error: "signature" }, 400);

  let event;
  try { event = JSON.parse(body); } catch { return json({ error: "json" }, 400); }
  const obj = event?.data?.object ?? {};

  if (event.type === "checkout.session.completed") {
    const email = String(obj.customer_details?.email || obj.customer_email || "").trim().toLowerCase();
    if (!email) return json({ received: true, note: "pas d'email" });
    const n = await majProfil(`email=eq.${encodeURIComponent(email)}`, {
      plan: "pro",
      usage: 0,
      ...(obj.customer ? { stripe_customer_id: obj.customer } : {}),
    });
    return json({ received: true, comptes_mis_a_jour: n });
  }

  if (event.type === "customer.subscription.deleted" && obj.customer) {
    const n = await majProfil(`stripe_customer_id=eq.${encodeURIComponent(obj.customer)}`, { plan: "free" });
    return json({ received: true, comptes_mis_a_jour: n });
  }

  return json({ received: true });
});
