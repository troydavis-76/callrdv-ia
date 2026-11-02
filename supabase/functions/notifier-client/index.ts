import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Email au client juste après une action du pro dans CallRDV :
//  - type "nouveau" : le RDV vient d'être enregistré
//  - type "deplace" : la date ou l'heure du RDV a changé
//  - type "annule"  : le pro a annulé le RDV
// Appelée par l'app avec le jeton de connexion du pro : on vérifie que le RDV est bien à lui.
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://vcnguzlwyacnlysnsogv.supabase.co";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DB = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };
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
const nomExpediteur = (n: unknown) => String(n ?? "").replace(/[<>"\\\r\n,;]/g, "").trim().slice(0, 60);

const TXT = {
  fr: {
    nouveau: { sujet: "Votre rendez-vous est enregistré", titre: "✅ Votre rendez-vous est enregistré", intro: (a: string) => `Votre rendez-vous${a} est bien enregistré :` },
    deplace: { sujet: "Votre rendez-vous a été déplacé", titre: "🔄 Votre rendez-vous a été déplacé", intro: (a: string) => `Votre rendez-vous${a} a changé. Voici la nouvelle date :` },
    annule: { sujet: "Votre rendez-vous est annulé", titre: "❌ Votre rendez-vous est annulé", intro: (a: string) => `Nous sommes désolés, votre rendez-vous${a} est annulé :` },
    reprendre: "Pour reprendre rendez-vous, répondez simplement à cet email ou contactez votre professionnel.",
    rdv: "Rendez-vous", heure: "heure à préciser", a: "à", avec: "avec", bonjour: "Bonjour",
    bouton: "Confirmer ou annuler mon RDV",
    rappel: "Vous recevrez aussi un rappel par email avant le rendez-vous.",
    repondre: (pro: string) => `Une question ? Répondez simplement à cet email pour écrire à ${pro || "votre professionnel"}.`,
    pied: (avec: string) => `Email envoyé${avec} via CallRDV — callrdv.com`,
  },
  en: {
    nouveau: { sujet: "Your appointment is booked", titre: "✅ Your appointment is booked", intro: (a: string) => `Your appointment${a} is booked:` },
    deplace: { sujet: "Your appointment has been moved", titre: "🔄 Your appointment has been moved", intro: (a: string) => `Your appointment${a} has changed. Here is the new date:` },
    annule: { sujet: "Your appointment is cancelled", titre: "❌ Your appointment is cancelled", intro: (a: string) => `We're sorry, your appointment${a} is cancelled:` },
    reprendre: "To book again, just reply to this email or contact your professional.",
    rdv: "Appointment", heure: "time to be confirmed", a: "at", avec: "with", bonjour: "Hello",
    bouton: "Confirm or cancel my appointment",
    rappel: "You will also get an email reminder before the appointment.",
    repondre: (pro: string) => `Any questions? Just reply to this email to write to ${pro || "your professional"}.`,
    pied: (avec: string) => `Email sent${avec} via CallRDV — callrdv.com`,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "methode" }, 405);

  // 1. Qui appelle ? (le pro connecté)
  const auth = req.headers.get("Authorization") ?? "";
  const ur = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { "apikey": SUPABASE_KEY, "Authorization": auth } });
  const user = ur.ok ? await ur.json() : null;
  if (!user?.id) return json({ error: "non_connecte" }, 401);

  let body: { id?: string; type?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "requete" }, 400); }
  const { id, type } = body;
  if (!id || !UUID.test(id) || (type !== "nouveau" && type !== "deplace" && type !== "annule")) return json({ error: "requete" }, 400);

  // 2. Le RDV doit appartenir à ce pro
  const r = await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}&user_id=eq.${user.id}&select=*,profiles(name,email,lang)`, { headers: DB });
  const rows = await r.json();
  const rdv = Array.isArray(rows) ? rows[0] : null;
  if (!rdv) return json({ error: "introuvable" }, 404);

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const annulation = type === "annule";
  if (annulation && rdv.statut !== "annule") return json({ sent: false, reason: "pas_annule" });
  if (!annulation && rdv.statut === "annule") return json({ sent: false, reason: "annule" });
  if ((rdv.date || "") < today) return json({ sent: false, reason: "passe" });

  // 3. Email du client : celui du RDV, sinon celui de sa fiche
  let clientEmail = emailOk(rdv.client_email) ? rdv.client_email.trim() : "";
  if (!clientEmail && rdv.personne) {
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/patients?select=nom,email&user_id=eq.${user.id}&email=not.is.null`, { headers: DB });
    const fiches = await pr.json();
    const f = Array.isArray(fiches) ? fiches.find((p) => String(p.nom ?? "").trim().toLowerCase() === String(rdv.personne).trim().toLowerCase() && emailOk(p.email)) : null;
    if (f) clientEmail = f.email.trim();
  }
  const proEmail = rdv.profiles?.email;
  if (!clientEmail) return json({ sent: false, reason: "pas_email" });
  if (clientEmail.toLowerCase() === String(proEmail ?? "").toLowerCase()) return json({ sent: false, reason: "email_du_pro" });

  // 4. Envoi
  const en = rdv.profiles?.lang === "en";
  const L = en ? TXT.en : TXT.fr;
  const T = L[type as "nouveau" | "deplace" | "annule"];
  const pro = nomExpediteur(rdv.profiles?.name);
  const avec = pro ? ` ${L.avec} ${esc(pro)}` : "";
  const d = new Date(rdv.date + "T12:00:00Z");
  const date = isNaN(d.getTime()) ? rdv.date : d.toLocaleDateString(en ? "en-GB" : "fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const lieu = [rdv.lieu, rdv.adresse].filter(Boolean).join(" — ");
  const lien = !annulation && rdv.reponse_token ? `https://callrdv.com/?rdv=${encodeURIComponent(rdv.id)}&t=${encodeURIComponent(rdv.reponse_token)}` : "";
  const repondre = emailOk(proEmail);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: pro ? `${pro} via CallRDV <rappels@callrdv.com>` : "CallRDV <rappels@callrdv.com>",
      to: clientEmail,
      ...(repondre ? { reply_to: proEmail } : {}),
      subject: pro ? `${T.sujet} — ${pro}` : T.sujet,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="color:#1e3a5f;">${esc(T.titre)}</h2>
        <p>${L.bonjour} ${esc(rdv.personne)},</p>
        <p>${T.intro(avec)}</p>
        <p style="font-size:16px;"><b>${esc(rdv.titre || L.rdv)}</b></p>
        <p>📅 ${esc(date)} ${L.a} ${esc(rdv.heure || L.heure)}</p>
        ${lieu ? `<p>📍 ${esc(lieu)}</p>` : ""}
        ${lien ? `<p style="margin:24px 0;"><a href="${lien}" style="background:#1e3a5f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;display:inline-block;">${esc(L.bouton)}</a></p>` : ""}
        ${annulation ? `<p>${esc(L.reprendre)}</p>` : `<p>${esc(L.rappel)}</p>${repondre ? `<p>${esc(L.repondre(pro))}</p>` : ""}`}
        <p style="color:#94a3b8;font-size:12px;margin-top:24px;">${L.pied(avec)}</p>
      </div>`,
    }),
  });
  if (!res.ok) return json({ sent: false, reason: "envoi", status: res.status }, 502);
  return json({ sent: true, to: clientEmail });
});
