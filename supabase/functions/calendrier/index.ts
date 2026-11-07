import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Calendrier d'un pro au format iCalendar (.ics), pour s'y abonner depuis Google Calendar, Apple Calendar ou Outlook.
// Adresse : /functions/v1/calendrier/<jeton>.ics  (ou ?t=<jeton>)
// Le jeton secret (profiles.calendar_token) suffit à lire les RDV : il se change depuis les Réglages de l'appli.
// Lecture seule : rien n'est jamais modifié ici.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://vcnguzlwyacnlysnsogv.supabase.co";
// Clé serveur : nouvelle clé secrète (sb_secret_…, « default ») si elle existe, sinon l'ancienne service_role.
// Les nouvelles clés passent seulement dans l'en-tête apikey (pas dans Authorization : ce ne sont pas des JWT).
function cleServeur(): string {
  try { const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")?.default; if (typeof k === "string" && k) return k; } catch { /* ignoré */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}
const SUPABASE_KEY = cleServeur();
const AUTH_DB: Record<string, string> = SUPABASE_KEY.startsWith("sb_") ? { "apikey": SUPABASE_KEY } : { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };
const DB = { ...AUTH_DB };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TXT = {
  fr: { rdv: "Rendez-vous", annule: "Annulé", statut: { en_attente: "En attente", confirme: "Confirmé", reporte: "Reporté", annule: "Annulé", a_valider: "À valider" } as Record<string, string>, tel: "Tél.", notes: "Notes", pied: "Géré avec CallRDV — callrdv.com" },
  en: { rdv: "Appointment", annule: "Cancelled", statut: { en_attente: "Pending", confirme: "Confirmed", reporte: "Postponed", annule: "Cancelled", a_valider: "To approve" } as Record<string, string>, tel: "Phone", notes: "Notes", pied: "Managed with CallRDV — callrdv.com" },
};

// Texte iCalendar : \ ; , et retours à la ligne doivent être échappés
const esc = (v: unknown) => String(v ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// Lignes de 75 octets maximum, la suite commence par un espace (sans couper un caractère accentué)
const plier = (ligne: string) => {
  const enc = new TextEncoder();
  if (enc.encode(ligne).length <= 75) return ligne;
  const morceaux: string[] = []; let cur = ""; let taille = 0;
  for (const ch of ligne) {
    const n = enc.encode(ch).length;
    const max = morceaux.length === 0 ? 75 : 74;
    if (taille + n > max) { morceaux.push(cur); cur = ""; taille = 0; }
    cur += ch; taille += n;
  }
  morceaux.push(cur);
  return morceaux.join("\r\n ");
};
const deuxChiffres = (n: number) => String(n).padStart(2, "0");
const dateIcs = (iso: string) => iso.replace(/-/g, "");                   // 2026-11-06 → 20261106
const heureOk = (h: unknown) => typeof h === "string" && /^\d{2}:\d{2}$/.test(h);

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const url = new URL(req.url);
  const dernier = url.pathname.split("/").pop() ?? "";
  const jeton = (url.searchParams.get("t") || dernier.replace(/\.ics$/i, "")).trim();
  if (!UUID.test(jeton)) return new Response("Calendrier introuvable", { status: 404 });

  const pr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?calendar_token=eq.${jeton}&select=id,name,lang`, { headers: DB });
  const profils = await pr.json();
  const profil = Array.isArray(profils) ? profils[0] : null;
  if (!profil) return new Response("Calendrier introuvable", { status: 404 });
  const L = profil.lang === "en" ? TXT.en : TXT.fr;

  // RDV des 3 derniers mois et à venir
  const depuis = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const [ra, rp] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/appointments?user_id=eq.${profil.id}&date=gte.${depuis}&select=id,titre,personne,date,heure,duree_min,lieu,adresse,notes,statut,client_email&order=date.asc`, { headers: DB }),
    fetch(`${SUPABASE_URL}/rest/v1/patients?user_id=eq.${profil.id}&select=nom,telephone`, { headers: DB }),
  ]);
  const rdvs = await ra.json();
  const fiches = await rp.json();
  const telDe = new Map<string, string>();
  if (Array.isArray(fiches)) for (const f of fiches) if (f.nom && f.telephone) telDe.set(String(f.nom).trim().toLowerCase(), String(f.telephone).trim());

  const maintenant = new Date();
  const stamp = `${maintenant.getUTCFullYear()}${deuxChiffres(maintenant.getUTCMonth() + 1)}${deuxChiffres(maintenant.getUTCDate())}T${deuxChiffres(maintenant.getUTCHours())}${deuxChiffres(maintenant.getUTCMinutes())}${deuxChiffres(maintenant.getUTCSeconds())}Z`;
  const nomCal = profil.name ? `CallRDV · ${profil.name}` : "CallRDV";

  const l: string[] = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CallRDV//callrdv.com//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(nomCal)}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  for (const r of Array.isArray(rdvs) ? rdvs : []) {
    if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
    const annule = r.statut === "annule";
    const titre = `${r.personne || L.rdv} · ${r.titre || L.rdv}`;
    const tel = telDe.get(String(r.personne ?? "").trim().toLowerCase());
    const desc = [
      L.statut[r.statut] || L.statut.en_attente,
      tel ? `${L.tel} ${tel}` : "",
      r.client_email ? `Email ${r.client_email}` : "",
      r.notes ? `${L.notes} : ${r.notes}` : "",
    ].filter(Boolean).join("\n") + "\n\n" + L.pied;
    l.push("BEGIN:VEVENT", `UID:${r.id}@callrdv.com`, `DTSTAMP:${stamp}`);
    if (heureOk(r.heure)) {
      // Heure « locale » (sans fuseau) : affichée telle quelle, à l'heure du téléphone du pro
      const [h, m] = r.heure.split(":").map(Number);
      const duree = Number(r.duree_min) > 0 ? Number(r.duree_min) : 60;
      const fin = new Date(Date.UTC(2000, 0, 1, h, m) + duree * 60000);
      const jourFin = fin.getUTCDate() === 2 ? new Date(new Date(r.date + "T12:00:00Z").getTime() + 86400000).toISOString().slice(0, 10) : r.date;
      l.push(`DTSTART:${dateIcs(r.date)}T${deuxChiffres(h)}${deuxChiffres(m)}00`, `DTEND:${dateIcs(jourFin)}T${deuxChiffres(fin.getUTCHours())}${deuxChiffres(fin.getUTCMinutes())}00`);
    } else {
      const lendemain = new Date(new Date(r.date + "T12:00:00Z").getTime() + 86400000).toISOString().slice(0, 10);
      l.push(`DTSTART;VALUE=DATE:${dateIcs(r.date)}`, `DTEND;VALUE=DATE:${dateIcs(lendemain)}`);
    }
    l.push(`SUMMARY:${esc(annule ? `${L.annule} – ${titre}` : titre)}`);
    const lieu = [r.lieu, r.adresse].filter(Boolean).join(" — ");
    if (lieu) l.push(`LOCATION:${esc(lieu)}`);
    l.push(`DESCRIPTION:${esc(desc)}`, `STATUS:${annule ? "CANCELLED" : r.statut === "a_valider" ? "TENTATIVE" : "CONFIRMED"}`, "TRANSP:OPAQUE", "END:VEVENT");
  }
  l.push("END:VCALENDAR");
  const corps = l.map(plier).join("\r\n") + "\r\n";

  return new Response(req.method === "HEAD" ? null : corps, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="callrdv.ics"',
      "Cache-Control": "no-cache, max-age=0",
    },
  });
});
