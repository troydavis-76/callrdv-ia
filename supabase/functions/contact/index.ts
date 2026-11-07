import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Formulaire de contact de callrdv.com
// La clé Resend reste ici, côté serveur (secret RESEND_API_KEY), jamais dans le site.
// verify_jwt désactivé : le site n'envoie que la clé publique (apikey), qui n'est pas un JWT.

const ALLOWED_ORIGINS = ["https://callrdv.com", "https://www.callrdv.com", "https://callrdv-ia.vercel.app"];

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

// Empêche d'injecter du HTML dans l'email reçu
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

Deno.serve(async (req: Request) => {
  const headers = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method" }), { status: 405, headers });

  let body: { nom?: unknown; email?: unknown; message?: unknown };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "json" }), { status: 400, headers }); }

  const nom = typeof body.nom === "string" ? body.nom.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!nom || !email || !message) return new Response(JSON.stringify({ error: "champs" }), { status: 400, headers });
  if (nom.length > 100 || email.length > 200 || message.length > 5000) return new Response(JSON.stringify({ error: "trop long" }), { status: 400, headers });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return new Response(JSON.stringify({ error: "email" }), { status: 400, headers });

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return new Response(JSON.stringify({ error: "config" }), { status: 500, headers });

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "CallRDV <rappels@callrdv.com>",
      to: ["Abdoulsalam.sow@outlook.fr"],
      reply_to: email,
      subject: `📬 Message de ${nom.slice(0, 60)} — CallRDV`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
          <h2 style="color:#1e3a5f;">📞 Nouveau message — CallRDV</h2>
          <div style="background:#f8fafc;border-radius:12px;padding:24px;margin-top:20px;">
            <p><strong>Nom :</strong> ${esc(nom)}</p>
            <p><strong>Email :</strong> ${esc(email)}</p>
            <p><strong>Message :</strong></p>
            <p style="white-space:pre-wrap;color:#475569;">${esc(message)}</p>
          </div>
          <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Envoyé depuis callrdv.com</p>
        </div>`,
    }),
  });

  if (!r.ok) return new Response(JSON.stringify({ error: "envoi" }), { status: 502, headers });
  return new Response(JSON.stringify({ ok: true }), { headers });
});
