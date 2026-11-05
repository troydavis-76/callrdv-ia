import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Réponse du client à un rappel : il ouvre le lien de l'email (callrdv.com/?rdv=…&t=…),
// la page appelle cette fonction pour afficher le RDV, puis pour confirmer ou annuler.
// Le lien est protégé par le jeton secret propre au RDV (appointments.reponse_token).
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://vcnguzlwyacnlysnsogv.supabase.co";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DB = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const emailOk = (e: unknown) => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "methode" }, 405);

  let body: { id?: string; t?: string; action?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "requete" }, 400); }
  const { id, t, action } = body;
  if (!id || !t || !UUID.test(id) || !UUID.test(t)) return json({ error: "introuvable" }, 404);

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}&reponse_token=eq.${t}&select=id,titre,personne,date,heure,lieu,adresse,statut,profiles(name,email,lang)`,
    { headers: DB },
  );
  const rows = await r.json();
  const rdv = Array.isArray(rows) ? rows[0] : null;
  if (!rdv) return json({ error: "introuvable" }, 404);

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ
  const passe = (rdv.date || "") < today;
  const info = {
    titre: rdv.titre, personne: rdv.personne, date: rdv.date, heure: rdv.heure,
    lieu: [rdv.lieu, rdv.adresse].filter(Boolean).join(" — "),
    pro: rdv.profiles?.name || "", statut: rdv.statut, passe, lang: rdv.profiles?.lang === "en" ? "en" : "fr",
  };

  if (!action) return json({ rdv: info });
  if (action !== "confirme" && action !== "annule") return json({ error: "action" }, 400);
  if (passe) return json({ error: "passe", rdv: info }, 400);
  if (rdv.statut === "annule") return json({ error: "deja_annule", rdv: info }, 409);
  // Une demande pas encore acceptée par le pro ne peut qu'être annulée par le client
  if (rdv.statut === "a_valider" && action === "confirme") return json({ error: "a_valider", rdv: info }, 409);

  const u = await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}&reponse_token=eq.${t}`, {
    method: "PATCH",
    headers: DB,
    body: JSON.stringify({ statut: action, reponse_at: new Date().toISOString() }),
  });
  if (!u.ok) return json({ error: "enregistrement" }, 500);

  // Le pro est prévenu par email quand son client annule
  const proEmail = rdv.profiles?.email;
  if (action === "annule" && emailOk(proEmail) && RESEND_KEY) {
    const en = info.lang === "en";
    const d = new Date(rdv.date + "T12:00:00Z");
    const dateTxt = isNaN(d.getTime()) ? rdv.date : d.toLocaleDateString(en ? "en-GB" : "fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    const quand = `${dateTxt}${rdv.heure ? (en ? " at " : " à ") + rdv.heure : ""}`;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "CallRDV <rappels@callrdv.com>",
        to: proEmail,
        subject: en ? `❌ ${rdv.personne || "Your client"} cancelled their appointment` : `❌ ${rdv.personne || "Votre client"} a annulé son RDV`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
          <h2 style="color:#ef4444;">${en ? "Appointment cancelled by your client" : "RDV annulé par votre client"}</h2>
          <p><b>${esc(rdv.titre || (en ? "Appointment" : "Rendez-vous"))}</b></p>
          <p>👤 ${esc(rdv.personne)}</p>
          <p>📅 ${esc(quand)}</p>
          <p>${en ? "The appointment is now marked as cancelled in CallRDV. The slot is free again." : "Le RDV est maintenant marqué « Annulé » dans CallRDV. Le créneau est libre."}</p>
          <p style="color:#94a3b8;font-size:12px;margin-top:24px;">CallRDV — callrdv.com</p>
        </div>`,
      }),
    }).catch(() => {});
  }

  return json({ ok: true, rdv: { ...info, statut: action } });
});
