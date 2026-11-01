import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Rappels envoyés chaque matin (J-3, J-1 et/ou le jour même, selon les réglages du pro) :
//  - au professionnel (compte CallRDV)
//  - à son client, si on connaît son email (saisi dans le RDV ou présent dans sa fiche client)
// Les emails partent dans la langue du compte du pro (fr ou en).
// Les clés viennent des secrets Supabase, jamais écrites dans le code.
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://vcnguzlwyacnlysnsogv.supabase.co";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DB = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const emailOk = (e: unknown) => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
// Nom affiché dans l'expéditeur : pas de caractères qui casseraient l'en-tête
const nomExpediteur = (n: unknown) => String(n ?? "").replace(/[<>"\\\r\n,;]/g, "").trim().slice(0, 60);
const dateTxt = (iso: string, en: boolean) => {
  const d = new Date(iso + "T12:00:00Z");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(en ? "en-GB" : "fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
};

const TXT = {
  fr: {
    quand: { "j-0": "aujourd'hui", "j-1": "demain", "j-3": "dans 3 jours" } as Record<string, string>,
    rdv: "Rendez-vous", heure: "heure à préciser", a: "à",
    proSujet: (titre: string, q: string) => `Rappel : ${titre} ${q}`,
    proTitre: (q: string) => `⏰ Rappel : rendez-vous ${q}`,
    proPied: "CallRDV — callrdv.com · Rappels réglables dans ⚙️ Paramètres",
    cliSujet: (q: string) => `Rappel : votre rendez-vous ${q}`,
    cliTitre: (q: string) => `⏰ Votre rendez-vous ${q}`,
    bonjour: "Bonjour", rappel: "Nous vous rappelons votre rendez-vous", avec: "avec",
    bouton: "Confirmer ou annuler mon RDV",
    empechement: (pro: string, repondre: boolean) => `En cas d'empêchement, merci de prévenir${pro ? ` ${pro}` : ""} au plus vite${repondre ? " en répondant à cet email" : ""}.`,
    stop: (repondre: boolean) => repondre ? "Vous ne souhaitez plus recevoir ces rappels ? Répondez simplement « STOP » à cet email." : "Vous ne souhaitez plus recevoir ces rappels ? Écrivez-nous via le formulaire de contact de callrdv.com.",
    envoye: (avec: string) => `Rappel envoyé${avec} via CallRDV — callrdv.com`,
  },
  en: {
    quand: { "j-0": "today", "j-1": "tomorrow", "j-3": "in 3 days" } as Record<string, string>,
    rdv: "Appointment", heure: "time to be confirmed", a: "at",
    proSujet: (titre: string, q: string) => `Reminder: ${titre} ${q}`,
    proTitre: (q: string) => `⏰ Reminder: appointment ${q}`,
    proPied: "CallRDV — callrdv.com · Reminders can be changed in ⚙️ Settings",
    cliSujet: (q: string) => `Reminder: your appointment ${q}`,
    cliTitre: (q: string) => `⏰ Your appointment ${q}`,
    bonjour: "Hello", rappel: "This is a reminder of your appointment", avec: "with",
    bouton: "Confirm or cancel my appointment",
    empechement: (pro: string, repondre: boolean) => `If you can't make it, please let${pro ? ` ${pro}` : " us"} know as soon as possible${repondre ? " by replying to this email" : ""}.`,
    stop: (repondre: boolean) => repondre ? "Don't want these reminders any more? Just reply \"STOP\" to this email." : "Don't want these reminders any more? Write to us through the contact form on callrdv.com.",
    envoye: (avec: string) => `Reminder sent${avec} via CallRDV — callrdv.com`,
  },
};

async function envoyer(payload: Record<string, unknown>) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.ok ? null : `${r.status}`;
}

Deno.serve(async () => {
  const today = new Date();
  const j1 = new Date(today); j1.setDate(today.getDate() + 1);
  const j3 = new Date(today); j3.setDate(today.getDate() + 3);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const tagDe: Record<string, string> = { [fmt(today)]: "j-0", [fmt(j1)]: "j-1", [fmt(j3)]: "j-3" };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments?select=*,profiles(name,email,rappels,lang)&date=in.(${fmt(today)},${fmt(j1)},${fmt(j3)})`, { headers: DB });
  const rdvs = await res.json();
  if (!Array.isArray(rdvs)) {
    return new Response(JSON.stringify({ ok: false, error: "lecture RDV", detail: rdvs }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  // Fiches clients des pros concernés, pour retrouver l'email du client s'il n'est pas sur le RDV
  const userIds = [...new Set(rdvs.map((r) => r.user_id).filter(Boolean))];
  const fiches = new Map<string, string>();
  if (userIds.length) {
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/patients?select=user_id,nom,email&user_id=in.(${userIds.join(",")})&email=not.is.null`, { headers: DB });
    const patients = await pr.json();
    if (Array.isArray(patients)) {
      for (const p of patients) {
        if (p.nom && emailOk(p.email)) fiches.set(`${p.user_id}|${String(p.nom).trim().toLowerCase()}`, p.email.trim());
      }
    }
  }

  let sentPro = 0, sentClient = 0;
  const failed: string[] = [];

  for (const rdv of rdvs) {
    if (rdv.statut === "annule") continue;
    const tag = tagDe[rdv.date];
    const rappels: string[] = rdv.profiles?.rappels || ["j-1", "j-3"];
    if (!tag || !rappels.includes(tag)) continue;

    const en = rdv.profiles?.lang === "en";
    const L = en ? TXT.en : TXT.fr;
    const proEmail = rdv.profiles?.email;
    const titre = rdv.titre || L.rdv;
    const quand = L.quand[tag];
    const heure = rdv.heure || L.heure;
    const lieu = [rdv.lieu, rdv.adresse].filter(Boolean).join(" — ");
    const date = dateTxt(rdv.date, en);

    // 1. Rappel au professionnel
    if (emailOk(proEmail)) {
      const err = await envoyer({
        from: "CallRDV <rappels@callrdv.com>",
        to: proEmail,
        subject: L.proSujet(titre, quand),
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
          <h2 style="color:#1e3a5f;">${esc(L.proTitre(quand))}</h2>
          <p style="font-size:16px;"><b>${esc(titre)}</b></p>
          <p>📅 ${esc(date)} ${L.a} ${esc(heure)}</p>
          <p>👤 ${esc(rdv.personne)}</p>
          ${lieu ? `<p>📍 ${esc(lieu)}</p>` : ""}
          <p style="color:#94a3b8;font-size:12px;margin-top:24px;">${esc(L.proPied)}</p>
        </div>`,
      });
      if (err) failed.push(`pro ${rdv.id}: ${err}`); else sentPro++;
    }

    // 2. Rappel au client (email du RDV, sinon celui de sa fiche)
    const cle = `${rdv.user_id}|${String(rdv.personne ?? "").trim().toLowerCase()}`;
    const clientEmail = emailOk(rdv.client_email) ? rdv.client_email.trim() : fiches.get(cle);
    if (clientEmail && clientEmail.toLowerCase() !== String(proEmail ?? "").toLowerCase()) {
      const pro = nomExpediteur(rdv.profiles?.name);
      const repondre = emailOk(proEmail);
      const avec = pro ? ` ${L.avec} ${esc(pro)}` : "";
      // Lien personnel pour confirmer / annuler (page callrdv.com, protégée par le jeton du RDV)
      const lien = rdv.reponse_token ? `https://callrdv.com/?rdv=${encodeURIComponent(rdv.id)}&t=${encodeURIComponent(rdv.reponse_token)}` : "";
      const err = await envoyer({
        from: pro ? `${pro} via CallRDV <rappels@callrdv.com>` : "CallRDV <rappels@callrdv.com>",
        to: clientEmail,
        ...(repondre ? { reply_to: proEmail } : {}),
        subject: L.cliSujet(quand),
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
          <h2 style="color:#1e3a5f;">${esc(L.cliTitre(quand))}</h2>
          <p>${L.bonjour} ${esc(rdv.personne)},</p>
          <p>${L.rappel}${avec}${en ? ":" : " :"}</p>
          <p style="font-size:16px;"><b>${esc(titre)}</b></p>
          <p>📅 ${esc(date)} ${L.a} ${esc(heure)}</p>
          ${lieu ? `<p>📍 ${esc(lieu)}</p>` : ""}
          ${lien ? `<p style="margin:24px 0;"><a href="${lien}" style="background:#1e3a5f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;display:inline-block;">${esc(L.bouton)}</a></p>` : ""}
          <p>${esc(L.empechement(pro, repondre))}</p>
          <p style="color:#94a3b8;font-size:12px;margin-top:24px;">${esc(L.stop(repondre))}<br/>${L.envoye(avec)}</p>
        </div>`,
      });
      if (err) failed.push(`client ${rdv.id}: ${err}`); else sentClient++;
    }
  }

  return new Response(JSON.stringify({ ok: failed.length === 0, sentPro, sentClient, failed }), { headers: { "Content-Type": "application/json" } });
});
