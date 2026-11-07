import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Réservation en ligne : page publique callrdv.com/?r=<lien>
//  - action "page"     : infos publiques du pro (nom, adresse, téléphone, prestations)
//  - action "creneaux" : créneaux libres pour une prestation, sur les prochains jours
//  - action "reserver" : enregistre la réservation (contrôle anti double-réservation côté base),
//                        crée ou complète la fiche client, prévient le client et le pro par email
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://vcnguzlwyacnlysnsogv.supabase.co";
// Clé serveur : nouvelle clé secrète (sb_secret_…, « default ») si elle existe, sinon l'ancienne service_role.
// Les nouvelles clés passent seulement dans l'en-tête apikey (pas dans Authorization : ce ne sont pas des JWT).
function cleServeur(): string {
  try { const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")?.default; if (typeof k === "string" && k) return k; } catch { /* ignoré */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}
const SUPABASE_KEY = cleServeur();
const AUTH_DB: Record<string, string> = SUPABASE_KEY.startsWith("sb_") ? { "apikey": SUPABASE_KEY } : { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };
const DB = { ...AUTH_DB, "Content-Type": "application/json" };
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const emailOk = (e: unknown) => typeof e === "string" && e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const nomExpediteur = (n: unknown) => String(n ?? "").replace(/[<>"\\\r\n,;]/g, "").trim().slice(0, 60);
const propre = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const borne = (v: unknown, a: number, b: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : def;
};

type Prestation = { id: string; nom: string; duree: number };
type Reglages = {
  nom: string; adresse: string; tel: string; message: string;
  prestations: Prestation[]; horaires: Record<string, [string, string][]>;
  pas: number; delai_h: number; jours_max: number; validation: boolean; tz: string;
};

// Réglages enregistrés par le pro, nettoyés (on ne fait pas confiance au contenu brut)
function lireReglages(p: Record<string, unknown>): Reglages {
  const s = (p.booking_settings ?? {}) as Record<string, unknown>;
  const prestations: Prestation[] = (Array.isArray(s.prestations) ? s.prestations : [])
    .map((x: Record<string, unknown>, i: number) => ({
      id: propre(x?.id ?? `p${i}`, 40) || `p${i}`,
      nom: propre(x?.nom, 80),
      duree: borne(x?.duree, 5, 480, 30),
    }))
    .filter((x) => x.nom)
    .slice(0, 30);
  const horaires: Record<string, [string, string][]> = {};
  const h = (s.horaires ?? {}) as Record<string, unknown>;
  for (let j = 0; j < 7; j++) {
    const plages = Array.isArray(h[String(j)]) ? (h[String(j)] as unknown[]) : [];
    horaires[String(j)] = plages
      .filter((pl): pl is [string, string] => Array.isArray(pl) && HEURE.test(String(pl[0])) && HEURE.test(String(pl[1])) && min(String(pl[0])) < min(String(pl[1])))
      .slice(0, 3);
  }
  let tz = typeof s.tz === "string" ? s.tz : "Europe/Paris";
  try { new Intl.DateTimeFormat("fr", { timeZone: tz }); } catch { tz = "Europe/Paris"; }
  return {
    nom: propre(s.nom || p.name, 80),
    adresse: propre(s.adresse, 160),
    tel: propre(s.tel, 30),
    message: propre(s.message, 300),
    prestations: prestations.length ? prestations : [{ id: "rdv", nom: p.lang === "en" ? "Appointment" : "Rendez-vous", duree: 30 }],
    horaires,
    pas: borne(s.pas, 5, 120, 30),
    delai_h: borne(s.delai_h, 0, 168, 2),
    jours_max: borne(s.jours_max, 1, 90, 30),
    validation: s.validation === true,
    tz,
  };
}

// Date du jour et minute actuelle dans le fuseau du pro
function maintenant(tz: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { jour: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute) };
}
const ajouterJours = (jour: string, n: number) => {
  const d = new Date(jour + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const jourSemaine = (jour: string) => new Date(jour + "T12:00:00Z").getUTCDay();

async function chargerPro(slug: string) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?booking_slug=ilike.${encodeURIComponent(slug)}&booking_enabled=is.true&select=id,name,email,lang,metier,plan,usage,booking_slug,booking_settings&limit=1`,
    { headers: DB },
  );
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

// Créneaux libres : horaires du pro − délai minimum − RDV déjà pris (hors annulés)
async function calculerCreneaux(pro: Record<string, unknown>, R: Reglages, duree: number) {
  const now = maintenant(R.tz);
  const limiteMin = now.minute + R.delai_h * 60; // minutes depuis minuit aujourd'hui
  const fin = ajouterJours(now.jour, R.jours_max);
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/appointments?user_id=eq.${pro.id}&date=gte.${now.jour}&date=lte.${fin}&statut=neq.annule&select=date,heure,duree_min`,
    { headers: DB },
  );
  const pris = await r.json();
  const occupe: Record<string, [number, number][]> = {};
  for (const a of Array.isArray(pris) ? pris : []) {
    if (!HEURE.test(String(a.heure ?? ""))) continue;
    const d = min(a.heure);
    (occupe[a.date] ??= []).push([d, d + (a.duree_min || 30)]);
  }
  const jours: { date: string; heures: string[] }[] = [];
  for (let i = 0; i <= R.jours_max; i++) {
    const date = ajouterJours(now.jour, i);
    const heures: string[] = [];
    for (const [a, b] of R.horaires[String(jourSemaine(date))] ?? []) {
      for (let t = min(a); t + duree <= min(b); t += R.pas) {
        if (i * 1440 + t < limiteMin) continue;
        if ((occupe[date] ?? []).some(([x, y]) => x < t + duree && y > t)) continue;
        heures.push(hhmm(t));
      }
    }
    jours.push({ date, heures });
  }
  return jours;
}

function dateLisible(date: string, en: boolean) {
  const d = new Date(date + "T12:00:00Z");
  return d.toLocaleDateString(en ? "en-GB" : "fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

async function envoyer(payload: Record<string, unknown>) {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return r.ok;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "methode" }, 405);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "requete" }, 400); }
  const slug = String(body.slug ?? "").trim().toLowerCase();
  const action = String(body.action ?? "page");
  if (!SLUG.test(slug)) return json({ error: "introuvable" }, 404);

  const pro = await chargerPro(slug);
  if (!pro) return json({ error: "introuvable" }, 404);
  const R = lireReglages(pro);
  const en = pro.lang === "en";

  if (action === "page") {
    const jours = new Set<number>();
    for (let j = 0; j < 7; j++) if (R.horaires[String(j)].length) jours.add(j);
    return json({
      nom: R.nom, adresse: R.adresse, tel: R.tel, message: R.message, metier: pro.metier || "",
      lang: en ? "en" : "fr", prestations: R.prestations, validation: R.validation,
      jours_ouverts: [...jours], complet: (pro.plan ?? "free") === "free" && (pro.usage ?? 0) >= 10,
    });
  }

  const prestation = R.prestations.find((p) => p.id === String(body.prestation ?? ""));
  if (!prestation) return json({ error: "prestation" }, 400);

  if (action === "creneaux") {
    return json({ jours: await calculerCreneaux(pro, R, prestation.duree) });
  }

  if (action !== "reserver") return json({ error: "action" }, 400);

  // Champ piège invisible : un robot le remplit, un humain non
  if (propre(body.site, 50)) return json({ ok: true, statut: "confirme" });

  const date = String(body.date ?? "");
  const heure = String(body.heure ?? "");
  const nom = propre(body.nom, 80);
  const email = propre(body.email, 120).toLowerCase();
  const tel = propre(body.tel, 30);
  const message = propre(body.message, 300);
  if (!DATE.test(date) || !HEURE.test(heure)) return json({ error: "requete" }, 400);
  if (nom.length < 2) return json({ error: "nom" }, 400);
  if (!emailOk(email)) return json({ error: "email" }, 400);
  if (tel && !/^[+0-9 ().-]{6,30}$/.test(tel)) return json({ error: "tel" }, 400);

  // Le créneau doit faire partie des créneaux proposés (horaires, délai, fenêtre de réservation)
  const jours = await calculerCreneaux(pro, R, prestation.duree);
  if (!jours.find((j) => j.date === date)?.heures.includes(heure)) return json({ error: "pris" }, 409);

  const statut = R.validation ? "a_valider" : "confirme";
  const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reserver_creneau`, {
    method: "POST",
    headers: DB,
    body: JSON.stringify({
      p_user: pro.id, p_date: date, p_heure: heure, p_duree: prestation.duree, p_personne: nom,
      p_titre: prestation.nom, p_lieu: R.adresse, p_notes: message, p_email: email, p_tel: tel, p_statut: statut,
    }),
  });
  const res = rpc.ok ? await rpc.json() : { error: "serveur" };
  if (!res?.ok) return json({ error: res?.error || "serveur" }, res?.error === "serveur" ? 500 : 409);

  // Fiche client : on complète celle qui existe (même email ou même téléphone), sinon on la crée
  try {
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/patients?user_id=eq.${pro.id}&select=id,nom,email,telephone`, { headers: DB });
    const fiches = await pr.json();
    const chiffres = (t: unknown) => String(t ?? "").replace(/\D/g, "").slice(-9);
    const f = Array.isArray(fiches)
      ? fiches.find((p) => String(p.email ?? "").trim().toLowerCase() === email || (tel && chiffres(p.telephone) && chiffres(p.telephone) === chiffres(tel)))
      : null;
    if (f) {
      const maj: Record<string, string> = {};
      if (!f.email) maj.email = email;
      if (!f.telephone && tel) maj.telephone = tel;
      if (Object.keys(maj).length) await fetch(`${SUPABASE_URL}/rest/v1/patients?id=eq.${f.id}`, { method: "PATCH", headers: DB, body: JSON.stringify(maj) });
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/patients`, {
        method: "POST", headers: DB,
        body: JSON.stringify({ user_id: pro.id, nom, email, telephone: tel || null, categorie: pro.metier || null }),
      });
    }
  } catch { /* la réservation est faite, la fiche n'est qu'un plus */ }

  // Emails : client puis pro
  const proNom = nomExpediteur(R.nom);
  const quand = `${dateLisible(date, en)} ${en ? "at" : "à"} ${heure}`;
  const lien = `https://callrdv.com/?rdv=${encodeURIComponent(res.id)}&t=${encodeURIComponent(res.reponse_token)}`;
  const aValider = statut === "a_valider";
  const proEmail = emailOk(pro.email) ? String(pro.email).trim() : "";
  const T = en
    ? {
      sujet: aValider ? "Booking request received" : "Your appointment is booked",
      titre: aValider ? "⏳ Booking request received" : "✅ Your appointment is booked",
      intro: aValider ? `${esc(proNom)} will confirm your request shortly. You will get an email.` : `Your appointment with ${esc(proNom)} is confirmed:`,
      bouton: aValider ? "Cancel my request" : "Confirm or cancel my appointment",
      rappel: "You will get an email reminder before the appointment.",
      pied: "Booked online via CallRDV — callrdv.com",
      proSujet: aValider ? "New booking request to approve" : "New online booking",
      proIntro: aValider ? "A client asked for an appointment. Approve or decline it in CallRDV:" : "A client booked online:",
      ouvrir: "Open CallRDV",
    }
    : {
      sujet: aValider ? "Demande de rendez-vous reçue" : "Votre rendez-vous est confirmé",
      titre: aValider ? "⏳ Demande de rendez-vous reçue" : "✅ Votre rendez-vous est confirmé",
      intro: aValider ? `${esc(proNom)} va valider votre demande. Vous recevrez un email.` : `Votre rendez-vous avec ${esc(proNom)} est confirmé :`,
      bouton: aValider ? "Annuler ma demande" : "Confirmer ou annuler mon RDV",
      rappel: "Vous recevrez un rappel par email avant le rendez-vous.",
      pied: "Réservé en ligne via CallRDV — callrdv.com",
      proSujet: aValider ? "Nouvelle demande de RDV à valider" : "Nouvelle réservation en ligne",
      proIntro: aValider ? "Un client demande un rendez-vous. Acceptez ou refusez-le dans CallRDV :" : "Un client a réservé en ligne :",
      ouvrir: "Ouvrir CallRDV",
    };
  const bloc = `<p style="font-size:16px;"><b>${esc(prestation.nom)}</b></p>
    <p>📅 ${esc(quand)}</p>${R.adresse ? `<p>📍 ${esc(R.adresse)}</p>` : ""}`;
  const mailClient = envoyer({
    from: proNom ? `${proNom} via CallRDV <rappels@callrdv.com>` : "CallRDV <rappels@callrdv.com>",
    to: email,
    ...(proEmail ? { reply_to: proEmail } : {}),
    subject: proNom ? `${T.sujet} — ${proNom}` : T.sujet,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="color:#2450E6;">${T.titre}</h2>
      <p>${en ? "Hello" : "Bonjour"} ${esc(nom)},</p><p>${T.intro}</p>${bloc}
      <p style="margin:24px 0;"><a href="${lien}" style="background:#2450E6;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;display:inline-block;">${T.bouton}</a></p>
      ${aValider ? "" : `<p>${T.rappel}</p>`}
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">${T.pied}</p></div>`,
  });
  const mailPro = proEmail && proEmail.toLowerCase() !== email
    ? envoyer({
      from: "CallRDV <rappels@callrdv.com>",
      to: proEmail,
      reply_to: email,
      subject: `${T.proSujet} — ${nom}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="color:#2450E6;">${T.proSujet}</h2><p>${T.proIntro}</p>
        <p><b>${esc(nom)}</b><br>✉️ ${esc(email)}${tel ? `<br>📞 ${esc(tel)}` : ""}</p>${bloc}
        ${message ? `<p>💬 « ${esc(message)} »</p>` : ""}
        <p style="margin:24px 0;"><a href="https://callrdv.com" style="background:#2450E6;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;display:inline-block;">${T.ouvrir}</a></p></div>`,
    })
    : Promise.resolve(false);
  const [envoiClient] = await Promise.all([mailClient, mailPro]);

  return json({
    ok: true, statut, email_envoye: envoiClient,
    rdv: { prestation: prestation.nom, date, heure, adresse: R.adresse, nom: R.nom, duree: prestation.duree },
    lien,
  });
});
