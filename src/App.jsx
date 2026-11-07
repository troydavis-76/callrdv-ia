import React, { useState, useEffect, useRef } from "react";

const CONFIG = {
  SUPABASE_URL: "https://vcnguzlwyacnlysnsogv.supabase.co",
  // Clé publique (publishable) : faite pour être dans le site, la sécurité repose sur les règles RLS
  SUPABASE_ANON_KEY: "sb_publishable__YJ8PUzvcn5G5wYqdoelfg_oLQu56WD",
  STRIPE_LINK: "https://buy.stripe.com/8x2aEX5th2V02lIdJccMM02", // abonnement unique 20€/mois
};

// Supabase client leger (sans SDK)
const sb = {
  url: CONFIG.SUPABASE_URL,
  key: CONFIG.SUPABASE_ANON_KEY,
  headers: (token) => ({
    "Content-Type": "application/json",
    "apikey": CONFIG.SUPABASE_ANON_KEY,
    // Clé publique seulement dans apikey ; Authorization ne porte que le jeton de l'utilisateur connecté
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  }),
  async signUp(email, password, name) {
    const r = await fetch(`${this.url}/auth/v1/signup`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ email, password, data: { name } }),
    });
    return r.json();
  },
  async signIn(email, password) {
    const r = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },
  async getProfile(token, userId) {
    const r = await fetch(`${this.url}/rest/v1/profiles?id=eq.${userId}&select=*`, {
      headers: this.headers(token),
    });
    const data = await r.json();
    return data[0];
  },
  async updateProfile(token, userId, data) {
    await fetch(`${this.url}/rest/v1/profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers: { ...this.headers(token), "Prefer": "return=minimal" },
      body: JSON.stringify(data),
    });
  },
  async getAppointments(token, userId) {
    const r = await fetch(`${this.url}/rest/v1/appointments?user_id=eq.${userId}&order=confirmed_at.desc&select=*`, {
      headers: this.headers(token),
    });
    return r.json();
  },
  async addAppointment(token, userId, rdv) {
    const payload = { ...rdv, user_id: userId };
    console.log("[RDV] Envoi:", payload);
    const r = await fetch(`${this.url}/rest/v1/appointments`, {
      method: "POST",
      headers: { ...this.headers(token), "Prefer": "return=representation" },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("[RDV] Erreur Supabase:", r.status, data);
      alert(tr("Erreur ","Error ") + r.status + " : " + JSON.stringify(data));
    }
    return data;
  },
  async addAnalyse(token, userId, rdv_detecte) {
    await fetch(`${this.url}/rest/v1/analyses`, {
      method: "POST",
      headers: this.headers(token),
      body: JSON.stringify({ user_id: userId, rdv_detecte }),
    });
  },
  async getPatients(token, userId) {
    const r = await fetch(`${this.url}/rest/v1/patients?user_id=eq.${userId}&order=nom.asc&select=*`, {
      headers: this.headers(token),
    });
    return r.json();
  },
  async addPatient(token, userId, patient) {
    const r = await fetch(`${this.url}/rest/v1/patients`, {
      method: "POST",
      headers: { ...this.headers(token), "Prefer": "return=representation" },
      body: JSON.stringify({ ...patient, user_id: userId }),
    });
    return r.json();
  },
  async updatePatient(token, patientId, data) {
    await fetch(`${this.url}/rest/v1/patients?id=eq.${patientId}`, {
      method: "PATCH",
      headers: { ...this.headers(token), "Prefer": "return=minimal" },
      body: JSON.stringify(data),
    });
  },
  async deleteAppointment(token, id) {
    await fetch(`${this.url}/rest/v1/appointments?id=eq.${id}`, {
      method: "DELETE",
      headers: this.headers(token)
    });
  },
  async updateAppointment(token, id, data) {
    const r = await fetch(`${this.url}/rest/v1/appointments?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...this.headers(token), "Prefer": "return=representation" },
      body: JSON.stringify(data)
    });
    return r.json();
  },
  // Ajout de plusieurs clients en une requête
  async addPatients(token, userId, list) {
    const r = await fetch(`${this.url}/rest/v1/patients`, {
      method: "POST",
      headers: { ...this.headers(token), "Prefer": "return=representation" },
      body: JSON.stringify(list.map(p => ({ ...p, user_id: userId }))),
    });
    return r.json();
  },
  // Suppression de plusieurs clients en une requête (la base ne laisse supprimer que les siens)
  async deletePatients(token, ids) {
    const r = await fetch(`${this.url}/rest/v1/patients?id=in.(${ids.join(",")})`, {
      method: "DELETE",
      headers: this.headers(token),
    });
    return r.ok;
  },
  async deletePatient(token, patientId) {
    await fetch(`${this.url}/rest/v1/patients?id=eq.${patientId}`, {
      method: "DELETE",
      headers: this.headers(token),
    });
  },
  signInWithGoogle() {
    const redirectTo = encodeURIComponent(window.location.origin);
    window.location.href = `${this.url}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}&scopes=email%20profile%20https://www.googleapis.com/auth/calendar`;
  },
  signInWithLinkedIn() {
    const redirectTo = encodeURIComponent(window.location.origin);
    window.location.href = `${this.url}/auth/v1/authorize?provider=linkedin_oidc&redirect_to=${redirectTo}`;
  },
  async getSessionFromUrl() {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return null;
    const params = new URLSearchParams(hash.replace("#", ""));
    const token = params.get("access_token");
    const error = params.get("error_description") || params.get("error");
    if (!token && !error) return null;
    // Nettoie l'adresse (le jeton ne reste pas dans la barre d'adresse)
    try { window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch(e) { window.location.hash = ""; }
    if (!token) return { error, errorCode: params.get("error_code") };
    return { token, refresh_token: params.get("refresh_token"), type: params.get("type") };
  },
};

const PLANS = {
  free:     { name: "Gratuit", nameEn: "Free", price: 0,  quota: 10,       color: "#94a3b8", features: ["10 RDV par mois", "Toutes les fonctionnalités", "Sans carte bancaire"], featuresEn: ["10 appointments per month", "All features", "No credit card"] },
  pro:      { name: "Pro",     nameEn: "Pro",  price: 20, quota: Infinity, color: "#2450E6", features: ["RDV illimités, par téléphone et en ligne", "Page de réservation en ligne", "Rappels email à vous et à vos clients", "Agenda synchronisé, fiches clients, export PDF", "Sans engagement"], featuresEn: ["Unlimited appointments, by phone and online", "Online booking page", "Email reminders for you and your clients", "Synced calendar, client profiles, PDF export", "Cancel anytime"] },
  business: { name: "Pro",     nameEn: "Pro",  price: 20, quota: Infinity, color: "#2450E6", features: ["RDV illimités", "Rappels email à vous et à vos clients", "Agenda, fiches clients, export PDF", "Sans engagement"], featuresEn: ["Unlimited appointments", "Email reminders for you and your clients", "Calendar, client profiles, PDF export", "Cancel anytime"] },
};

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Langue FR / EN ───────────────────────────────────────────
// Choix mémorisé, sinon langue du téléphone (français -> FR, le reste -> EN)
// Langue courante, lue par tr() et locale() dans toute l'app (mise à jour par useLang)
let CURRENT_LANG = "fr";
const tr = (fr, en) => (CURRENT_LANG === "en" ? en : fr);
const locale = () => (CURRENT_LANG === "en" ? "en-GB" : "fr-FR");

// Catégories de RDV (libellé + titre proposé), en FR et EN
const CATEGORIES = [
  { value:"medical",     fr:"🏥 Médical",            en:"🏥 Medical",              titreFr:"Consultation médicale",  titreEn:"Medical appointment" },
  { value:"dentiste",    fr:"🦷 Dentiste",           en:"🦷 Dentist",              titreFr:"Chez le dentiste",       titreEn:"Dentist appointment" },
  { value:"kine",        fr:"💪 Kiné / Ostéo",       en:"💪 Physio / Osteo",       titreFr:"Séance kiné",            titreEn:"Physio session" },
  { value:"veterinaire", fr:"🐾 Vétérinaire",        en:"🐾 Vet",                  titreFr:"Chez le vétérinaire",    titreEn:"Vet appointment" },
  { value:"garage",      fr:"🔧 Garage / Voiture",   en:"🔧 Garage / Car",         titreFr:"Révision voiture",       titreEn:"Car service" },
  { value:"travaux",     fr:"🏠 Travaux / Artisan",  en:"🏠 Home repairs / Trades", titreFr:"Intervention artisan",  titreEn:"Tradesperson visit" },
  { value:"juridique",   fr:"⚖️ Notaire / Avocat",   en:"⚖️ Notary / Lawyer",     titreFr:"RDV juridique",          titreEn:"Legal appointment" },
  { value:"banque",      fr:"🏦 Banque / Assurance", en:"🏦 Bank / Insurance",     titreFr:"RDV banque",             titreEn:"Bank appointment" },
  { value:"beaute",      fr:"💈 Coiffeur / Beauté",  en:"💈 Hair / Beauty",        titreFr:"Chez le coiffeur",       titreEn:"Hair appointment" },
  { value:"restaurant",  fr:"🍽️ Restaurant / Traiteur", en:"🍽️ Restaurant / Catering", titreFr:"Réservation restaurant", titreEn:"Restaurant booking" },
  { value:"formation",   fr:"🎓 Formation / Scolaire", en:"🎓 Training / School",  titreFr:"Réunion scolaire",       titreEn:"School meeting" },
  { value:"pro",         fr:"💼 Professionnel",      en:"💼 Business",             titreFr:"Réunion professionnelle", titreEn:"Business meeting" },
  { value:"perso",       fr:"👤 Personnel",          en:"👤 Personal",             titreFr:"RDV personnel",          titreEn:"Personal appointment" },
  { value:"autre",       fr:"📋 Autre",              en:"📋 Other",                titreFr:"Rendez-vous",            titreEn:"Appointment" },
];
// "2026-11-03" à partir d'une date locale (toISOString décalait d'un jour le soir / en heure de Paris)
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
// "mar. 3 nov. à 14:30" / "Tue 3 Nov at 14:30"
const fmtRdv = (date, heure) => {
  if (!date) return heure || "";
  const d = new Date(date + "T12:00:00");
  const txt = isNaN(d.getTime()) ? date : d.toLocaleDateString(locale(), { weekday:"short", day:"numeric", month:"short" });
  return heure ? `${txt} ${tr("à","at")} ${heure}` : txt;
};
// Texte d'un RDV à envoyer au client
const texteRdv = (rdv) => {
  let dateTxt = rdv.date || "";
  const d = new Date((rdv.date || "") + "T12:00:00");
  if (!isNaN(d.getTime())) {
    dateTxt = d.toLocaleDateString(locale(), { weekday:"long", day:"numeric", month:"long" });
    dateTxt = dateTxt.charAt(0).toUpperCase() + dateTxt.slice(1);
  }
  const lieu = [rdv.lieu, rdv.adresse].filter(Boolean).join(" — ");
  const lignes = [
    `📅 ${rdv.titre || tr("Rendez-vous","Appointment")}`,
    rdv.personne ? `👤 ${rdv.personne}` : null,
    `🕐 ${dateTxt}${rdv.heure ? tr(" à "," at ") + rdv.heure : ""}`,
    lieu ? `📍 ${lieu}` : null,
  ].filter(Boolean);
  return lignes.join("\n");
};
// Numéro au format international pour WhatsApp (06 12 34 56 78 → 33612345678)
const telInternational = (raw) => {
  let n = String(raw || "").replace(/[^\d+]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  else if (n.startsWith("00")) n = n.slice(2);
  else if (n.startsWith("0") && n.length === 10) n = "33" + n.slice(1);
  return /^\d{10,15}$/.test(n) ? n : "";
};
// Téléphone du client, pris dans sa fiche
const telClient = (rdv) => {
  const nom = (rdv.personne || "").trim().toLowerCase();
  const f = nom ? (window.__patients || []).find(p => (p.nom || "").trim().toLowerCase() === nom) : null;
  return (f?.telephone || rdv.client_tel || "").trim();
};
// Partage d'un RDV (WhatsApp, SMS… via le menu du téléphone ; sinon copie du texte)
const partagerRdv = async (rdv) => {
  const msg = texteRdv(rdv);
  if (navigator.share) {
    try { await navigator.share({ text: msg }); } catch (e) { /* partage annulé */ }
    return;
  }
  try { await navigator.clipboard.writeText(msg); alert(tr("Texte du RDV copié : collez-le dans WhatsApp ou un SMS.","Appointment text copied: paste it into WhatsApp or a text message.")); }
  catch (e) { window.prompt(tr("Copiez ce texte :","Copy this text:"), msg); }
};
// Icônes (traits fins, couleur du texte)
const ICONES = {
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z",
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  calendar: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM16 3v4M8 3v4M3 11h18",
  plus: "M12 5v14M5 12h14",
  users: "M13 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  search: "M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0zM20 20l-3.5-3.5",
  mail: "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 7l9 6 9-6",
  whatsapp: "M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.6-5.4A8.4 8.4 0 1 1 21 11.5z",
  sms: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  check: "M20 6 9 17l-5-5",
  back: "M15 18l-6-6 6-6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  trash: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
  share: "M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13",
  x: "M18 6 6 18M6 6l12 12",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  chart: "M3 3v18h18M7 15l4-4 3 3 5-6",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  pin: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  download: "M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 10l5 5 5-5M12 15V3",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
  mic: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3",
  stop: "M6 6h12v12H6z",
};
const Icon = ({ name, size = 20, color = "currentColor", stroke = 2, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink:0, ...style }}>
    <path d={ICONES[name] || ""} />
  </svg>
);
// Pastille de statut d'un RDV
const STATUTS = {
  en_attente: { cls: "pill-wait", fr: "En attente", en: "Pending" },
  confirme:   { cls: "pill-ok",   fr: "Confirmé",   en: "Confirmed" },
  reporte:    { cls: "pill-moved",fr: "Reporté",    en: "Postponed" },
  annule:     { cls: "pill-ko",   fr: "Annulé",     en: "Cancelled" },
  a_valider:  { cls: "pill-todo", fr: "À valider",  en: "To approve" },
};
const StatutPill = ({ statut }) => { const s = STATUTS[statut] || STATUTS.en_attente; return <span className={`pill ${s.cls}`}>{tr(s.fr, s.en)}</span>; };
const catLabel = (v) => { const k = CATEGORIES.find(x => x.value === v) || CATEGORIES[CATEGORIES.length - 1]; return tr(k.fr, k.en); };

function detectLang() {
  try { const s = localStorage.getItem("callrdv_lang"); if (s === "fr" || s === "en") return s; } catch(e) {}
  const nav = ((typeof navigator !== "undefined" && navigator.language) || "fr").toLowerCase();
  return nav.startsWith("fr") ? "fr" : "en";
}
function useLang() {
  const [lang, setLangState] = useState(detectLang);
  CURRENT_LANG = lang;
  useEffect(() => {
    const h = () => setLangState(detectLang());
    window.addEventListener("callrdv-lang", h);
    return () => window.removeEventListener("callrdv-lang", h);
  }, []);
  useEffect(() => { try { document.documentElement.lang = lang; } catch(e) {} }, [lang]);
  const setLang = (l) => {
    try { localStorage.setItem("callrdv_lang", l); } catch(e) {}
    CURRENT_LANG = l;
    window.dispatchEvent(new Event("callrdv-lang"));
  };
  const t = (fr, en) => (lang === "en" ? en : fr);
  return { lang, setLang, t };
}
function LangSwitch({ style }) {
  const { lang, setLang } = useLang();
  return (
    <div style={{ display:"inline-flex", border:"1px solid #e2e8f0", borderRadius:8, overflow:"hidden", background:"#fff", flexShrink:0, ...style }}>
      {["fr","en"].map(l => (
        <button key={l} onClick={() => setLang(l)} aria-label={l === "fr" ? "Français" : "English"}
          style={{ padding:"6px 10px", fontSize:12, fontWeight:700, border:"none", cursor:"pointer", background: lang === l ? "#2450E6" : "transparent", color: lang === l ? "#fff" : "#64748b", fontFamily:"inherit" }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function useAuth() {
  const [user, setUser] = useState(null);

  // Restaurer session au démarrage
  useEffect(() => {
    const saved = localStorage.getItem("callrdv_session");
    if (!saved) return;
    let { token, refresh_token, userId } = JSON.parse(saved);
    if (!userId) { localStorage.removeItem("callrdv_session"); return; }

    // Renouveler le token avec refresh_token avant tout
    const tryRestore = async () => {
      if (refresh_token) {
        try {
          const r = await fetch("https://vcnguzlwyacnlysnsogv.supabase.co/auth/v1/token?grant_type=refresh_token", {
            method: "POST",
            headers: {
              "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbmd1emx3eWFjbmx5c25zb2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDg0MTcsImV4cCI6MjA4ODIyNDQxN30.rI1WkGgUjFlw7dbl4wDtXcItDqsEc5PaqpPpF35cSuU",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ refresh_token })
          });
          if (r.ok) {
            const data = await r.json();
            token = data.access_token;
            refresh_token = data.refresh_token;
            localStorage.setItem("callrdv_session", JSON.stringify({ token, refresh_token, userId, email: data.user?.email }));
          }
        } catch(e) { console.error("Refresh error:", e); }
      }
      if (!token) { localStorage.removeItem("callrdv_session"); return; }
      sb.getProfile(token, userId).then(profile => {
      if (!profile) { localStorage.removeItem("callrdv_session"); return; }
      setUser({
        id: userId,
        email: profile.email || "",
        name: profile.name || "",
        plan: profile.plan || "free",
        usage: profile.usage || 0,
        token,
        metier: profile.metier || null,
        rappels: profile.rappels || ["j-1","j-3"],
        push_enabled: profile.push_enabled || false,
        push_j1: profile.push_j1 !== false,
        push_j3: profile.push_j3 !== false,
        push_confirm: profile.push_confirm !== false,
        calendar_token: profile.calendar_token || null,
        booking_enabled: !!profile.booking_enabled,
        booking_slug: profile.booking_slug || "",
        booking_settings: profile.booking_settings || {}
      });
    }).catch(() => localStorage.removeItem("callrdv_session"));
    };
    tryRestore();
  }, []);
  const [loading, setLoading] = useState(false);

  const signUp = async (email, password, name) => {
    setLoading(true);
    const res = await sb.signUp(email, password, name);
    const err = res.error?.message || res.error_description || res.msg;
    if (res.error_code === "weak_password") { setLoading(false); return { error: "Mot de passe trop court (6 caractères minimum)" }; }
    if (err && !res.id && !res.access_token) { setLoading(false); return { error: err || "Erreur inscription" }; }
    // Confirmation email désactivée : Supabase renvoie déjà une session
    if (res.access_token) return await signIn(email, password);
    setLoading(false);
    // Email déjà utilisé : Supabase renvoie un utilisateur sans identité et n'envoie rien
    if (Array.isArray(res.identities) && res.identities.length === 0) return { error: "Un compte existe déjà avec cet email" };
    // Compte créé : il faut cliquer sur le lien reçu par email
    return { info: "confirm" };
  };

  const signIn = async (email, password) => {
    setLoading(true);
    const res = await sb.signIn(email, password);
    if (res.error || !res.access_token) {
      setLoading(false);
      const code = res.error_code || res.error;
      if (code === "email_not_confirmed" || res.msg === "Email not confirmed" || res.error_description === "Email not confirmed") return { error: "Email not confirmed" };
      return { error: "Email ou mot de passe incorrect" };
    }
    const tk = res.access_token;
    await delay(600);
    const profile = await sb.getProfile(tk, res.user.id);
    const userData = { id: res.user.id, email: res.user.email, name: profile?.name || res.user.user_metadata?.name || "", plan: profile?.plan || "free", usage: profile?.usage || 0, token: tk, metier: profile?.metier || null, rappels: profile?.rappels || ["j-1","j-3"], push_enabled: profile?.push_enabled || false, push_j1: profile?.push_j1 !== false, push_j3: profile?.push_j3 !== false, push_confirm: profile?.push_confirm !== false, calendar_token: profile?.calendar_token || null, booking_enabled: !!profile?.booking_enabled, booking_slug: profile?.booking_slug || "", booking_settings: profile?.booking_settings || {} };
    setUser(userData);
    // Persister la session
    localStorage.setItem("callrdv_session", JSON.stringify({ token: tk, refresh_token: res.refresh_token, userId: res.user.id, email: res.user.email }));
    localStorage.setItem("callrdv_email", res.user.email);
    setLoading(false);
    return { error: null };
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem("callrdv_session");
  };

  const updateUser = async (data) => {
    setUser(prev => ({ ...prev, ...data }));
    // Sauvegarder dans Supabase
    if (user?.id && user?.token) {
      await fetch(`https://vcnguzlwyacnlysnsogv.supabase.co/rest/v1/profiles?id=eq.${user.id}`, {
        method: "PATCH",
        headers: {
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbmd1emx3eWFjbmx5c25zb2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDg0MTcsImV4cCI6MjA4ODIyNDQxN30.rI1WkGgUjFlw7dbl4wDtXcItDqsEc5PaqpPpF35cSuU",
          "Authorization": `Bearer ${user.token}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(data)
      });
    }
  };

  const loginWithToken = async (tk, refresh) => {
    const r = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/user`, {
      headers: { "apikey": CONFIG.SUPABASE_ANON_KEY, "Authorization": `Bearer ${tk}` }
    });
    const u = await r.json();
    if (!u?.id) return false;
    await delay(600);
    const profile = await sb.getProfile(tk, u.id);
    setUser({ id: u.id, email: u.email, name: profile?.name || u.user_metadata?.full_name || u.user_metadata?.name || "", plan: profile?.plan || "free", usage: profile?.usage || 0, token: tk, metier: profile?.metier || null, rappels: profile?.rappels || ["j-1","j-3"], push_enabled: profile?.push_enabled || false, push_j1: profile?.push_j1 !== false, push_j3: profile?.push_j3 !== false, push_confirm: profile?.push_confirm !== false, calendar_token: profile?.calendar_token || null, booking_enabled: !!profile?.booking_enabled, booking_slug: profile?.booking_slug || "", booking_settings: profile?.booking_settings || {} });
    localStorage.setItem("callrdv_session", JSON.stringify({ token: tk, refresh_token: refresh || null, userId: u.id, email: u.email }));
    if (u.email) localStorage.setItem("callrdv_email", u.email);
    return true;
  };

  return { user, loading, signUp, signIn, signOut, updateUser, loginWithToken };
}

// ── Nouveau mot de passe (après le lien "mot de passe oublié") ──
function NewPasswordModal({ token, onDone }) {
  const { t } = useLang();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const save = async () => {
    setError("");
    if (pwd.length < 6) { setError(t("6 caractères minimum.","6 characters minimum.")); return; }
    if (pwd !== pwd2) { setError(t("Les deux mots de passe ne sont pas identiques.","The two passwords do not match.")); return; }
    setSaving(true);
    try {
      const r = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: { "apikey": CONFIG.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd })
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) setDone(true);
      else if (data.error_code === "same_password") setError(t("Choisissez un mot de passe différent de l'ancien.","Choose a password different from the old one."));
      else if (data.error_code === "weak_password") setError(t("Mot de passe trop faible, choisissez-en un plus long.","Password too weak, choose a longer one."));
      else setError(t("Le lien a expiré. Refaites « Mot de passe oublié ».","The link has expired. Use “Forgot password” again."));
    } catch(e) { setError(t("Erreur réseau. Réessayez.","Network error. Try again.")); }
    setSaving(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000060", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div className="card fade-up" style={{ width:"100%", maxWidth:400, padding:28 }}>
        {done ? (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:44, marginBottom:10 }}>✅</div>
            <div style={{ fontWeight:800, fontSize:18, color:"#1e293b", marginBottom:8 }}>{t("Mot de passe enregistré !","Password saved!")}</div>
            <div style={{ fontSize:13, color:"#64748b", marginBottom:20 }}>{t("La prochaine fois, connectez-vous avec votre email et ce nouveau mot de passe.","Next time, log in with your email and this new password.")}</div>
            <button className="btn btn-primary" style={{ width:"100%" }} onClick={onDone}>{t("Continuer","Continue")}</button>
          </div>
        ) : (
          <>
            <div style={{ fontWeight:800, fontSize:18, color:"#1e293b", marginBottom:6 }}>🔑 {t("Choisissez votre nouveau mot de passe","Choose your new password")}</div>
            <div style={{ fontSize:13, color:"#64748b", marginBottom:18 }}>{t("Vous l'utiliserez pour vous connecter la prochaine fois.","You will use it to log in next time.")}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <input type="password" autoComplete="new-password" placeholder={t("Nouveau mot de passe","New password")} value={pwd} onChange={e=>setPwd(e.target.value)} />
              <input type="password" autoComplete="new-password" placeholder={t("Confirmez le mot de passe","Confirm password")} value={pwd2} onChange={e=>setPwd2(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()} />
            </div>
            {error && <div style={{ color:"#ef4444", fontSize:13, marginTop:10 }}>⚠ {error}</div>}
            <button className="btn btn-primary" onClick={save} disabled={saving} style={{ width:"100%", marginTop:16 }}>
              {saving ? t("⏳ Enregistrement...","⏳ Saving...") : t("Enregistrer le mot de passe","Save password")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
:root{--accent:#2450E6;--accent-dark:#1A3BB0;--accent-soft:#EEF2FF;--bg:#F5F6F8;--bg2:#fff;--card:#fff;--border:#E2E8F0;--text:#0F172A;--text2:#475569;--input-bg:#fff;--nav-bg:rgba(255,255,255,0.96);}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:'Plus Jakarta Sans',system-ui,sans-serif;transition:background .3s,color .3s;-webkit-tap-highlight-color:transparent;}
button,input,select,textarea{font-family:inherit;}
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px;}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
@keyframes ring{0%{transform:scale(1);opacity:.6;}100%{transform:scale(1.8);opacity:0;}}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes blink{0%,100%{opacity:1;}50%{opacity:.3;}}
@keyframes slideIn{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
@keyframes formOpen{from{opacity:0;transform:scale(.97);}to{opacity:1;transform:scale(1);}}
.fade-up{animation:fadeUp .4s ease both;}
.form-open{animation:formOpen .35s ease both;}
.btn{font-family:inherit;font-weight:700;border:none;cursor:pointer;transition:all .2s;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;}
.btn-primary{background:var(--accent);color:#fff;padding:14px 24px;font-size:15px;min-height:48px;}
.btn-primary:hover{background:var(--accent-dark);box-shadow:0 6px 18px rgba(36,80,230,.28);}
.btn-primary:disabled{opacity:.4;cursor:not-allowed;box-shadow:none;}
.btn-red{background:#DC2626;color:#fff;padding:14px 24px;font-size:15px;min-height:48px;}
.btn-red:hover{background:#B91C1C;}
.btn-outline{background:#fff;color:var(--text);border:1px solid var(--border);padding:12px 20px;font-size:14px;min-height:46px;}
.btn-outline:hover{border-color:var(--accent);color:var(--accent);}
.btn-sm{padding:8px 14px;font-size:13px;border-radius:10px;min-height:38px;}
.card{background:var(--card);border:none;border-radius:18px;padding:22px;box-shadow:0 1px 2px rgba(15,23,42,.05),0 6px 20px rgba(15,23,42,.05);}
input,select{background:#fff;border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:15px;padding:12px 14px;width:100%;outline:none;transition:border-color .2s,box-shadow .2s;min-height:48px;}
input:focus,select:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(36,80,230,.15);}
input::placeholder{color:#94a3b8;}
textarea{background:#fff;border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:15px;padding:14px;width:100%;resize:none;outline:none;transition:border-color .2s;line-height:1.6;}
textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(36,80,230,.15);}
textarea::placeholder{color:#94a3b8;}
.spinner{width:20px;height:20px;border:2px solid #e2e8f0;border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;display:inline-block;}
.privacy-badge{background:#F8FAFC;border:1px solid var(--border);border-radius:12px;padding:12px 16px;display:flex;align-items:flex-start;gap:10px;}
.erased-banner{background:#F0FDF4;border:1px solid #BBF7D0;border-radius:14px;padding:14px 18px;display:flex;align-items:center;gap:12px;animation:slideIn .4s ease;}
.field-label{font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px;}
/* Pastilles de statut */
.pill{display:inline-flex;align-items:center;font-size:12px;font-weight:700;border-radius:999px;padding:4px 10px;white-space:nowrap;}
.pill-ok{color:#15803D;background:#DCFCE7;}
.pill-wait{color:#B45309;background:#FEF3C7;}
.pill-ko{color:#B91C1C;background:#FEE2E2;}
.pill-moved{color:#1D4ED8;background:#DBEAFE;}
.pill-past{color:#475569;background:#F1F5F9;}
.pill-todo{color:#9A3412;background:#FFEDD5;}
.pill-online{color:#3730A3;background:#E0E7FF;}
.badge-num{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#EA580C;color:#fff;font-size:11px;font-weight:800;line-height:1;}
/* Cases à toucher (jour, heure) */
.chip{border:1px solid var(--border);background:#fff;border-radius:12px;font-weight:700;color:var(--text);cursor:pointer;transition:all .15s;}
.chip:hover{border-color:var(--accent);}
.chip-on{background:var(--accent) !important;border-color:var(--accent) !important;color:#fff !important;}
.chip-dash{border-style:dashed;background:transparent;color:var(--text2);}
/* Onglets du haut (ordinateur) */
.app-tabs{background:#fff;border-bottom:1px solid var(--border);display:flex;gap:4px;padding:0 16px;}
.app-tab{padding:14px 18px;font-size:14px;font-weight:600;border:none;cursor:pointer;background:transparent;color:var(--text2);display:flex;align-items:center;gap:8px;border-bottom:3px solid transparent;}
.app-tab-on{color:var(--accent);border-bottom-color:var(--accent);font-weight:700;}
/* Barre d'onglets du bas (téléphone) */
.bottom-nav{display:none;}
.fab-desktop{display:none !important;}
.bottom-nav a,.bottom-nav button{-webkit-appearance:none;}
@media(max-width:700px){
  .app-tabs{display:none !important;}
  .fab-desktop{display:none !important;}
  .bottom-nav{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:end;position:fixed;left:0;right:0;bottom:0;z-index:150;background:#fff;border-top:1px solid var(--border);padding:6px 8px calc(10px + env(safe-area-inset-bottom));}
  .bn-item{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:600;color:#64748B;background:none;border:none;padding:6px 0;min-height:48px;cursor:pointer;}
  .bn-on{color:var(--accent);font-weight:700;}
  .bn-plus{width:56px;height:56px;border-radius:18px;background:var(--accent);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(36,80,230,.35);margin:-22px auto 0;border:none;cursor:pointer;}
  .app-root{padding-bottom:84px;}
  .app-body-home{flex-direction:column !important;overflow-y:auto !important;}
  .app-body-home .app-main{flex:none !important;overflow:visible !important;border-right:none !important;padding:16px 16px 4px !important;}
  .app-body-home .app-side{width:100% !important;overflow:visible !important;border-top:none !important;background:transparent !important;padding:4px 16px 16px !important;}
  .pv-left{width:100% !important;border-right:none !important;}
  .pv-list .pv-right{display:none !important;}
  .pv-detail .pv-left{display:none !important;}
  .pv-right{padding:16px !important;}
  .pv-back{display:flex !important;}
  .cal-head{padding:14px 16px !important;}
  .cal-tools{width:100%;}
  .cal-search{flex:1;min-width:0;width:auto !important;}
  .cal-nav{width:100%;justify-content:space-between;gap:6px !important;}
  .cal-title{min-width:0 !important;font-size:15px !important;}
  .cal-list{padding:12px 16px 16px !important;}
  .app-nav{padding:12px 16px !important;}
  .app-nav-name{display:none;}
  .app-nav-right{gap:6px !important;}
  .hide-phone{display:none !important;}
  .sheet-fond{align-items:flex-end !important;padding:0 !important;}
  .sheet{max-width:none !important;border-radius:24px 24px 0 0 !important;padding:20px 18px calc(22px + env(safe-area-inset-bottom)) !important;}
}
`;

// ── Auth Page ────────────────────────────────────────────────
function AuthPage({ authHooks, initialMode }) {
  const [mode, setMode] = useState(initialMode === "register" ? "register" : "login");
  const [email, setEmail] = useState(() => localStorage.getItem("callrdv_email") || "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const { signIn, signUp, loading } = authHooks;
  const { t } = useLang();

  const handle = async () => {
    setError(""); setInfo("");
    const res = mode === "login" ? await signIn(email, password) : await signUp(email, password, name);
    if (res.info === "confirm") {
      setInfo(t(`✅ Compte créé ! Un email de confirmation a été envoyé à ${email}. Cliquez sur le lien qu'il contient (pensez à regarder dans les spams), puis connectez-vous ici.`,
                `✅ Account created! A confirmation email was sent to ${email}. Click the link inside (check your spam folder too), then log in here.`));
      setMode("login"); setPassword("");
      return;
    }
    if (res.error) {
      const traduits = { "Email ou mot de passe incorrect": "Wrong email or password", "Erreur inscription": "Sign-up error", "Un compte existe déjà avec cet email": "An account already exists with this email", "Mot de passe trop court (6 caractères minimum)": "Password too short (6 characters minimum)",
        "Email not confirmed": "Email not confirmed" };
      if (res.error === "Email not confirmed") { setError(t("Email pas encore confirmé : cliquez sur le lien reçu par email (regardez aussi dans les spams).", "Email not confirmed yet: click the link in the email we sent you (check spam too).")); return; }
      setError(traduits[res.error] ? t(res.error, traduits[res.error]) : res.error);
    }
  };

  const handleForgot = async () => {
    if (!email.trim()) { setError(t("Entrez votre email d'abord.", "Enter your email first.")); return; }
    setForgotLoading(true);
    setError("");
    try {
      const res = await fetch("https://vcnguzlwyacnlysnsogv.supabase.co/auth/v1/recover", {
        method: "POST",
        headers: {
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbmd1emx3eWFjbmx5c25zb2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDg0MTcsImV4cCI6MjA4ODIyNDQxN30.rI1WkGgUjFlw7dbl4wDtXcItDqsEc5PaqpPpF35cSuU",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, redirect_to: "https://callrdv.com" })
      });
      if (res.ok) { setForgotSent(true); }
      else { setError(t("Email introuvable. Vérifiez l'adresse.", "Email not found. Check the address.")); }
    } catch(e) { setError(t("Erreur réseau. Réessayez.", "Network error. Try again.")); }
    setForgotLoading(false);
  };
  return (
    <div style={{ minHeight:"100vh", background:"#F5F6F8", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif", padding:24, position:"relative" }}>
      <LangSwitch style={{ position:"absolute", top:16, right:16 }} />
      <div style={{ width:"100%", maxWidth:420 }} className="fade-up">
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:56, height:56, background:"#2450E6", borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}><Icon name="phone" size={26} color="#fff" /></div>
          <div style={{ fontWeight:800, fontSize:28, color:"#1e293b", letterSpacing:"-0.03em" }}>CallRDV</div>
          <div style={{ fontSize:12, color:"#64748B", fontFamily:"inherit", marginTop:4 }}>{t("Vos RDV par téléphone, simplement", "Phone bookings, made simple")}</div>
        </div>
        <div className="card" style={{ padding:32 }}>
          <div style={{ display:"flex", gap:8, marginBottom:24, background:"#F5F6F8", borderRadius:12, padding:4 }}>
            {["login","register"].map(m => (
              <button key={m} onClick={() => setMode(m)} className="btn" style={{ flex:1, padding:"10px", fontSize:13, borderRadius:10, background:mode===m?"#2450E6":"transparent", color:mode===m?"#f0f4f8":"#94a3b8" }}>
                {m==="login" ? t("Connexion","Log in") : t("Inscription","Sign up")}
              </button>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {mode === "register" && <input placeholder={t("Votre prénom","Your first name")} value={name} onChange={e=>setName(e.target.value)} />}
            <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
            <input type="password" placeholder={t("Mot de passe","Password")} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} />
          </div>
          {mode === "login" && !forgotMode && (
            <div style={{ textAlign:"right", marginTop:8 }}>
              <span onClick={()=>{ setForgotMode(true); setError(""); setForgotSent(false); }} style={{ fontSize:12, color:"#4a90d9", cursor:"pointer", fontFamily:"inherit" }}>
                {t("Mot de passe oublié ?","Forgot password?")}
              </span>
            </div>
          )}

          {/* Mode mot de passe oublié */}
          {forgotMode && (
            <div style={{ background:"#f0f4ff", border:"1px solid #2450E630", borderRadius:12, padding:20, marginTop:12 }}>
              {forgotSent ? (
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>📧</div>
                  <div style={{ fontWeight:700, fontSize:14, color:"#1e293b", marginBottom:6 }}>{t("Email envoyé !","Email sent!")}</div>
                  <div style={{ fontSize:12, color:"#64748b", marginBottom:12 }}>{t("Vérifiez votre boîte mail et cliquez sur le lien pour réinitialiser votre mot de passe.","Check your inbox and click the link to reset your password.")}</div>
                  <span onClick={()=>setForgotMode(false)} style={{ fontSize:12, color:"#4a90d9", cursor:"pointer" }}>{t("← Retour à la connexion","← Back to log in")}</span>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:13, color:"#1e293b", marginBottom:12, fontWeight:600 }}>{t("Réinitialiser le mot de passe","Reset your password")}</div>
                  <div style={{ fontSize:12, color:"#64748b", marginBottom:12 }}>{t("Entrez votre email et nous vous enverrons un lien de réinitialisation.","Enter your email and we will send you a reset link.")}</div>
                  <button onClick={handleForgot} disabled={forgotLoading} style={{ width:"100%", background:"#2450E6", color:"#fff", border:"none", borderRadius:8, padding:"11px", cursor:"pointer", fontWeight:700, fontSize:13, opacity:forgotLoading?0.7:1 }}>
                    {forgotLoading ? t("⏳ Envoi...","⏳ Sending...") : t("📧 Envoyer le lien","📧 Send the link")}
                  </button>
                  <div style={{ textAlign:"center", marginTop:10 }}>
                    <span onClick={()=>setForgotMode(false)} style={{ fontSize:12, color:"#4a90d9", cursor:"pointer" }}>{t("← Retour","← Back")}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {mode === "login" && !forgotMode && (
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:12 }}>
              <div
                onClick={()=>setRememberMe(r=>!r)}
                style={{ width:36, height:20, borderRadius:10, background:rememberMe?"#2450E6":"#e2e8f0", cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}>
                <div style={{ position:"absolute", top:2, left:rememberMe?16:2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s" }}></div>
              </div>
              <span style={{ fontSize:13, color:"#64748b", cursor:"pointer" }} onClick={()=>setRememberMe(r=>!r)}>{t("Se souvenir de moi","Remember me")}</span>
            </div>
          )}
          {info && <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", color:"#166534", borderRadius:10, padding:"12px 14px", fontSize:13, marginTop:12, lineHeight:1.5 }}>{info}</div>}
          {error && <div style={{ color:"#ff6b6b", fontSize:13, marginTop:10, fontFamily:"inherit" }}>⚠ {error}</div>}
          <button className="btn btn-primary" onClick={handle} disabled={loading} style={{ width:"100%", marginTop:18, display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            {loading ? <span className="spinner"></span> : (mode==="login" ? t("Se connecter","Log in") : t("Créer mon compte","Create my account"))}
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:10, margin:"16px 0" }}>
            <div style={{ flex:1, height:1, background:"#e2e8f0" }}></div>
            <span style={{ fontSize:11, color:"#64748B", fontFamily:"inherit" }}>{t("OU","OR")}</span>
            <div style={{ flex:1, height:1, background:"#e2e8f0" }}></div>
          </div>

          <button onClick={()=>sb.signInWithGoogle()} className="btn btn-outline" style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:12, padding:"14px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {t("Continuer avec Google","Continue with Google")}
          </button>

          <button onClick={()=>sb.signInWithLinkedIn()} className="btn btn-outline" style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:12, padding:"14px", marginTop:10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            {t("Continuer avec LinkedIn","Continue with LinkedIn")}
          </button>
          <div className="privacy-badge" style={{ marginTop:18 }}>
            <Icon name="check" size={16} color="#16A34A" stroke={2.6} />
            <div style={{ fontSize:11, color:"#0369a1", fontFamily:"inherit", lineHeight:1.6 }}>
              <span style={{ color:"#0284c7", fontWeight:700 }}>{t("Données protégées. ","Data protected. ")}</span>
              {t("Aucun enregistrement vocal. Données hébergées en Europe.","No voice recording. Data hosted in Europe.")}
            </div>
          </div>
        </div>
        <div style={{ marginTop:20, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {Object.entries(PLANS).filter(([k]) => k !== "business").map(([k,p]) => (
            <div key={k} style={{ background:"#fff", border:`1px solid ${p.color}30`, borderRadius:12, padding:12, textAlign:"center" }}>
              <div style={{ fontWeight:700, fontSize:14, color:p.color }}>{p.price===0?t("Gratuit","Free"):`${p.price}€${t("/mois","/mo")}`}</div>
              <div style={{ fontSize:11, color:"#64748B", fontFamily:"inherit", marginTop:2 }}>{k==="free"?t("10 RDV par mois","10 appointments/month"):t("RDV illimités","Unlimited")}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Pricing Modal ────────────────────────────────────────────
function PricingModal({ currentPlan, onUpgrade, onClose }) {
  // Touche Échap pour fermer
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label={tr("Abonnement","Plans")} style={{ position:"fixed", inset:0, background:"#f0f4f8ee", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px" }}>
      <button onClick={onClose} aria-label={tr("Fermer","Close")} title={tr("Fermer","Close")} style={{ position:"fixed", top:"calc(14px + env(safe-area-inset-top))", right:14, width:44, height:44, borderRadius:12, background:"#fff", border:"1px solid var(--border)", boxShadow:"0 2px 8px rgba(15,23,42,.08)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text)", zIndex:1 }}><Icon name="x" size={20} /></button>
      <div onClick={e=>e.stopPropagation()} style={{ width:"100%", maxWidth:560, maxHeight:"92vh", overflowY:"auto", paddingTop:40 }} className="fade-up">
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontWeight:800, fontSize:26, color:"#1e293b" }}>{tr("Un seul prix, tout inclus","One price, everything included")}</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:16 }}>
          {Object.entries(PLANS).filter(([key]) => key !== "business").map(([key, plan]) => (
            <div key={key} className="card" style={{ border:`1px solid ${plan.color}40`, position:"relative", transform:key==="pro"?"scale(1.04)":"none" }}>
              <div style={{ color:plan.color, fontWeight:800, fontSize:22, marginBottom:4 }}>
                {plan.price===0?tr("Gratuit","Free"):`${plan.price}€`}{plan.price>0&&<span style={{ fontSize:13, fontWeight:400, color:"#64748B" }}>{tr("/mois","/month")}</span>}
              </div>
              <div style={{ fontWeight:700, fontSize:16, marginBottom:14, color:"#1e293b" }}>{tr(plan.name, plan.nameEn)}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:18 }}>
                {tr(plan.features, plan.featuresEn).map(f => <div key={f} style={{ fontSize:13, color:"#64748b", display:"flex", gap:8 }}><span style={{ color:plan.color }}>✓</span>{f}</div>)}
              </div>
              {(currentPlan===key || (key==="pro" && currentPlan==="business"))
                ? <div style={{ textAlign:"center", padding:"12px", background:`${plan.color}15`, borderRadius:10, fontSize:13, color:plan.color, fontFamily:"inherit" }}>{tr("Plan actuel","Current plan")}</div>
                : <button onClick={()=>onUpgrade(key)} style={{ width:"100%", background:plan.color, color:"#f0f4f8", padding:"12px", fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif", fontWeight:700, border:"none", cursor:"pointer", borderRadius:10, fontSize:14 }}>{key==="free"?tr("Rester gratuit","Stay on Free"):tr(`Passer au ${plan.name} — ${plan.price}€/mois`, `Go ${plan.nameEn} — €${plan.price}/month`)}</button>
              }
            </div>
          ))}
        </div>
        <div style={{ textAlign:"center", marginTop:20 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>{tr("Retour","Back")}</button>
        </div>
      </div>
    </div>
  );
}

// ── Calendar Modal ───────────────────────────────────────────
function CalendarModal({ rdv, onClose, onEdit, onDelete, onUpdateStatut, onAccepter, onRefuser }) {

  // Ajout au calendrier Google / Outlook, à la date et l'heure du RDV (1 h par défaut)
  const exportTo = (type) => {
    const title = encodeURIComponent(rdv.titre || tr("Rendez-vous","Appointment"));
    const details = encodeURIComponent(`${tr("Avec","With")}: ${rdv.personne}\n${tr("Lieu","Place")}: ${rdv.lieu||""}\n${rdv.notes||""}`);
    const loc = encodeURIComponent(rdv.adresse||rdv.lieu||"");
    const debut = new Date(`${rdv.date || isoLocal(new Date())}T${rdv.heure || "09:00"}:00`);
    const fin = new Date(debut.getTime() + (Number(rdv.duree_min) > 0 ? Number(rdv.duree_min) : 60) * 60000);
    const z = (d) => d.toISOString().replace(/[-:]|\.\d+/g,"").slice(0,15)+"Z";
    if (type==="apple") {
      // Fichier .ics d'un seul RDV : l'iPhone et le Mac proposent de l'ajouter au calendrier
      const e = (v) => String(v||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n");
      const local = (d) => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}00`;
      const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//CallRDV//callrdv.com//FR","BEGIN:VEVENT",
        `UID:${rdv.id}@callrdv.com`, `DTSTAMP:${z(new Date())}`, `DTSTART:${local(debut)}`, `DTEND:${local(fin)}`,
        `SUMMARY:${e(`${rdv.personne||""} · ${rdv.titre||tr("Rendez-vous","Appointment")}`)}`,
        ...(rdv.lieu||rdv.adresse ? [`LOCATION:${e([rdv.lieu, rdv.adresse].filter(Boolean).join(" — "))}`] : []),
        `DESCRIPTION:${e(rdv.notes||"")}`, "END:VEVENT","END:VCALENDAR"].join("\r\n");
      const url = URL.createObjectURL(new Blob([ics], { type:"text/calendar;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `rdv-${(rdv.personne||"callrdv").replace(/[^\w-]+/g,"-")}.ics`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 2000);
      return;
    }
    if (type==="google") window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${loc}&dates=${z(debut)}/${z(fin)}`,"_blank");
    else window.open(`https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&body=${details}&location=${loc}&startdt=${debut.toISOString()}&enddt=${fin.toISOString()}`,"_blank");
  };
  const tel = telClient(rdv);
  const wa = telInternational(tel);
  const txt = encodeURIComponent(texteRdv(rdv));
  const dateLongue = rdv.date ? (s => s.charAt(0).toUpperCase()+s.slice(1))(new Date(rdv.date+"T12:00:00").toLocaleDateString(locale(), { weekday:"long", day:"numeric", month:"long" })) : tr("Sans date","No date");
  const ligne = (icone, contenu) => (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 0", borderBottom:"1px solid #F1F5F9", fontSize:15 }}>
      <Icon name={icone} size={18} color="var(--text2)" />{contenu}
    </div>
  );
  const btnAction = { flex:1, minHeight:48, borderRadius:12, border:"1px solid var(--border)", background:"#fff", cursor:"pointer", fontSize:14, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:8, textDecoration:"none", color:"var(--text)" };

  return (
    <div className="sheet-fond" onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.5)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div className="card fade-up sheet" role="dialog" aria-label={rdv.titre||tr("Rendez-vous","Appointment")} onClick={e=>e.stopPropagation()} style={{ width:"100%", maxWidth:460, padding:24, maxHeight:"90vh", overflowY:"auto" }}>

        <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:8 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:800, fontSize:20, letterSpacing:"-0.01em", marginBottom:6 }}>{rdv.personne}</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
              <StatutPill statut={rdv.statut} />
              {rdv.source === "en_ligne" && <span className="pill pill-online">{tr("Réservé en ligne","Booked online")}</span>}
              <span style={{ fontSize:13, color:"var(--text2)" }}>{catLabel(rdv.categorie||"autre")}</span>
            </div>
          </div>
          <button onClick={onClose} aria-label={tr("Fermer","Close")} style={{ width:40, height:40, borderRadius:12, background:"#F1F5F9", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text)", flexShrink:0 }}><Icon name="x" size={18} /></button>
        </div>

        <div style={{ marginBottom:16 }}>
          {ligne("file", <span style={{ fontWeight:700 }}>{rdv.titre||tr("Rendez-vous","Appointment")}</span>)}
          {ligne("calendar", <span>{dateLongue}{rdv.heure ? ` ${tr("à","at")} ${rdv.heure}` : ""}</span>)}
          {(rdv.lieu || rdv.adresse) && ligne("pin", <span>{[rdv.lieu, rdv.adresse].filter(Boolean).join(" — ")}</span>)}
          {tel && ligne("phone", <a href={`tel:${tel.replace(/[^\d+]/g,"")}`} style={{ color:"var(--accent)", fontWeight:700, textDecoration:"none" }}>{tel}</a>)}
          {rdv.client_email && ligne("mail", <a href={`mailto:${rdv.client_email}`} style={{ color:"var(--accent)", fontWeight:700, textDecoration:"none", overflow:"hidden", textOverflow:"ellipsis" }}>{rdv.client_email}</a>)}
          {rdv.notes && <div style={{ background:"#F8FAFC", borderRadius:12, padding:"12px 14px", marginTop:12, fontSize:14, color:"var(--text2)", lineHeight:1.6 }}>{rdv.notes}</div>}
        </div>

        {rdv.statut === "a_valider" && onAccepter && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0,1fr))", gap:8, marginBottom:16 }}>
            <button onClick={()=>onAccepter(rdv)} style={{ height:48, borderRadius:12, border:"none", background:"#16A34A", color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer" }}>{tr("Accepter","Accept")}</button>
            <button onClick={()=>onRefuser(rdv)} style={{ height:48, borderRadius:12, border:"1px solid #FECACA", background:"#FEF2F2", color:"#B91C1C", fontWeight:800, fontSize:15, cursor:"pointer" }}>{tr("Refuser","Decline")}</button>
          </div>
        )}

        {/* Statut */}
        <label htmlFor="detail-statut" className="field-label" style={{ display:"block" }}>{tr("Statut","Status")}</label>
        <select id="detail-statut" value={rdv.statut||"en_attente"} onChange={e => onUpdateStatut && onUpdateStatut(rdv.id, e.target.value)} style={{ marginBottom:16 }}>
          <option value="en_attente">{tr("En attente","Pending")}</option>
          <option value="confirme">{tr("Confirmé","Confirmed")}</option>
          <option value="reporte">{tr("Reporté","Postponed")}</option>
          <option value="annule">{tr("Annulé","Cancelled")}</option>
          {rdv.statut === "a_valider" && <option value="a_valider">{tr("À valider","To approve")}</option>}
        </select>

        {/* Envoyer au client */}
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          {wa && <a href={`https://wa.me/${wa}?text=${txt}`} target="_blank" rel="noopener noreferrer" style={{ ...btnAction, background:"#F0FDF4", borderColor:"#BBF7D0", color:"#14532D" }}><Icon name="whatsapp" size={18} color="#15803D" /> WhatsApp</a>}
          {tel && <a href={`sms:${tel.replace(/[^\d+]/g,"")}?&body=${txt}`} style={btnAction}><Icon name="sms" size={18} color="var(--accent)" /> SMS</a>}
          <button onClick={()=>partagerRdv(rdv)} style={btnAction}><Icon name="share" size={18} color="var(--accent)" /> {tr("Partager","Share")}</button>
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          <button onClick={()=>{ onEdit && onEdit(rdv); onClose(); }} style={btnAction}><Icon name="edit" size={18} color="var(--accent)" /> {tr("Modifier","Edit")}</button>
          <button onClick={()=>{ onDelete && onDelete(rdv.id); onClose(); }} style={{ ...btnAction, color:"#B91C1C", borderColor:"#FECACA", background:"#FEF2F2" }}><Icon name="trash" size={18} /> {tr("Supprimer","Delete")}</button>
        </div>

        <details style={{ marginTop:6 }}>
          <summary style={{ cursor:"pointer", fontSize:13, fontWeight:700, color:"var(--text2)", padding:"10px 0", textAlign:"center", listStyle:"none" }}>
            {tr("Ajouter à mon calendrier","Add to my calendar")}
          </summary>
          <div style={{ display:"flex", gap:8, marginTop:4 }}>
            <button onClick={()=>exportTo("apple")} style={btnAction}>Apple</button>
            <button onClick={()=>exportTo("google")} style={btnAction}>Google</button>
            <button onClick={()=>exportTo("outlook")} style={btnAction}>Outlook</button>
          </div>
        </details>
      </div>
    </div>
  );
}

// ── RDV Form (opens right after hanging up) ──────────────────
// ── Stats View ───────────────────────────────────────────────
function StatsView({ appointments, patients, user }) {
  const today = new Date();
  const thisMonth = String(today.getMonth()+1).padStart(2,"0");
  const thisYear = today.getFullYear();

  const rdvCeMois = appointments.filter(r => r.date?.startsWith(`${thisYear}-${thisMonth}`));
  const rdvSemaine = appointments.filter(r => {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + 1);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return r.date >= start.toISOString().split("T")[0] && r.date <= end.toISOString().split("T")[0];
  });

  const catCount = appointments.reduce((acc, r) => {
    const cat = r.categorie || "autre";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const topCats = Object.entries(catCount).sort((a,b) => b[1]-a[1]).slice(0,5);


  const statutColors = {
    confirme: "#22c55e",
    annule: "#ef4444",
    reporte: "#f59e0b",
    en_attente: "#94a3b8"
  };

  const catColors = {
    medical:"#3b82f6", dentiste:"#06b6d4", kine:"#8b5cf6", veterinaire:"#f59e0b",
    garage:"#6b7280", travaux:"#f97316", juridique:"#7c3aed", banque:"#0891b2",
    beaute:"#ec4899", formation:"#10b981", pro:"#2450E6", perso:"#64748b", autre:"#94a3b8"
  };

  // Last 6 months RDV count
  const last6 = Array.from({length:6}, (_,i) => {
    const d = new Date(today);
    d.setMonth(today.getMonth() - (5-i));
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const mois = tr(["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"], ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]);
    return { label: mois[d.getMonth()], count: appointments.filter(r => r.date?.startsWith(key)).length };
  });

  const maxCount = Math.max(...last6.map(m => m.count), 1);

  const planInfo = { free:{name:tr("Gratuit","Free"),color:"#64748b"}, pro:{name:"Pro",color:"#3b82f6"}, business:{name:"Pro",color:"#3b82f6"} };
  const plan = planInfo[user.plan] || planInfo.free;

  return (
    <div style={{ flex:1, overflowY:"auto", padding:28, background:"#F5F6F8" }}>
      <div style={{ maxWidth:900, margin:"0 auto" }}>
        <div style={{ fontWeight:800, fontSize:22, color:"#1e293b", marginBottom:4 }}>{tr("📊 Tableau de bord","📊 Dashboard")}</div>
        <div style={{ fontSize:13, color:"#64748B", marginBottom:24 }}>{tr("Vue d'ensemble de votre activité","An overview of your activity")}</div>

        {/* KPI Cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
          {[
            { label:tr("RDV ce mois","This month"), value:rdvCeMois.length, icon:"📅", color:"#3b82f6" },
            { label:tr("RDV cette semaine","This week"), value:rdvSemaine.length, icon:"📆", color:"#8b5cf6" },
            { label:tr("Total clients","Total clients"), value:patients.length, icon:"👥", color:"#10b981" },
            { label:tr("Total RDV","Total appointments"), value:appointments.length, icon:"📋", color:"#f59e0b" },
          ].map(({label,value,icon,color}) => (
            <div key={label} className="card" style={{ padding:20 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>{icon}</div>
              <div style={{ fontSize:32, fontWeight:800, color, marginBottom:4 }}>{value}</div>
              <div style={{ fontSize:12, color:"#64748B", fontFamily:"inherit" }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:24 }}>
          {/* Bar chart */}
          <div className="card" style={{ padding:24 }}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:20 }}>{tr("📈 RDV sur 6 mois","📈 Appointments over 6 months")}</div>
            <div style={{ display:"flex", alignItems:"flex-end", gap:10, height:120 }}>
              {last6.map(({label,count}) => (
                <div key={label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                  <div style={{ fontSize:11, color:"#2450E6", fontWeight:700 }}>{count||""}</div>
                  <div style={{ width:"100%", background:"#2450E6", borderRadius:"4px 4px 0 0", height: count === 0 ? 4 : `${Math.round((count/maxCount)*100)}px`, transition:"height .3s", opacity: count===0?0.2:1 }}></div>
                  <div style={{ fontSize:10, color:"#64748B", fontFamily:"inherit" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Top categories */}
          <div className="card" style={{ padding:24 }}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:20 }}>{tr("🏆 Top catégories","🏆 Top categories")}</div>
            {topCats.length === 0 ? (
              <div style={{ color:"#64748B", fontSize:13 }}>{tr("Aucun RDV encore","No appointments yet")}</div>
            ) : topCats.map(([cat, count]) => (
              <div key={cat} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{catLabel(cat)}</span>
                  <span style={{ fontSize:13, color:"#64748B" }}>{count} {tr("RDV","appt.")}</span>
                </div>
                <div style={{ height:6, background:"#f1f5f9", borderRadius:3 }}>
                  <div style={{ height:6, background:catColors[cat]||"#94a3b8", borderRadius:3, width:`${Math.round((count/appointments.length)*100)}%`, transition:"width .3s" }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Plan + Recent */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:16 }}>
          <div className="card" style={{ padding:24 }}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:16 }}>{tr("💳 Mon plan","💳 My plan")}</div>
            <div style={{ background:`${plan.color}15`, border:`1px solid ${plan.color}30`, borderRadius:12, padding:16, textAlign:"center", marginBottom:16 }}>
              <div style={{ fontSize:24, fontWeight:800, color:plan.color }}>{plan.name}</div>
              <div style={{ fontSize:12, color:"#64748B", marginTop:4 }}>{user.plan==="free"?tr(`${user.usage||0}/10 RDV utilisés ce mois`,`${user.usage||0}/10 appointments used this month`):tr("RDV illimités","Unlimited appointments")}</div>
            </div>
            {user.plan==="free" && (
              <div style={{ background:"#f0f4ff", borderRadius:10, padding:14, fontSize:12, color:"#2450E6", lineHeight:1.6 }}>
                {tr(<>💡 Passez en <b>Pro à 20€/mois</b> pour des RDV illimités !</>, <>💡 Go <b>Pro for €20/month</b> for unlimited appointments!</>)}
              </div>
            )}
          </div>

          <div className="card" style={{ padding:24 }}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:16 }}>{tr("🕐 Derniers RDV","🕐 Latest appointments")}</div>
            {appointments.slice(0,5).map((rdv,i) => (
              <div key={i} style={{ display:"flex", gap:12, alignItems:"center", padding:"8px 0", borderBottom:i<4?"1px solid #f1f5f9":"none" }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:catColors[rdv.categorie]||"#94a3b8", flexShrink:0 }}></div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{rdv.titre||tr("RDV","Appointment")}</div>
                  <div style={{ fontSize:11, color:"#64748B" }}>{rdv.personne} · {fmtRdv(rdv.date, rdv.heure)}</div>
                </div>
              </div>
            ))}
            {appointments.length === 0 && <div style={{ color:"#64748B", fontSize:13 }}>{tr("Aucun RDV encore","No appointments yet")}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Export PDF ───────────────────────────────────────────────
function exportPDF(appointments, viewMode) {
  const today = new Date();
  const moisNoms = tr(["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"], ["January","February","March","April","May","June","July","August","September","October","November","December"]);

  // Filter by current month for month view, all for list
  let rdvs = [...appointments].sort((a,b) => a.date > b.date ? 1 : -1);
  if (viewMode === "semaine") {
    const start = new Date(today);
    const day = start.getDay();
    start.setDate(start.getDate() - day + (day===0?-6:1));
    const end = new Date(start); end.setDate(start.getDate() + 6);
    rdvs = rdvs.filter(r => r.date >= start.toISOString().split("T")[0] && r.date <= end.toISOString().split("T")[0]);
  } else if (viewMode === "mois") {
    const month = String(today.getMonth()+1).padStart(2,"0");
    rdvs = rdvs.filter(r => r.date?.startsWith(`${today.getFullYear()}-${month}`));
  }

  const catColors = {
    medical:"#3b82f6", dentiste:"#06b6d4", kine:"#8b5cf6", veterinaire:"#f59e0b",
    garage:"#6b7280", travaux:"#f97316", juridique:"#7c3aed", banque:"#0891b2",
    beaute:"#ec4899", formation:"#10b981", pro:"#2450E6", perso:"#64748b", autre:"#94a3b8"
  };

  const title = viewMode === "semaine" ? tr("Planning de la semaine","This week's schedule") : viewMode === "mois" ? tr(`Planning de ${moisNoms[today.getMonth()]} ${today.getFullYear()}`, `${moisNoms[today.getMonth()]} ${today.getFullYear()} schedule`) : tr("Tous les rendez-vous","All appointments");

  const rows = rdvs.map(r => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;">
        <span style="background:${catColors[r.categorie]||"#94a3b8"};color:#fff;padding:2px 8px;border-radius:20px;font-size:11px;">${catLabel(r.categorie||"autre")}</span>
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#1e293b;">${r.titre||tr("Rendez-vous","Appointment")}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">${r.personne||"—"}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">${r.date||"—"}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">${r.heure||"—"}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;">${r.lieu||"—"}</td>
    </tr>
  `).join("");

  const html = `
    <!DOCTYPE html>
    <html lang="${CURRENT_LANG}">
    <head>
      <meta charset="utf-8"/>
      <title>CallRDV — ${title}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #1e293b; margin: 0; padding: 32px; }
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #2450E6; }
        .logo { font-size: 22px; font-weight: 800; color: #2450E6; }
        .subtitle { font-size: 13px; color: #94a3b8; margin-top: 4px; }
        .title { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 20px; }
        .date { font-size: 12px; color: #94a3b8; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #2450E6; color: #fff; padding: 12px 14px; text-align: left; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; }
        tr:hover td { background: #f8faff; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
        .badge { display: inline-block; background: #f0f4ff; color: #2450E6; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">📞 CallRDV</div>
          <div class="subtitle">${tr("Prise de rendez-vous automatique","Appointment booking made easy")}</div>
        </div>
        <div style="text-align:right">
          <div class="badge">${rdvs.length} ${tr("RDV","appt.")}</div>
          <div class="date" style="margin-top:6px">${tr("Généré le","Generated on")} ${today.toLocaleDateString(locale())} ${tr("à","at")} ${today.toLocaleTimeString(locale(),{hour:"2-digit",minute:"2-digit"})}</div>
        </div>
      </div>
      <div class="title">${title}</div>
      ${rdvs.length === 0 ? `<p style="color:#94a3b8;text-align:center;padding:40px">${tr("Aucun rendez-vous pour cette période","No appointments for this period")}</p>` : `
      <table>
        <thead>
          <tr>
            <th>${tr("Catégorie","Category")}</th>
            <th>${tr("Titre","Title")}</th>
            <th>${tr("Contact","Contact")}</th>
            <th>${tr("Date","Date")}</th>
            <th>${tr("Heure","Time")}</th>
            <th>${tr("Lieu","Place")}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`}
      <div class="footer">CallRDV · callrdv.com</div>
    </body>
    </html>
  `;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

// ── Vue Agenda Calendrier ────────────────────────────────────
function CalendarView({ appointments, onNewCall, onCalRdv, onEditRdv, onDeleteRdv, onUpdateStatut, onAccepter, onRefuser, afficherSource }) {
  // semaine | mois | liste — sur téléphone, la liste est la seule vue lisible
  const [voirRecherche, setVoirRecherche] = React.useState(false);
  const [viewMode, setViewMode] = React.useState(() => (typeof window !== "undefined" && window.innerWidth < 700) ? "liste" : "semaine");
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [agendaSearch, setAgendaSearch] = React.useState("");

  const today = new Date();

  const getWeekDays = (date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const getMonthDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = 0; i < startPad; i++) {
      const d = new Date(firstDay);
      d.setDate(d.getDate() - (startPad - i));
      days.push({ date: d, currentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), currentMonth: true });
    }
    while (days.length % 7 !== 0) {
      const d = new Date(lastDay);
      d.setDate(lastDay.getDate() + (days.length - lastDay.getDate() - startPad + 1));
      days.push({ date: d, currentMonth: false });
    }
    return days;
  };

  const getRdvsForDate = (date) => {
    const dateStr = isoLocal(date);
    return appointments.filter(r => r.date === dateStr);
  };

  const isToday = (date) => date.toDateString() === today.toDateString();

  const navigate = (dir) => {
    const d = new Date(currentDate);
    if (viewMode === "semaine") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const weekDays = getWeekDays(currentDate);
  const monthDays = getMonthDays(currentDate);
  const jours = tr(["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"], ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  const moisNoms = tr(["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"], ["January","February","March","April","May","June","July","August","September","October","November","December"]);

  const catColors = {
    medical:"#3b82f6", dentiste:"#06b6d4", kine:"#8b5cf6", veterinaire:"#f59e0b",
    garage:"#6b7280", travaux:"#f97316", juridique:"#7c3aed", banque:"#0891b2",
    beaute:"#ec4899", formation:"#10b981", pro:"#2450E6", perso:"#64748b", autre:"#94a3b8"
  };

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"#F5F6F8" }}>
      {/* En-tête */}
      <div className="cal-head" style={{ background:"#F5F6F8", padding:"20px 24px 12px", display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
          <h1 style={{ fontWeight:800, fontSize:24, letterSpacing:"-0.02em" }}>{tr("Mes rendez-vous","My appointments")}</h1>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setVoirRecherche(v=>!v)} aria-label={tr("Rechercher","Search")} title={tr("Rechercher","Search")} style={{ width:42, height:42, borderRadius:12, background:"#fff", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"var(--text)" }}><Icon name="search" size={18} /></button>
            <button onClick={()=>exportPDF(appointments, viewMode === "passes" ? "liste" : viewMode)} aria-label={tr("Exporter en PDF","Export to PDF")} title={tr("Exporter en PDF","Export to PDF")} style={{ width:42, height:42, borderRadius:12, background:"#fff", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"var(--text)" }}><Icon name="download" size={18} /></button>
          </div>
        </div>
        {(() => {
          const todayIso = isoLocal(new Date());
          const aValider = appointments.filter(r => r.statut === "a_valider" && (r.date || "") >= todayIso).length;
          const hier = Date.now() - 86400000;
          const nouvelles = appointments.filter(r => r.source === "en_ligne" && r.statut !== "a_valider" && r.confirmed_at && new Date(r.confirmed_at + (/[zZ+]/.test(String(r.confirmed_at).slice(10)) ? "" : "Z")).getTime() > hier).length;
          if (!aValider && !nouvelles) return null;
          return (
            <button onClick={()=>setViewMode("liste")} style={{ background: aValider ? "#FFF7ED" : "var(--accent-soft)", border: aValider ? "1px solid #FED7AA" : "none", borderRadius:14, padding:"12px 14px", display:"flex", alignItems:"center", gap:10, fontSize:13, textAlign:"left", cursor:"pointer", font:"inherit", color:"var(--text)", maxWidth:720 }}>
              <span style={{ width:10, height:10, borderRadius:"50%", background: aValider ? "#EA580C" : "var(--accent)", flexShrink:0 }}></span>
              <span style={{ flex:1 }}>{aValider
                ? <><b>{tr(`${aValider} demande${aValider>1?"s":""} à valider`,`${aValider} request${aValider>1?"s":""} to approve`)}</b> · {tr("acceptez ou refusez ci-dessous","accept or decline below")}</>
                : <><b>{tr(`${nouvelles} nouvelle${nouvelles>1?"s":""} réservation${nouvelles>1?"s":""} en ligne`,`${nouvelles} new online booking${nouvelles>1?"s":""}`)}</b> {tr("depuis hier","since yesterday")}</>}</span>
            </button>
          );
        })()}
        {(voirRecherche || agendaSearch) && (
          <div style={{ position:"relative" }}>
            <Icon name="search" size={18} color="#64748B" style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
            <input autoFocus placeholder={tr("Client, titre, lieu…","Client, title, place…")} value={agendaSearch}
              onChange={e => { setAgendaSearch(e.target.value); if (e.target.value && (viewMode==="semaine"||viewMode==="mois")) setViewMode("liste"); }}
              style={{ paddingLeft:42 }} />
          </div>
        )}
        <div role="tablist" style={{ display:"grid", gridTemplateColumns:"repeat(4, minmax(0,1fr))", background:"#E9ECF1", borderRadius:12, padding:4, gap:4, maxWidth:520 }}>
          {[["liste",tr("À venir","Upcoming")],["passes",tr("Passés","Past")],["semaine",tr("Semaine","Week")],["mois",tr("Mois","Month")]].map(([m,label]) => (
            <button key={m} role="tab" aria-selected={viewMode===m} onClick={()=>setViewMode(m)}
              style={{ height:38, borderRadius:9, border:"none", cursor:"pointer", background:viewMode===m?"#fff":"transparent", color:viewMode===m?"var(--text)":"var(--text2)", fontWeight:viewMode===m?800:600, fontSize:13, boxShadow:viewMode===m?"0 1px 2px rgba(15,23,42,.08)":"none" }}>
              {label}
            </button>
          ))}
        </div>
        {(viewMode === "semaine" || viewMode === "mois") && (
        <div className="cal-nav" style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={()=>navigate(-1)} aria-label={tr("Précédent","Previous")} style={{ width:40, height:40, background:"#fff", border:"1px solid var(--border)", borderRadius:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="back" size={18} /></button>
          <div className="cal-title" style={{ fontWeight:800, fontSize:16, minWidth:200, textAlign:"center", flex:1 }}>
            {viewMode==="semaine"
              ? `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${moisNoms[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`
              : `${moisNoms[currentDate.getMonth()]} ${currentDate.getFullYear()}`
            }
          </div>
          <button onClick={()=>navigate(1)} aria-label={tr("Suivant","Next")} style={{ width:40, height:40, background:"#fff", border:"1px solid var(--border)", borderRadius:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transform:"scaleX(-1)" }}><Icon name="back" size={18} /></button>
          <button onClick={()=>setCurrentDate(new Date())} className="btn btn-outline btn-sm">{tr("Aujourd'hui","Today")}</button>
        </div>
        )}
      </div>

      {/* Week View */}
      {viewMode==="semaine" && (
        <div style={{ flex:1, overflowY:"auto", padding:"0" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", borderBottom:"1px solid #e2e8f0", background:"#fff" }}>
            {weekDays.map((day, i) => (
              <div key={i} style={{ padding:"12px 8px", textAlign:"center", borderRight:i<6?"1px solid #e2e8f0":"none" }}>
                <div style={{ fontSize:11, color:"#64748B", fontWeight:600, marginBottom:4 }}>{jours[i]}</div>
                <div style={{ width:32, height:32, borderRadius:"50%", background:isToday(day)?"#2450E6":"transparent", color:isToday(day)?"#fff":"#1e293b", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto", fontWeight:700, fontSize:15 }}>
                  {day.getDate()}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", flex:1, minHeight:500 }}>
            {weekDays.map((day, i) => {
              const rdvs = getRdvsForDate(day);
              return (
                <div key={i} style={{ borderRight:i<6?"1px solid #e2e8f0":"none", borderBottom:"1px solid #e2e8f0", padding:8, background:isToday(day)?"#f8faff":"#fff", minHeight:120 }}>
                  {rdvs.map((rdv, j) => (
                    <div key={j} onClick={()=>onCalRdv(rdv)}
                      style={{ background:catColors[rdv.categorie]||"#2450E6", color:"#fff", borderRadius:6, padding:"4px 8px", marginBottom:4, cursor:"pointer", fontSize:11, fontWeight:600, lineHeight:1.4 }}>
                      {rdv.heure && <span style={{ opacity:.8 }}>{rdv.heure} </span>}
                      {rdv.titre||rdv.personne}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Month View */}
      {viewMode==="mois" && (
        <div style={{ flex:1, overflowY:"auto", background:"#fff" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", borderBottom:"1px solid #e2e8f0" }}>
            {jours.map(j => (
              <div key={j} style={{ padding:"10px 8px", textAlign:"center", fontSize:11, fontWeight:600, color:"#64748B" }}>{j}</div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)" }}>
            {monthDays.map(({ date, currentMonth }, i) => {
              const rdvs = getRdvsForDate(date);
              return (
                <div key={i} style={{ minHeight:90, borderRight:(i+1)%7!==0?"1px solid #e2e8f0":"none", borderBottom:"1px solid #e2e8f0", padding:6, background:isToday(date)?"#f8faff":currentMonth?"#fff":"#f8f9fa" }}>
                  <div style={{ width:24, height:24, borderRadius:"50%", background:isToday(date)?"#2450E6":"transparent", color:isToday(date)?"#fff":currentMonth?"#1e293b":"#cbd5e1", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:isToday(date)?700:400, marginBottom:4 }}>
                    {date.getDate()}
                  </div>
                  {rdvs.slice(0,2).map((rdv, j) => (
                    <div key={j} onClick={()=>onCalRdv(rdv)}
                      style={{ background:catColors[rdv.categorie]||"#2450E6", color:"#fff", borderRadius:4, padding:"2px 6px", marginBottom:2, cursor:"pointer", fontSize:10, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {rdv.titre||rdv.personne}
                    </div>
                  ))}
                  {rdvs.length > 2 && <div style={{ fontSize:10, color:"#64748B", paddingLeft:4 }}>+{rdvs.length-2}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Liste : à venir ou passés, regroupés par jour */}
      {(viewMode==="liste" || viewMode==="passes") && (
        <div className="cal-list" style={{ flex:1, overflowY:"auto", padding:"8px 24px 24px" }}>
          {(() => {
            const q = agendaSearch.toLowerCase();
            const list = appointments.filter(r => !q || (r.titre||"").toLowerCase().includes(q) || (r.personne||"").toLowerCase().includes(q) || (r.lieu||"").toLowerCase().includes(q));
            const todayIso = isoLocal(new Date());
            const key = r => `${r.date||""} ${r.heure||""}`;
            const passes = viewMode === "passes";
            const choisis = passes
              ? list.filter(r => (r.date||"") < todayIso).sort((a,b) => key(a) < key(b) ? 1 : -1)
              : list.filter(r => (r.date||"") >= todayIso).sort((a,b) => key(a) > key(b) ? 1 : -1);
            if (choisis.length === 0) return (
              <div className="card" style={{ textAlign:"center", padding:"36px 20px", maxWidth:720 }}>
                <span style={{ width:52, height:52, borderRadius:14, background:"var(--accent-soft)", display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:10 }}><Icon name="calendar" size={24} color="var(--accent)" /></span>
                <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>{q ? tr("Aucun RDV trouvé","No appointments found") : passes ? tr("Aucun RDV passé","No past appointments") : tr("Aucun RDV à venir","No upcoming appointments")}</div>
                {!passes && !q && <button className="btn btn-primary btn-sm" onClick={onNewCall} style={{ marginTop:10 }}><Icon name="plus" size={16} stroke={2.6} /> {tr("Nouveau RDV","New appointment")}</button>}
              </div>
            );
            const libelleJour = (iso) => {
              const d = new Date((iso||"") + "T12:00:00");
              if (isNaN(d.getTime())) return iso || tr("Sans date","No date");
              const txt = d.toLocaleDateString(locale(), { weekday:"long", day:"numeric", month:"short" });
              const dem = new Date(); dem.setDate(dem.getDate()+1);
              if (iso === todayIso) return `${tr("Aujourd'hui","Today")} · ${txt}`;
              if (iso === isoLocal(dem)) return `${tr("Demain","Tomorrow")} · ${txt}`;
              return txt.charAt(0).toUpperCase() + txt.slice(1);
            };
            const groupes = [];
            choisis.forEach(r => { const g = groupes[groupes.length-1]; if (g && g.date === r.date) g.rdvs.push(r); else groupes.push({ date: r.date, rdvs: [r] }); });
            return (
              <div style={{ maxWidth:720 }}>
                {groupes.map(g => (
                  <section key={g.date || "x"} style={{ marginBottom:6 }}>
                    <h2 style={{ fontSize:12, fontWeight:800, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.06em", margin:"14px 0 8px" }}>{libelleJour(g.date)}</h2>
                    {g.rdvs.map(rdv => {
                      const tel = telClient(rdv); const wa = telInternational(tel);
                      return (
                        <div key={rdv.id} className="card" style={{ marginBottom:10, padding:14, opacity: passes ? .8 : 1, boxShadow: rdv.statut === "a_valider" && !passes ? "inset 0 0 0 2px #FDBA74" : undefined }}>
                        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                          <button onClick={()=>onCalRdv(rdv)} style={{ flex:1, minWidth:0, display:"flex", gap:12, alignItems:"flex-start", background:"none", border:"none", padding:0, cursor:"pointer", textAlign:"left", font:"inherit", color:"inherit" }}>
                            <span style={{ width:54, flexShrink:0, fontSize:15, fontWeight:800, paddingTop:1 }}>{rdv.heure || "—"}</span>
                            <span style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:5 }}>
                              <span style={{ fontSize:15, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{rdv.personne}</span>
                              <span style={{ fontSize:13, color:"var(--text2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{rdv.titre||tr("Rendez-vous","Appointment")}{rdv.lieu ? ` · ${rdv.lieu}` : ""}</span>
                              <span style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                                {afficherSource && (rdv.source === "en_ligne" ? <span className="pill pill-online">{tr("En ligne","Online")}</span> : <span className="pill pill-past">{tr("Téléphone","Phone")}</span>)}
                                <StatutPill statut={rdv.statut} />
                              </span>
                            </span>
                          </button>
                          {wa ? (
                            <a href={`https://wa.me/${wa}?text=${encodeURIComponent(texteRdv(rdv))}`} target="_blank" rel="noopener noreferrer" aria-label={tr("Envoyer sur WhatsApp","Send on WhatsApp")} title="WhatsApp" style={{ width:44, height:44, borderRadius:12, border:"1px solid #BBF7D0", background:"#F0FDF4", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, color:"#15803D" }}><Icon name="whatsapp" size={20} /></a>
                          ) : (
                            <button onClick={()=>partagerRdv(rdv)} aria-label={tr("Partager","Share")} title={tr("Partager (WhatsApp, SMS…)","Share (WhatsApp, SMS…)")} style={{ width:44, height:44, borderRadius:12, border:"1px solid var(--border)", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer", color:"var(--text)" }}><Icon name="share" size={19} /></button>
                          )}
                        </div>
                        {rdv.statut === "a_valider" && !passes && onAccepter && (
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0,1fr))", gap:8, marginTop:12 }}>
                            <button onClick={()=>onAccepter(rdv)} style={{ height:44, borderRadius:12, border:"none", background:"#16A34A", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>{tr("Accepter","Accept")}</button>
                            <button onClick={()=>onRefuser(rdv)} style={{ height:44, borderRadius:12, border:"1px solid #FECACA", background:"#FEF2F2", color:"#B91C1C", fontWeight:800, fontSize:14, cursor:"pointer" }}>{tr("Refuser","Decline")}</button>
                          </div>
                        )}
                        </div>
                      );
                    })}
                  </section>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── Patients View ────────────────────────────────────────────
function PatientsView({ patients, setPatients, user, token, sb, appointments, onNewRdv }) {
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const [form, setForm] = React.useState({ nom:"", email:"", telephone:"", notes:"", categorie:"autre" });
  const [importing, setImporting] = React.useState(false);
  const [editingPatient, setEditingPatient] = React.useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = React.useState(false);
  const [sortBy, setSortBy] = React.useState("nom"); // nom | date | rdv
  const [confirmClean, setConfirmClean] = React.useState(false);
  const [nettoyage, setNettoyage] = React.useState(false);

  const isDirtyContact = (p) => {
    const nom = p.nom || "";
    // Ligne brute d'un fichier de contacts vCard (.vcf) : "VERSION:2.1", "TEL;CELL:+33…", "FN:…"
    if (/^(begin|end|version|fn|n|tel|email|adr|org|photo|x-[a-z0-9-]+|item\d*\.[a-z-]+|categories|note|bday|title|url|nickname|rev|uid|label|role|geo|tz|impp|lang|kind|prodid|source|sound|logo)[;:]/i.test(nom)) return true;
    // Contact sale si : que des virgules/chiffres/emails/symboles, ou nom trop court, ou contient des métadonnées Samsung
    if (/^[,;\s\d@.+\-_]+$/.test(nom)) return true;
    if (nom.length < 2) return true;
    if (nom.length > 50) return true;
    if (nom.includes("depuis l'appareil") || nom.includes("Importé le") || nom.includes("myContacts") || nom.includes("Restaurés")) return true;
    if (/^[,;]+/.test(nom)) return true;
    if ((nom.match(/,/g)||[]).length > 3) return true;
    // Détecter base64 et données encodées (longues séquences sans espaces)
    if (/^[+\/=]/.test(nom)) return true;
    if (/^[A-Za-z0-9+/=]{20,}/.test(nom.replace(/\s/g, ""))) return true;
    if (nom.includes("=20=") || nom.includes("=4") || nom.includes("=6")) return true;
    if (/[A-Za-z0-9+/]{30,}/.test(nom)) return true;
    // Plus de 3 chiffres consécutifs au début = données techniques
    if (/^[\/+][A-Za-z0-9]{10,}/.test(nom)) return true;
    return false;
  };

  const dirtyContacts = patients.filter(isDirtyContact);

  const supprimerParPaquets = async (liste) => {
    const ids = liste.map(p => p.id).filter(Boolean);
    const ok = new Set();
    for (let i = 0; i < ids.length; i += 100) {
      const paquet = ids.slice(i, i + 100);
      if (await sb.deletePatients(token, paquet)) paquet.forEach(id => ok.add(id));
    }
    return ok;
  };

  const handleCleanContacts = async () => {
    setNettoyage(true);
    const ok = await supprimerParPaquets(dirtyContacts);
    setNettoyage(false);
    setPatients(prev => prev.filter(p => !ok.has(p.id)));
    if (ok.size < dirtyContacts.length) alert(tr("Certains contacts n'ont pas pu être supprimés. Réessayez.","Some contacts could not be deleted. Please try again."));
    setSelected(null);
    setConfirmClean(false);
  };

  const filtered = patients
    .filter(p => p.nom && p.nom.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => {
      try {
        if (sortBy === "rdv") return getPatientRdvs(b.nom).length - getPatientRdvs(a.nom).length;
        if (sortBy === "date") return new Date(b.created_at) - new Date(a.created_at);
        return (a.nom||"").localeCompare(b.nom||"", "fr", {sensitivity:"base"});
      } catch(e) { return 0; }
    });

  const catColors = {
    medical:"#3b82f6", dentiste:"#06b6d4", kine:"#8b5cf6", veterinaire:"#f59e0b",
    garage:"#6b7280", travaux:"#f97316", juridique:"#7c3aed", banque:"#0891b2",
    beaute:"#ec4899", formation:"#10b981", pro:"#2450E6", perso:"#64748b", autre:"#94a3b8"
  };

  const getPatientRdvs = (nom) => appointments.filter(r => r.personne?.toLowerCase() === nom.toLowerCase());

  const handleAdd = async () => {
    if (!form.nom.trim()) return;
    const res = await sb.addPatient(token, user.id, form);
    if (Array.isArray(res) && res[0]) {
      setPatients(prev => [...prev, res[0]]);
      setForm({ nom:"", email:"", telephone:"", notes:"", categorie:"autre" });
      setShowAdd(false);
    }
  };

  const handleDelete = async (id) => {
    await sb.deletePatient(token, id);
    setPatients(prev => prev.filter(p => p.id !== id));
    setSelected(null);
  };

  // Décode les valeurs "QUOTED-PRINTABLE" des vieux fichiers vCard (=C3=A9 → é)
  const decodeQP = (v) => {
    try {
      const bytes = [];
      const s = v.replace(/=\r?\n/g, "");
      for (let i = 0; i < s.length; i++) {
        if (s[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(s.substr(i + 1, 2))) { bytes.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; }
        else bytes.push(s.charCodeAt(i) & 0xff);
      }
      return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
    } catch { return v; }
  };

  // Fichier vCard (.vcf) → [{ nom, email, telephone }]
  const lireVCard = (texte) => {
    // Les lignes qui commencent par un espace continuent la ligne précédente
    const lignes = texte.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
    const contacts = []; let cur = null; let qpSuite = null;
    for (let raw of lignes) {
      if (qpSuite !== null) { raw = qpSuite + raw; qpSuite = null; }
      if (/ENCODING=QUOTED-PRINTABLE/i.test(raw) && raw.endsWith("=")) { qpSuite = raw.slice(0, -1); continue; }
      const l = raw.trim();
      if (/^BEGIN:VCARD/i.test(l)) { cur = { fn:"", n:"", email:"", tel:"" }; continue; }
      if (/^END:VCARD/i.test(l)) { if (cur) contacts.push(cur); cur = null; continue; }
      if (!cur) continue;
      const k = l.indexOf(":"); if (k < 0) continue;
      const cle = l.slice(0, k); let val = l.slice(k + 1);
      if (/ENCODING=QUOTED-PRINTABLE/i.test(cle)) val = decodeQP(val);
      const nomCle = cle.split(";")[0].replace(/^item\d+\./i, "").toUpperCase();
      if (nomCle === "FN" && !cur.fn) cur.fn = val.replace(/\\,/g, ",").trim();
      else if (nomCle === "N" && !cur.n) { const [nomFam, prenom] = val.split(";"); cur.n = [prenom, nomFam].filter(Boolean).join(" ").trim(); }
      else if (nomCle === "EMAIL" && !cur.email) cur.email = val.trim();
      else if (nomCle === "TEL" && !cur.tel) cur.tel = val.trim();
    }
    return contacts.map(x => ({ nom: (x.fn || x.n).trim(), email: x.email, telephone: x.tel }));
  };

  // Fichier CSV (export Google Contacts, Outlook ou tableur) → [{ nom, email, telephone, notes }]
  const lireCSV = (texte) => {
    const parseCSVLine = (line) => {
      const result = []; let cur = ""; let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') { inQuotes = !inQuotes; }
        else if ((line[i] === ',' || line[i] === ';') && !inQuotes) { result.push(cur.trim()); cur = ""; }
        else { cur += line[i]; }
      }
      result.push(cur.trim());
      return result;
    };
    const lines = texte.replace(/\r\n/g, "\n").split("\n").filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g,"").trim());
    return lines.slice(1).map(line => {
      const vals = parseCSVLine(line);
      const row = {};
      headers.forEach((h, idx) => row[h] = (vals[idx]||"").replace(/"/g,"").trim());
      const firstName = row["First Name"] || row["Given Name"] || row["Prénom"] || row["prenom"] || "";
      const middleName = row["Middle Name"] || row["Additional Name"] || "";
      const lastName = row["Last Name"] || row["Family Name"] || row["Nom"] || row["nom"] || "";
      const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
      return {
        nom: fullName || row["Name"] || row["name"] || row["Nom complet"] || vals[0] || "",
        email: row["E-mail Address"] || row["E-mail 1 - Value"] || row["E-mail 2 Address"] || row["email"] || row["Email"] || row["mail"] || "",
        telephone: row["Mobile Phone"] || row["Phone 1 - Value"] || row["Home Phone"] || row["Primary Phone"] || row["Business Phone"] || row["telephone"] || row["Téléphone"] || row["phone"] || "",
        notes: row.notes || row.Notes || "",
      };
    });
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    e.target.value = ""; // pour pouvoir réimporter le même fichier
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const texte = String(evt.target.result || "");
      const estVCard = /BEGIN:VCARD/i.test(texte);
      const lus = estVCard ? lireVCard(texte) : lireCSV(texte);
      // On écarte les contacts invalides et les doublons (déjà dans la liste, ou deux fois dans le fichier)
      const dejaLa = new Set(patients.map(p => (p.nom || "").trim().toLowerCase()));
      const aAjouter = [];
      for (const x of lus) {
        const nom = (x.nom || "").replace(/\s+/g, " ").trim();
        if (!nom || isDirtyContact({ nom })) continue;
        const cle = nom.toLowerCase();
        if (dejaLa.has(cle)) continue;
        dejaLa.add(cle);
        aAjouter.push({ nom, email: (x.email || "").trim(), telephone: (x.telephone || "").trim(), notes: x.notes || "", categorie: "autre" });
      }
      let added = 0;
      for (let i = 0; i < aAjouter.length; i += 100) {
        const res = await sb.addPatients(token, user.id, aAjouter.slice(i, i + 100));
        if (Array.isArray(res)) { setPatients(prev => [...prev, ...res]); added += res.length; }
      }
      setImporting(false);
      const ignores = lus.length - added;
      if (lus.length === 0) alert(tr("Aucun contact trouvé dans ce fichier. Utilisez un fichier .vcf (contacts du téléphone) ou .csv (Google Contacts, Outlook).","No contacts found in this file. Use a .vcf file (phone contacts) or a .csv file (Google Contacts, Outlook)."));
      else alert(tr(`${added} client(s) importé(s).${ignores ? ` ${ignores} ignoré(s) : déjà présents, en double ou sans nom valide.` : ""}`, `${added} client(s) imported.${ignores ? ` ${ignores} skipped: already there, duplicated or without a valid name.` : ""}`));
    };
    reader.readAsText(file);
  };

  const handleDeleteAll = async () => {
    const ok = await supprimerParPaquets(patients);
    setPatients(prev => prev.filter(p => !ok.has(p.id)));
    setSelected(null);
    setConfirmDeleteAll(false);
  };

  const handleUpdatePatient = async (data) => {
    await sb.updatePatient(token, editingPatient.id, data);
    setPatients(prev => prev.map(p => p.id === editingPatient.id ? { ...p, ...data } : p));
    setSelected(prev => prev?.id === editingPatient.id ? { ...prev, ...data } : prev);
    setEditingPatient(null);
  };

  return (
    <div className={`pv-root ${selected || showAdd ? "pv-detail" : "pv-list"}`} style={{ flex:1, display:"flex", overflow:"hidden", position:"relative", height:"100%" }}>
      {/* Modal nettoyage contacts sales */}
      {confirmClean && (
        <div style={{ position:"fixed", inset:0, background:"#00000050", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div className="card fade-up" style={{ maxWidth:440, width:"100%", padding:32 }}>
            <div style={{ fontSize:40, marginBottom:12, textAlign:"center" }}>🧹</div>
            <div style={{ fontWeight:800, fontSize:18, color:"#1e293b", marginBottom:8, textAlign:"center" }}>{tr("Nettoyer les contacts","Clean up contacts")}</div>
            <div style={{ fontSize:14, color:"#64748b", marginBottom:16, lineHeight:1.6, textAlign:"center" }}>
              {tr(<><strong>{dirtyContacts.length} contacts invalides</strong> détectés — sans nom ou mal formatés.</>, <><strong>{dirtyContacts.length} invalid contacts</strong> found — no name or badly formatted.</>)}
            </div>
            <div style={{ background:"#fff8f0", border:"1px solid #fed7aa", borderRadius:10, padding:14, marginBottom:20, maxHeight:160, overflowY:"auto" }}>
              {dirtyContacts.slice(0,10).map(p => (
                <div key={p.id} style={{ fontSize:12, color:"#92400e", padding:"3px 0", borderBottom:"1px solid #fed7aa30" }}>
                  ⚠️ {p.nom?.substring(0,60) || tr("(vide)","(empty)")}
                </div>
              ))}
              {dirtyContacts.length > 10 && <div style={{ fontSize:11, color:"#f97316", marginTop:6 }}>{tr(`...et ${dirtyContacts.length - 10} autres`, `...and ${dirtyContacts.length - 10} more`)}</div>}
            </div>
            <div style={{ display:"flex", gap:12 }}>
              <button className="btn btn-outline" onClick={()=>setConfirmClean(false)} style={{ flex:1 }}>{tr("Annuler","Cancel")}</button>
              <button onClick={handleCleanContacts} disabled={nettoyage} style={{ flex:2, background:"#f97316", color:"#fff", border:"none", borderRadius:8, padding:"12px", cursor:nettoyage?"wait":"pointer", opacity:nettoyage?.7:1, fontWeight:700, fontSize:14 }}>
                {nettoyage ? tr("⏳ Nettoyage en cours…","⏳ Cleaning up…") : tr(`🧹 Supprimer ces ${dirtyContacts.length} contacts`, `🧹 Delete these ${dirtyContacts.length} contacts`)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression tout */}
      {confirmDeleteAll && (
        <div style={{ position:"fixed", inset:0, background:"#00000050", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div className="card fade-up" style={{ maxWidth:400, width:"100%", padding:32, textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🗑️</div>
            <div style={{ fontWeight:800, fontSize:18, color:"#1e293b", marginBottom:10 }}>{tr("Supprimer tous les contacts ?","Delete all contacts?")}</div>
            <div style={{ fontSize:14, color:"#64748b", marginBottom:28, lineHeight:1.6 }}>
              {tr(<>Cette action supprimera <strong>{patients.length} contacts</strong> définitivement. Les RDV existants ne seront pas supprimés.</>, <>This will permanently delete <strong>{patients.length} contacts</strong>. Existing appointments will not be deleted.</>)}
            </div>
            <div style={{ display:"flex", gap:12 }}>
              <button className="btn btn-outline" onClick={()=>setConfirmDeleteAll(false)} style={{ flex:1 }}>{tr("Annuler","Cancel")}</button>
              <button onClick={handleDeleteAll} style={{ flex:1, background:"#ef4444", color:"#fff", border:"none", borderRadius:8, padding:"12px", cursor:"pointer", fontWeight:700, fontSize:14 }}>
                {tr("Tout supprimer","Delete all")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal édition patient */}
      {editingPatient && (
        <div style={{ position:"fixed", inset:0, background:"#00000040", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div className="card fade-up" style={{ width:"100%", maxWidth:480, padding:32, maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ fontWeight:800, fontSize:18, marginBottom:20 }}>{tr("Modifier la fiche client","Edit client")}</div>
            {[
              { key:"nom", label:tr("Nom complet *","Full name *"), placeholder:tr("Nom complet","Full name"), type:"text" },
              { key:"email", label:"EMAIL", placeholder:"email@...", type:"email" },
              { key:"telephone", label:tr("Téléphone","Phone"), placeholder:tr("06...","Phone number"), type:"text" },
              { key:"date_naissance", label:tr("Date de naissance","Date of birth"), placeholder:tr("JJ/MM/AAAA","DD/MM/YYYY"), type:"text" },
              { key:"adresse", label:tr("Adresse complète","Full address"), placeholder:tr("12 rue de la Paix, 75001 Paris","12 High Street, London"), type:"text" },
            ].map(field => (
              <div key={field.key} style={{ marginBottom:14 }}>
                <div className="field-label">{field.label}</div>
                <input type={field.type} placeholder={field.placeholder} defaultValue={editingPatient[field.key]||""} id={`edit-${field.key}`} />
              </div>
            ))}
            <div style={{ marginBottom:20 }}>
              <div className="field-label">Notes</div>
              <textarea rows={3} placeholder={tr("Informations importantes...","Important information...")} defaultValue={editingPatient.notes||""} id="edit-notes" />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="btn btn-outline" onClick={()=>setEditingPatient(null)} style={{ flex:1 }}>{tr("Annuler","Cancel")}</button>
              <button className="btn btn-primary" onClick={()=>{
                const data = {};
                ["nom","email","telephone","date_naissance","adresse"].forEach(k => {
                  data[k] = document.getElementById(`edit-${k}`).value;
                });
                data.notes = document.getElementById("edit-notes").value;
                handleUpdatePatient(data);
              }} style={{ flex:2 }}>{tr("💾 Sauvegarder","💾 Save")}</button>
            </div>
          </div>
        </div>
      )}
      {/* Liste des clients */}
      <div className="pv-left" style={{ width:340, borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", height:"100%", overflow:"hidden", background:"#F5F6F8" }}>
        <div style={{ padding:"20px 16px 12px", display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <h1 style={{ fontWeight:800, fontSize:24, letterSpacing:"-0.02em" }}>{tr("Clients","Clients")}</h1>
            <span style={{ fontSize:13, color:"var(--text2)", fontWeight:600 }}>{patients.length}</span>
          </div>
          <div style={{ position:"relative" }}>
            <Icon name="search" size={18} color="#64748B" style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
            <input placeholder={tr("Rechercher un client…","Search a client…")} value={search} onChange={e=>setSearch(e.target.value)} style={{ paddingLeft:42 }} />
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn btn-primary btn-sm" onClick={()=>setShowAdd(true)} style={{ flex:1 }}><Icon name="plus" size={16} stroke={2.6} /> {tr("Ajouter","Add")}</button>
            <label style={{ flex:1, display:"flex" }}>
              <span className="btn btn-outline btn-sm" style={{ flex:1, cursor:"pointer" }}>
                {importing ? <span className="spinner" style={{ width:16, height:16 }} /> : <><Icon name="download" size={16} /> {tr("Importer","Import")}</>}
              </span>
              <input type="file" accept=".csv,.vcf,text/csv,text/vcard,text/x-vcard" onChange={handleImportCSV} style={{ display:"none" }} />
            </label>
            <select aria-label={tr("Trier","Sort")} value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ flex:1, fontSize:13, minHeight:38, padding:"6px 10px", borderRadius:10 }}>
              <option value="nom">{tr("A → Z","A → Z")}</option>
              <option value="rdv">{tr("Plus de RDV","Most appts")}</option>
              <option value="date">{tr("Récents","Recent")}</option>
            </select>
          </div>
          {dirtyContacts.length > 0 && (
            <button onClick={()=>setConfirmClean(true)} style={{ background:"#FFF7ED", border:"1px solid #FED7AA", color:"#9A3412", borderRadius:12, padding:"10px 12px", cursor:"pointer", fontSize:13, fontWeight:700, textAlign:"left" }}>
              {tr(`${dirtyContacts.length} contact(s) mal formé(s) — nettoyer`, `${dirtyContacts.length} badly formatted contact(s) — clean up`)}
            </button>
          )}
        </div>
        <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:"0 16px 12px" }}>
          {filtered.length === 0 ? (
            <div className="card" style={{ textAlign:"center", padding:"30px 18px" }}>
              <span style={{ width:48, height:48, borderRadius:14, background:"var(--accent-soft)", display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:10 }}><Icon name="users" size={22} color="var(--accent)" /></span>
              <div style={{ fontWeight:700, fontSize:15 }}>{tr("Aucun client trouvé","No clients found")}</div>
              <div style={{ color:"var(--text2)", fontSize:13, marginTop:4 }}>{tr("Ils s'ajoutent automatiquement à chaque RDV.","They are added automatically with each appointment.")}</div>
            </div>
          ) : (
            <div className="card" style={{ padding:"4px 0" }}>
              {filtered.map((p, i) => (
                <button key={p.id} onClick={()=>{ setSelected(p); setTimeout(()=>{ document.getElementById("patients-right-panel")?.scrollTo({top:0,behavior:"smooth"}); window.scrollTo({top:0,behavior:"smooth"}); }, 50); }}
                  style={{ width:"100%", padding:"12px 14px", border:"none", borderTop: i ? "1px solid #F1F5F9" : "none", cursor:"pointer", background:selected?.id===p.id?"var(--accent-soft)":"transparent", display:"flex", alignItems:"center", gap:12, textAlign:"left", font:"inherit", color:"inherit" }}>
                  <span style={{ width:40, height:40, borderRadius:"50%", background:"var(--accent-soft)", color:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:16, flexShrink:0 }}>
                    {p.nom[0]?.toUpperCase()}
                  </span>
                  <span style={{ flex:1, minWidth:0 }}>
                    <span style={{ display:"block", fontWeight:700, fontSize:15, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.nom}</span>
                    <span style={{ display:"block", fontSize:13, color:"var(--text2)" }}>{p.telephone || `${getPatientRdvs(p.nom).length} ${tr("RDV","appt.")}`}</span>
                  </span>
                  <Icon name="back" size={16} color="#94A3B8" style={{ transform:"scaleX(-1)" }} />
                </button>
              ))}
            </div>
          )}
          {patients.length > 0 && (
            <button onClick={()=>setConfirmDeleteAll(true)} style={{ display:"block", margin:"14px auto 0", background:"none", border:"none", color:"#B91C1C", fontSize:13, fontWeight:600, cursor:"pointer", padding:10 }}>{tr("Supprimer tous les clients","Delete all clients")}</button>
          )}
        </div>
      </div>

      {/* Fiche client */}
      <div id="patients-right-panel" className="pv-right" style={{ flex:1, overflowY:"auto", padding:24 }}>
        {(selected || showAdd) && (
          <button className="pv-back" onClick={()=>{ setSelected(null); setShowAdd(false); }}
            style={{ display:"none", alignItems:"center", gap:6, background:"none", border:"none", color:"var(--accent)", fontWeight:700, fontSize:15, cursor:"pointer", padding:"8px 0", marginBottom:10 }}>
            <Icon name="back" size={18} stroke={2.4} /> {tr("Clients","Clients")}
          </button>
        )}
        {showAdd ? (
          <div className="card fade-up" style={{ maxWidth:480 }}>
            <div style={{ fontWeight:800, fontSize:18, marginBottom:20 }}>{tr("Nouveau client","New client")}</div>
            <div style={{ marginBottom:14 }}><div className="field-label">{tr("Nom *","Name *")}</div><input placeholder={tr("Nom complet","Full name")} value={form.nom} onChange={e=>setForm(p=>({...p,nom:e.target.value}))} /></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
              <div><div className="field-label">Email</div><input type="email" placeholder="email@..." value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} /></div>
              <div><div className="field-label">{tr("Téléphone","Phone")}</div><input placeholder={tr("06...","Phone number")} value={form.telephone} onChange={e=>setForm(p=>({...p,telephone:e.target.value}))} /></div>
            </div>
            <div style={{ marginBottom:14 }}><div className="field-label">Notes</div><textarea rows={3} placeholder={tr("Informations importantes...","Important information...")} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} /></div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="btn btn-outline" onClick={()=>setShowAdd(false)} style={{ flex:1 }}>{tr("Annuler","Cancel")}</button>
              <button className="btn btn-primary" onClick={handleAdd} style={{ flex:2 }}>{tr("Ajouter le client","Add client")}</button>
            </div>
          </div>
        ) : selected ? (
          <div className="fade-up" id="fiche-patient">
            {/* En-tête de la fiche */}
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
              <span style={{ width:60, height:60, borderRadius:"50%", background:"var(--accent-soft)", color:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:24, flexShrink:0 }}>
                {selected.nom[0]?.toUpperCase()}
              </span>
              <div style={{ flex:1, minWidth:0 }}>
                <h1 style={{ fontWeight:800, fontSize:24, letterSpacing:"-0.02em", overflowWrap:"anywhere" }}>{selected.nom}</h1>
                <div style={{ fontSize:13, color:"var(--text2)" }}>{tr("Client depuis","Client since")} {new Date(selected.created_at).toLocaleDateString(locale(), { month:"short", year:"numeric" })} · {getPatientRdvs(selected.nom).length} {tr("RDV","appt.")}</div>
              </div>
              <button onClick={()=>setEditingPatient(selected)} className="btn btn-outline btn-sm"><Icon name="edit" size={16} /> <span className="hide-phone">{tr("Modifier","Edit")}</span></button>
            </div>

            {/* Contacter le client */}
            {(() => {
              const tel = (selected.telephone||"").trim(); const wa = telInternational(tel); const mail = (selected.email||"").trim();
              const tuile = (actif) => ({ height:68, borderRadius:14, background: actif ? "#fff" : "#F8FAFC", border:"1px solid var(--border)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, textDecoration:"none", color: actif ? "var(--text)" : "#94A3B8", fontSize:12, fontWeight:700, pointerEvents: actif ? "auto" : "none" });
              return (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4, minmax(0,1fr))", gap:8, marginBottom:12 }}>
                  <a href={tel ? `tel:${tel.replace(/[^\d+]/g,"")}` : undefined} aria-disabled={!tel} style={tuile(!!tel)}><Icon name="phone" size={20} color={tel ? "var(--accent)" : "#94A3B8"} />{tr("Appeler","Call")}</a>
                  <a href={wa ? `https://wa.me/${wa}` : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!wa} style={{ ...tuile(!!wa), ...(wa ? { background:"#F0FDF4", borderColor:"#BBF7D0", color:"#14532D" } : {}) }}><Icon name="whatsapp" size={20} color={wa ? "#15803D" : "#94A3B8"} />WhatsApp</a>
                  <a href={tel ? `sms:${tel.replace(/[^\d+]/g,"")}` : undefined} aria-disabled={!tel} style={tuile(!!tel)}><Icon name="sms" size={20} color={tel ? "var(--accent)" : "#94A3B8"} />SMS</a>
                  <a href={mail ? `mailto:${mail}` : undefined} aria-disabled={!mail} style={tuile(!!mail)}><Icon name="mail" size={20} color={mail ? "var(--accent)" : "#94A3B8"} />Email</a>
                </div>
              );
            })()}

            {onNewRdv && (
              <button className="btn btn-primary" onClick={()=>onNewRdv(selected)} style={{ width:"100%", minHeight:54, fontSize:16, marginBottom:16 }}>
                <Icon name="calendar" size={20} color="#fff" /> {tr("Prendre un RDV","Book an appointment")}
              </button>
            )}

            {/* Coordonnées */}
            <div className="card" style={{ padding:"4px 18px", marginBottom:16 }}>
              {[
                { label:tr("Téléphone","Phone"), value:selected.telephone },
                { label:"Email", value:selected.email },
                { label:tr("Adresse","Address"), value:selected.adresse },
                { label:tr("Date de naissance","Date of birth"), value:selected.date_naissance },
              ].filter((x, i) => x.value || i < 2).map(({label,value}, i) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between", gap:12, padding:"13px 0", borderTop: i ? "1px solid #F1F5F9" : "none", fontSize:14 }}>
                  <span style={{ color:"var(--text2)" }}>{label}</span>
                  <span style={{ fontWeight:700, color: value ? "var(--text)" : "#94A3B8", textAlign:"right", overflowWrap:"anywhere" }}>{value || tr("Non renseigné","Not provided")}</span>
                </div>
              ))}
            </div>

            {/* Notes */}
            {selected.notes && (
              <div className="card" style={{ marginBottom:16 }}>
                <h2 style={{ fontSize:15, fontWeight:800, marginBottom:8 }}>{tr("Notes","Notes")}</h2>
                <div style={{ fontSize:14, color:"var(--text2)", lineHeight:1.7 }}>{selected.notes}</div>
              </div>
            )}

            {/* Historique */}
            <h2 style={{ fontSize:16, fontWeight:800, margin:"4px 0 8px" }}>{tr("Historique","History")}</h2>
            <div className="card" style={{ padding:"4px 18px" }}>
              {getPatientRdvs(selected.nom).length === 0 ? (
                <div style={{ color:"var(--text2)", fontSize:14, padding:"18px 0", textAlign:"center" }}>{tr("Aucun RDV pour ce client","No appointments for this client yet")}</div>
              ) : [...getPatientRdvs(selected.nom)].sort((a,b) => `${b.date} ${b.heure||""}` > `${a.date} ${a.heure||""}` ? 1 : -1).map((rdv,i) => {
                const passe = (rdv.date||"") < isoLocal(new Date());
                return (
                  <div key={rdv.id || i} style={{ display:"flex", gap:12, alignItems:"center", padding:"12px 0", borderTop: i ? "1px solid #F1F5F9" : "none" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:14 }}>{rdv.titre||tr("Rendez-vous","Appointment")}</div>
                      <div style={{ fontSize:13, color:"var(--text2)" }}>{fmtRdv(rdv.date, rdv.heure)}</div>
                    </div>
                    {rdv.statut === "annule" ? <StatutPill statut="annule" /> : passe ? <span className="pill pill-past">{tr("Passé","Past")}</span> : <StatutPill statut={rdv.statut} />}
                  </div>
                );
              })}
            </div>

            <button onClick={()=>handleDelete(selected.id)} style={{ display:"block", margin:"18px auto 0", background:"none", border:"none", color:"#B91C1C", fontSize:14, fontWeight:600, cursor:"pointer", padding:10 }}>{tr("Supprimer ce client","Delete this client")}</button>
          </div>
        ) : (
          <div style={{ textAlign:"center", padding:"80px 40px" }}>
            <span style={{ width:64, height:64, borderRadius:18, background:"var(--accent-soft)", display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}><Icon name="users" size={28} color="var(--accent)" /></span>
            <div style={{ fontWeight:700, fontSize:18, color:"#1e293b", marginBottom:8 }}>{tr("Vos clients","Your clients")}</div>
            <div style={{ color:"#64748B", fontSize:14, lineHeight:1.7 }}>{tr(<>Sélectionnez un client pour voir sa fiche,<br/>ou ajoutez-en un manuellement.<br/><br/>Ils s'ajoutent automatiquement à chaque nouveau RDV.</>, <>Select a client to see their profile,<br/>or add one manually.<br/><br/>They are added automatically with each new appointment.</>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Paramètres Modal ─────────────────────────────────────────
function SettingsModal({ user, onSave, onClose, sb, token, onRevoirGuide, onReservation }) {
  const [rappels, setRappels] = React.useState(user.rappels || ["j-1","j-3"]);
  const [pushEnabled, setPushEnabled] = React.useState(user.push_enabled || false);
  const [pushJ3, setPushJ3] = React.useState(user.push_j3 !== false);
  const [pushJ1, setPushJ1] = React.useState(user.push_j1 !== false);
  const [pushConfirm, setPushConfirm] = React.useState(user.push_confirm !== false);
  const [notifPermission, setNotifPermission] = React.useState(typeof Notification !== "undefined" ? Notification.permission : "default");

  const requestPushPermission = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === "granted") {
      setPushEnabled(true);
      // Test notification
      new Notification("CallRDV 📞", {
        body: tr("Notifications activées ! Vous recevrez vos rappels directement ici.","Notifications enabled! You will get your reminders right here."),
        icon: "/icon-192.png"
      });
    }
  };

  const [email, setEmail] = React.useState(user.email || user.email_auth || "");
  const [metier, setMetier] = React.useState(user.metier || "autre");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const toggleRappel = (val) => {
    setRappels(prev => prev.includes(val) ? prev.filter(r=>r!==val) : [...prev, val]);
  };

  const handleSave = async () => {
    setSaving(true);
    const data = { rappels, email, metier, push_enabled: pushEnabled, push_j3: pushJ3, push_j1: pushJ1, push_confirm: pushConfirm };
    await sb.updateProfile(token, user.id, data);
    onSave(data);
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1500);
  };

  const options = [
    { value:"j-3", label:tr("3 jours avant","3 days before"), icon:"📅" },
    { value:"j-1", label:tr("La veille","The day before"), icon:"🔔" },
    { value:"j-0", label:tr("Le matin même","The same morning"), icon:"☀️" },
  ];

  const toggle = (value, onClick) => (
    <div onClick={onClick}
      style={{ width:44, height:24, borderRadius:12, background:value?"#2450E6":"#e2e8f0", cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}>
      <div style={{ position:"absolute", top:3, left:value?20:3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left .2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}></div>
    </div>
  );
  const darkOn = document.documentElement.style.getPropertyValue("--bg")==="#0a0f1e";

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000040", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24, overflowY:"auto" }}>
      <div className="card fade-up" style={{ width:"100%", maxWidth:420, padding:28, maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ fontWeight:800, fontSize:20, marginBottom:4, color:"#1e293b" }}>{tr("Réglages","Settings")}</div>
        <div style={{ fontSize:13, color:"#64748B", marginBottom:24 }}>{tr("Configurez vos rappels de rendez-vous","Set up your appointment reminders")}</div>

        {/* Langue */}
        <div style={{ marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
          <div className="field-label" style={{ marginBottom:0 }}>{tr("Langue","Language")}</div>
          <LangSwitch />
        </div>

        {/* Métier : sert au titre proposé des RDV et à la liste de départ des prestations en ligne */}
        <div style={{ marginBottom:20 }}>
          <label htmlFor="reglages-metier" className="field-label" style={{ display:"block" }}>{tr("Mon métier","My business")}</label>
          <select id="reglages-metier" value={metier} onChange={e=>setMetier(e.target.value)}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{tr(c.fr, c.en)}</option>)}
          </select>
          {metier !== (user.metier || "autre") && user.booking_enabled && (
            <div style={{ fontSize:12, color:"var(--text2)", marginTop:6, lineHeight:1.5 }}>{tr("Vos prestations en ligne ne changent pas toutes seules : pour reprendre la liste de ce métier, ouvrez Réservation en ligne → « Liste de départ ».","Your online services don't change by themselves: to use this business's list, open Online booking → “Starter list”.")}</div>
          )}
        </div>

        {/* Réservation en ligne */}
        {onReservation && (
          <button id="reglages-reservation" type="button" onClick={onReservation} style={{ width:"100%", marginBottom:20, padding:16, borderRadius:14, background: user.booking_enabled ? "var(--accent-soft)" : "#F8FAFC", border:"1px solid var(--border)", display:"flex", alignItems:"center", gap:12, cursor:"pointer", textAlign:"left", font:"inherit", color:"var(--text)" }}>
            <span style={{ width:40, height:40, borderRadius:12, background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Icon name="calendar" size={20} color="#fff" /></span>
            <span style={{ flex:1, minWidth:0 }}>
              <span style={{ display:"block", fontWeight:800, fontSize:15 }}>{tr("Réservation en ligne","Online booking")}</span>
              <span style={{ display:"block", fontSize:13, color:"var(--text2)", marginTop:2 }}>{user.booking_enabled ? tr("Activée · ","On · ") + `callrdv.com/${user.booking_slug}` : tr("Vos clients réservent seuls, 24h/24","Clients book on their own, 24/7")}</span>
            </span>
            <span style={{ transform:"scaleX(-1)", display:"flex", color:"var(--text2)" }}><Icon name="back" size={18} /></span>
          </button>
        )}

        {/* Synchroniser avec mon calendrier (abonnement .ics) */}
        {user.calendar_token && (() => {
          const lien = `${CONFIG.SUPABASE_URL}/functions/v1/calendrier/${user.calendar_token}.ics`;
          const webcal = lien.replace(/^https:/, "webcal:");
          const bouton = { display:"flex", alignItems:"center", justifyContent:"center", gap:8, minHeight:44, borderRadius:12, border:"1px solid var(--border)", background:"#fff", fontSize:13, fontWeight:700, color:"var(--text)", textDecoration:"none", cursor:"pointer", padding:"0 10px" };
          return (
            <div style={{ marginBottom:20, padding:16, borderRadius:14, background:"#F8FAFC", border:"1px solid var(--border)" }}>
              <div className="field-label" style={{ marginBottom:4 }}>{tr("Synchroniser avec mon calendrier","Sync with my calendar")}</div>
              <div style={{ fontSize:13, color:"var(--text2)", lineHeight:1.5, marginBottom:12 }}>
                {tr("Vos RDV CallRDV apparaissent tout seuls dans votre calendrier. À faire une seule fois.","Your CallRDV appointments show up in your calendar automatically. You only do this once.")}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0,1fr))", gap:8, marginBottom:8 }}>
                <a href={webcal} style={bouton}>Apple</a>
                <a href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer" style={bouton}>Google</a>
                <a href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(lien)}&name=CallRDV`} target="_blank" rel="noopener noreferrer" style={bouton}>Outlook</a>
              </div>
              <button type="button" style={{ ...bouton, width:"100%" }} onClick={async () => {
                try { await navigator.clipboard.writeText(lien); alert(tr("Lien copié. Collez-le dans votre calendrier (« Ajouter un calendrier » → « À partir d'une URL »).","Link copied. Paste it into your calendar (\"Add calendar\" → \"From URL\").")); }
                catch { window.prompt(tr("Copiez ce lien :","Copy this link:"), lien); }
              }}><Icon name="file" size={16} /> {tr("Copier mon lien","Copy my link")}</button>
              <div style={{ fontSize:12, color:"var(--text2)", lineHeight:1.5, marginTop:10 }}>
                {tr("Mise à jour : quelques minutes sur iPhone, jusqu'à plusieurs heures sur Google (c'est Google qui décide). Ce lien est personnel : ne le partagez pas.","Updates: a few minutes on iPhone, up to several hours on Google (Google decides). This link is personal: don't share it.")}
              </div>
              <button type="button" onClick={() => {
                if (!window.confirm(tr("Créer un nouveau lien ? L'ancien ne marchera plus : il faudra rajouter le calendrier dans votre téléphone.","Create a new link? The old one will stop working: you will need to add the calendar again on your phone."))) return;
                const nouveau = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : null;
                if (nouveau) onSave({ calendar_token: nouveau });
              }} style={{ background:"none", border:"none", color:"#B91C1C", fontSize:12, fontWeight:700, cursor:"pointer", padding:"8px 0 0" }}>
                {tr("Changer mon lien (si je l'ai partagé par erreur)","Change my link (if I shared it by mistake)")}
              </button>
            </div>
          );
        })()}

        {onRevoirGuide && (
          <button onClick={onRevoirGuide} className="btn btn-outline btn-sm" style={{ width:"100%", marginBottom:20 }}>
            <Icon name="help" size={16} /> {tr("Revoir le guide de démarrage","Replay the getting-started tour")}
          </button>
        )}

        <div style={{ marginBottom:20 }}>
          <div className="field-label">{tr("Email pour les rappels","Email for reminders")}</div>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={tr("votre@email.com","your@email.com")} />
          <div style={{ fontSize:11, color:"#64748B", marginTop:6 }}>{tr("Vos rappels seront envoyés à cette adresse","Your reminders will be sent to this address")}</div>
        </div>

        <div style={{ marginBottom:24 }}>
          <div className="field-label">{tr("Quand envoyer les rappels","When to send reminders")}</div>
          <div style={{ fontSize:11, color:"#64748B", marginTop:4 }}>{tr("Pour vous, et pour vos clients dont l'email est renseigné.","For you, and for your clients whose email is provided.")}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:8 }}>
            {options.map(opt => (
              <div key={opt.value} onClick={()=>toggleRappel(opt.value)}
                style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 16px", borderRadius:10, border:`1.5px solid ${rappels.includes(opt.value)?"#2450E6":"#e2e8f0"}`, background:rappels.includes(opt.value)?"#f0f4ff":"#fff", cursor:"pointer", transition:"all .2s" }}>
                <span style={{ fontSize:20 }}>{opt.icon}</span>
                <span style={{ fontWeight:600, fontSize:14, color:rappels.includes(opt.value)?"#2450E6":"#475569" }}>{opt.label}</span>
                <div style={{ marginLeft:"auto", width:20, height:20, borderRadius:"50%", border:`2px solid ${rappels.includes(opt.value)?"#2450E6":"#cbd5e1"}`, background:rappels.includes(opt.value)?"#2450E6":"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {rappels.includes(opt.value) && <span style={{ color:"#fff", fontSize:12 }}>✓</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Apparence */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
            {tr("🎨 Apparence","🎨 Appearance")}
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", background:"#f8fafc", borderRadius:8 }}>
            <span style={{ fontSize:13, color:"#475569" }}>{tr("Mode sombre","Dark mode")}</span>
            {toggle(darkOn, ()=>{ if(typeof window.__toggleDarkMode==="function") window.__toggleDarkMode(); })}
          </div>
        </div>

        {/* Notifications Push */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
            {tr("📲 Notifications push","📲 Push notifications")}
          </div>

          {notifPermission === "denied" && (
            <div style={{ background:"#fff5f5", border:"1px solid #fecaca", borderRadius:10, padding:12, marginBottom:14, fontSize:12, color:"#ef4444" }}>
              {tr("⚠️ Notifications bloquées dans votre navigateur. Modifiez les paramètres de votre navigateur pour les autoriser.","⚠️ Notifications are blocked in your browser. Change your browser settings to allow them.")}
            </div>
          )}

          {notifPermission !== "granted" && notifPermission !== "denied" && (
            <button onClick={requestPushPermission} style={{ width:"100%", background:"#f0f4ff", border:"1px solid #2450E630", borderRadius:10, padding:"12px 16px", cursor:"pointer", fontSize:13, fontWeight:600, color:"#2450E6", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              {tr("🔔 Activer les notifications push","🔔 Enable push notifications")}
            </button>
          )}

          {notifPermission === "granted" && (
            <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:12, marginBottom:14, fontSize:12, color:"#16a34a", display:"flex", alignItems:"center", gap:8 }}>
              {tr("✅ Notifications autorisées","✅ Notifications allowed")}
            </div>
          )}

          {notifPermission === "granted" && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {[
                { key:"on",  label:tr("Activer les notifications push","Enable push notifications"), value:pushEnabled, set:setPushEnabled },
                { key:"j3",  label:tr("Rappel J-3 par notification","3-day reminder notification"), value:pushJ3, set:setPushJ3 },
                { key:"j1",  label:tr("Rappel J-1 par notification","1-day reminder notification"), value:pushJ1, set:setPushJ1 },
                { key:"new", label:tr("Confirmation de création RDV","New appointment confirmation"), value:pushConfirm, set:setPushConfirm },
              ].map(({key, label, value, set}) => (
                <div key={key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, padding:"10px 14px", background:"#f8fafc", borderRadius:8 }}>
                  <span style={{ fontSize:13, color:"#475569" }}>{label}</span>
                  {toggle(value, ()=>set(!value))}
                </div>
              ))}
            </div>
          )}
        </div>

        {saved && <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:13, color:"#16a34a", fontWeight:600 }}>{tr("✅ Paramètres sauvegardés !","✅ Settings saved!")}</div>}

        <div style={{ display:"flex", gap:10 }}>
          <button className="btn btn-outline" onClick={onClose} style={{ flex:1 }}>{tr("Annuler","Cancel")}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex:2, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            {saving ? <span className="spinner"></span> : tr("💾 Sauvegarder","💾 Save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook reconnaissance vocale
function useSpeech(onResult) {
  const [listening, setListening] = React.useState(false);
  const recRef = React.useRef(null);

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert(tr("Reconnaissance vocale non supportée sur ce navigateur. Utilisez Chrome.","Voice input is not supported on this browser. Please use Chrome.")); return; }
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      onResult(text);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const stop = () => {
    recRef.current?.stop();
    setListening(false);
  };

  return { listening, start, stop };
}

function RdvForm({ onSave, onCancel, userMetier }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const prefillNom = window.__prefillNom || "";
  const prefillPatient = window.__prefillPatient || null;
  const [showMore, setShowMore] = useState(false);
  window.__prefillNom = null;
  window.__prefillPatient = null;
  setTimeout(()=>{ window.__prefillCategorie = null; }, 100);

  const [form, setForm] = useState({
    titre: "",
    personne: prefillNom,
    categorie: window.__prefillCategorie || (userMetier && userMetier !== "autre" ? userMetier : "autre"),
    client_email: prefillPatient?.email || "",
    date: "",
    heure: "",
    lieu: "",
    adresse: "",
    notes: "",
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  // Reconnaissance vocale par champ
  // Pré-remplir depuis fiche patient si disponible
  useEffect(() => {
    if (prefillPatient?.telephone) set("telephone_contact", prefillPatient.telephone);
    if (prefillPatient?.notes) set("notes", prefillPatient.notes);
  }, []);

  const speechPersonne = useSpeech((t) => set("personne", t));
  const speechLieu     = useSpeech((t) => set("lieu", t));
  const speechNotes    = useSpeech((t) => set("notes", form.notes ? form.notes + " " + t : t));

  const categories = CATEGORIES.map(k => ({ value:k.value, label:tr(k.fr, k.en), titre:tr(k.titreFr, k.titreEn) }));

  const handleCategorie = (val) => {
    const cat = categories.find(c => c.value === val);
    setForm(prev => ({ ...prev, categorie: val, titre: prev.titre || (cat ? cat.titre : tr("Rendez-vous","Appointment")) }));
  };

  const isValid = form.personne.trim() && form.date.trim();

  // Champs dynamiques par catégorie
  const champsSpecifiques = {
    medical: [
      { key:"telephone", label:tr("Téléphone","Phone"), placeholder:tr("06...","Phone number"), type:"text" },
      { key:"motif", label:tr("Motif de consultation","Reason for visit"), placeholder:tr("Douleur, contrôle, renouvellement...","Pain, check-up, prescription renewal..."), type:"text" },
      { key:"medecin", label:tr("Médecin / spécialiste","Doctor / specialist"), placeholder:tr("Dr. Martin, Cardiologue...","Dr Smith, cardiologist..."), type:"text" },
    ],
    restaurant: [
      { key:"nb_personnes", label:tr("Nombre de personnes","Number of guests"), placeholder:"2", type:"number" },
      { key:"heure_arrivee", label:tr("Heure d'arrivée","Arrival time"), placeholder:tr("20h00","8:00 PM"), type:"text" },
      { key:"demandes", label:tr("Demandes spéciales","Special requests"), placeholder:tr("Table en terrasse, anniversaire, allergie...","Terrace table, birthday, allergy..."), type:"text" },
    ],
    garage: [
      { key:"vehicule", label:tr("Marque / modèle","Make / model"), placeholder:tr("Renault Clio, Peugeot 308...","Ford Focus, VW Golf..."), type:"text" },
      { key:"immat", label:tr("Immatriculation","Registration"), placeholder:tr("AB-123-CD","AB12 CDE"), type:"text" },
      { key:"intervention", label:tr("Type d'intervention","Type of work"), placeholder:tr("Révision, freins, courroie...","Service, brakes, timing belt..."), type:"text" },
    ],
    juridique: [
      { key:"type_dossier", label:tr("Type de dossier","Type of case"), placeholder:tr("Succession, divorce, immobilier...","Probate, divorce, property..."), type:"text" },
      { key:"documents", label:tr("Documents à apporter","Documents to bring"), placeholder:tr("CNI, contrat, acte...","ID, contract, deed..."), type:"text" },
    ],
    travaux: [
      { key:"type_travaux", label:tr("Type de travaux","Type of work"), placeholder:tr("Plomberie, électricité, peinture...","Plumbing, electrics, painting..."), type:"text" },
      { key:"acces", label:tr("Accès / digicode","Access / door code"), placeholder:tr("Code d'accès, étage, interphone...","Door code, floor, intercom..."), type:"text" },
    ],
    beaute: [
      { key:"prestation", label:tr("Prestation","Service"), placeholder:tr("Coupe, couleur, brushing...","Cut, colour, blow-dry..."), type:"text" },
      { key:"coiffeur", label:tr("Préférence coiffeur","Preferred stylist"), placeholder:tr("Nom du coiffeur souhaité","Preferred stylist's name"), type:"text" },
    ],
    banque: [
      { key:"type_rdv", label:tr("Type de rdv","Type of appointment"), placeholder:tr("Crédit, investissement, compte...","Loan, investment, account..."), type:"text" },
      { key:"documents", label:tr("Documents à apporter","Documents to bring"), placeholder:tr("Bulletins de salaire, avis d'imposition...","Payslips, tax return..."), type:"text" },
    ],
    veterinaire: [
      { key:"animal", label:tr("Nom de l'animal","Pet's name"), placeholder:tr("Rex, Mimi...","Max, Bella..."), type:"text" },
      { key:"espece", label:tr("Espèce / race","Species / breed"), placeholder:tr("Chien Labrador, Chat Siamois...","Labrador dog, Siamese cat..."), type:"text" },
      { key:"motif_veto", label:tr("Motif","Reason"), placeholder:tr("Vaccination, contrôle, urgence...","Vaccination, check-up, emergency..."), type:"text" },
    ],
  };

  const champs = champsSpecifiques[form.categorie] || [];

  // Cases à toucher : 3 prochains jours et heures courantes
  const joursRapides = [0,1,2].map(n => { const d = new Date(); d.setDate(d.getDate()+n); return { iso: isoLocal(d), haut: n===0 ? tr("Auj.","Today") : n===1 ? tr("Dem.","Tom.") : d.toLocaleDateString(locale(), { weekday:"short" }).replace(".",""), num: d.getDate() }; });
  const heuresRapides = ["09:00","10:00","11:00","14:00","15:00","16:00","17:00"];
  const autreDate = form.date && !joursRapides.some(j => j.iso === form.date);
  const autreHeure = form.heure && !heuresRapides.includes(form.heure);
  const [voirDate, setVoirDate] = useState(false);
  const [voirHeure, setVoirHeure] = useState(false);
  const micBtn = (sp) => (
    <button type="button" title={tr("Dicter","Dictate")} aria-label={tr("Dicter","Dictate")} onClick={sp.listening ? sp.stop : sp.start}
      style={{ position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", width:40, height:40, background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color: sp.listening ? "#DC2626" : "#64748B" }}>
      <Icon name={sp.listening ? "stop" : "mic"} size={18} />
    </button>
  );

  return (
    <div className="form-open" style={{ maxWidth:560 }}>
      {/* En-tête */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:22 }}>
        <button type="button" onClick={onCancel} aria-label={tr("Retour","Back")} style={{ width:42, height:42, borderRadius:12, background:"#fff", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"var(--text)", flexShrink:0 }}><Icon name="back" size={20} stroke={2.2} /></button>
        <h1 style={{ fontWeight:800, fontSize:22, letterSpacing:"-0.02em" }}>{tr("Nouveau rendez-vous","New appointment")}</h1>
      </div>

      {/* Nom du client */}
      <div style={{ marginBottom:18 }}>
        <label htmlFor="rdv-nom" className="field-label" style={{ display:"block" }}>{tr("Nom du client *","Client name *")}</label>
        <div style={{ position:"relative" }}>
          <input
            id="rdv-nom"
            placeholder={tr("Ex : Mme Durand","e.g. Mrs Smith")}
            autoFocus={!form.personne}
            autoCapitalize="words"
            value={form.personne}
            onChange={e=>{ set("personne",e.target.value); setShowSuggestions(true); }}
            onFocus={()=>setShowSuggestions(true)}
            onBlur={()=>setTimeout(()=>setShowSuggestions(false), 200)}
            style={{ paddingRight:48, fontSize:16, fontWeight:600, height:52 }}
            autoComplete="off"
          />
          {showSuggestions && form.personne && (() => {
            const allPatients = window.__patients || [];
            const matches = allPatients.filter(p => p.nom && p.nom.toLowerCase().includes(form.personne.toLowerCase()) && p.nom.toLowerCase() !== form.personne.toLowerCase()).slice(0, 6);
            if (matches.length === 0) return null;
            return (
              <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0, background:"#fff", border:"1px solid #E2E8F0", borderRadius:14, zIndex:50, maxHeight:220, overflowY:"auto", boxShadow:"0 12px 30px rgba(15,23,42,.12)" }}>
                {matches.map(p => (
                  <div
                    key={p.id}
                    onMouseDown={(e)=>{ e.preventDefault(); set("personne", p.nom); if (p.email) set("client_email", p.email); setShowSuggestions(false); }}
                    style={{ padding:"12px 14px", cursor:"pointer", borderBottom:"1px solid #F1F5F9", fontSize:14 }}
                    onMouseEnter={e=>e.currentTarget.style.background="#EEF2FF"}
                    onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                    <div style={{ fontWeight:700 }}>{p.nom}</div>
                    {p.telephone && <div style={{ fontSize:12, color:"var(--text2)" }}>{p.telephone}</div>}
                  </div>
                ))}
              </div>
            );
          })()}
          {micBtn(speechPersonne)}
        </div>
      </div>

      {/* Jour */}
      <fieldset style={{ border:"none", marginBottom:18 }}>
        <legend className="field-label">{tr("Jour *","Day *")}</legend>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4, minmax(0,1fr))", gap:8 }}>
          {joursRapides.map(j => (
            <button key={j.iso} type="button" aria-pressed={form.date===j.iso} onClick={()=>{ set("date", j.iso); setVoirDate(false); }} className={`chip ${form.date===j.iso ? "chip-on" : ""}`} style={{ height:64, fontSize:12, color: form.date===j.iso ? "#fff" : "var(--text2)", textTransform:"capitalize" }}>
              {j.haut}<br/><span style={{ fontSize:18, fontWeight:800, color: form.date===j.iso ? "#fff" : "var(--text)" }}>{j.num}</span>
            </button>
          ))}
          <button type="button" aria-pressed={!!autreDate} onClick={()=>setVoirDate(v=>!v)} className={`chip ${autreDate ? "chip-on" : "chip-dash"}`} style={{ height:64, fontSize:12, lineHeight:1.3 }}>
            {autreDate ? <>{new Date(form.date+"T12:00:00").toLocaleDateString(locale(), { day:"numeric", month:"short" })}</> : <>{tr("Autre","Other")}<br/>{tr("date","date")}</>}
          </button>
        </div>
        {(voirDate || autreDate) && <input type="date" aria-label={tr("Choisir une date","Pick a date")} value={form.date} onChange={e=>set("date",e.target.value)} style={{ marginTop:10 }} />}
      </fieldset>

      {/* Heure */}
      <fieldset style={{ border:"none", marginBottom:18 }}>
        <legend className="field-label">{tr("Heure","Time")}</legend>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4, minmax(0,1fr))", gap:8 }}>
          {heuresRapides.map(h => (
            <button key={h} type="button" aria-pressed={form.heure===h} onClick={()=>{ set("heure", form.heure===h ? "" : h); setVoirHeure(false); }} className={`chip ${form.heure===h ? "chip-on" : ""}`} style={{ height:46, fontSize:14 }}>{h}</button>
          ))}
          <button type="button" aria-pressed={!!autreHeure} onClick={()=>setVoirHeure(v=>!v)} className={`chip ${autreHeure ? "chip-on" : "chip-dash"}`} style={{ height:46, fontSize:13 }}>{autreHeure ? form.heure : tr("Autre","Other")}</button>
        </div>
        {(voirHeure || autreHeure) && <input type="time" aria-label={tr("Choisir une heure","Pick a time")} value={form.heure} onChange={e=>set("heure",e.target.value)} style={{ marginTop:10 }} />}
      </fieldset>

      {/* Type de RDV */}
      <div style={{ marginBottom:18 }}>
        <label htmlFor="rdv-type" className="field-label" style={{ display:"block" }}>{tr("Type de RDV","Appointment type")}</label>
        <select id="rdv-type" value={form.categorie} onChange={e=>handleCategorie(e.target.value)}>
          {categories.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Email du client : rappel automatique */}
      <div style={{ marginBottom:18 }}>
        <label htmlFor="rdv-email" className="field-label" style={{ display:"block" }}>{tr("Email du client","Client email")}</label>
        <input id="rdv-email" type="email" inputMode="email" autoComplete="off" placeholder={tr("client@email.com (facultatif)","client@email.com (optional)")} value={form.client_email} onChange={e=>set("client_email",e.target.value)} />
        <div style={{ display:"flex", gap:8, alignItems:"flex-start", fontSize:13, color:"var(--text2)", marginTop:8, lineHeight:1.45 }}>
          <Icon name="mail" size={16} color="var(--accent)" style={{ marginTop:1 }} />
          <span>{tr("Le client reçoit une confirmation tout de suite, puis un rappel 3 jours et 1 jour avant.","Your client gets a confirmation right away, then a reminder 3 days and 1 day before.")}</span>
        </div>
      </div>

      {/* Bouton Plus de détails */}
      <div style={{ marginBottom:showMore?20:16 }}>
        <button type="button" onClick={()=>setShowMore(s=>!s)} style={{ background:"transparent", border:"1px dashed #CBD5E1", borderRadius:12, padding:"12px 16px", width:"100%", cursor:"pointer", color:"var(--text2)", fontSize:14, fontWeight:700, minHeight:46 }}>
          {showMore ? tr("− Moins de détails","− Fewer details") : tr("+ Plus de détails (titre, lieu, notes…)","+ More details (title, place, notes…)")}
        </button>
      </div>

      {showMore && <>

      {/* Titre */}
      <div style={{ marginBottom:16 }}>
        <label htmlFor="rdv-titre" className="field-label" style={{ display:"block" }}>{tr("Titre du RDV","Title")}</label>
        <input id="rdv-titre" placeholder={tr("Rempli automatiquement si vide","Filled in automatically if empty")} value={form.titre} onChange={e=>set("titre",e.target.value)} />
      </div>

      {/* Lieu + Adresse */}
      <div style={{ marginBottom:16 }}>
        <div className="field-label">{tr("Lieu","Place")}</div>
        <div style={{ position:"relative" }}>
          <input placeholder={tr("Ex: Cabinet médical, Garage Renault, Domicile...","e.g. Clinic, garage, client's home...")} value={form.lieu} onChange={e=>set("lieu",e.target.value)} style={{ paddingRight:42 }} />
          {micBtn(speechLieu)}
        </div>
      </div>
      <div style={{ marginBottom:16 }}>
        <div className="field-label">{tr("Adresse complète","Full address")}</div>
        <input placeholder={tr("Ex: 12 rue de la Paix, 75001 Paris...","e.g. 12 High Street, London...")} value={form.adresse} onChange={e=>set("adresse",e.target.value)} />
      </div>

      {/* Champs dynamiques par catégorie */}
      {champs.length > 0 && (
        <div style={{ background:"#f8faff", border:"1px solid #e2e8f0", borderRadius:12, padding:16, marginBottom:20 }}>
          <div style={{ fontSize:11, color:"#2450E6", fontFamily:"inherit", fontWeight:700, marginBottom:14 }}>
            {tr("Informations spécifiques","Specific details")}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {champs.map(champ => (
              <div key={champ.key}>
                <div className="field-label">{champ.label}</div>
                <input
                  type={champ.type}
                  placeholder={champ.placeholder}
                  value={form[champ.key] || ""}
                  onChange={e => set(champ.key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div style={{ marginBottom:24 }}>
        <div className="field-label">{tr("Notes","Notes")}</div>
        <div style={{ position:"relative" }}>
          <textarea rows={3} placeholder={tr("Documents à apporter, motif de la visite, informations importantes...","Documents to bring, reason for the visit, important information...")} value={form.notes} onChange={e=>set("notes",e.target.value)} style={{ paddingRight:48 }} />
          <button type="button" aria-label={tr("Dicter","Dictate")} onClick={speechNotes.listening ? speechNotes.stop : speechNotes.start}
            style={{ position:"absolute", right:6, top:6, width:40, height:40, background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color: speechNotes.listening ? "#DC2626" : "#64748B" }}>
            <Icon name={speechNotes.listening ? "stop" : "mic"} size={18} />
          </button>
        </div>
        {speechNotes.listening && (
          <div style={{ fontSize:11, color:"#ff4444", fontFamily:"inherit", marginTop:6, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ animation:"blink 1s infinite", display:"inline-block" }}>●</span> {tr("Parlez maintenant...","Speak now...")}
          </div>
        )}
      </div>

      {/* Privacy badge */}
      <div className="privacy-badge" style={{ marginBottom:20 }}>
        <Icon name="check" size={16} color="#16A34A" />
        <div style={{ fontSize:11, color:"#0369a1", fontFamily:"inherit", lineHeight:1.5 }}>
          <span style={{ color:"#0284c7", fontWeight:700 }}>{tr("Données protégées — ","Data protected — ")}</span>
          {tr("Hébergées en Europe, accessibles uniquement depuis votre compte.","Hosted in Europe, only accessible from your account.")}
        </div>
      </div>

      </>}

      {/* Boutons */}
      <div style={{ display:"flex", gap:10 }}>
        <button className="btn btn-outline" onClick={onCancel} style={{ flex:1 }}>{tr("Annuler","Cancel")}</button>
        <button id="rdv-enregistrer" className="btn btn-primary" onClick={()=>isValid&&onSave({ ...form, confirmedAt:new Date().toLocaleTimeString(locale()) })}
          disabled={!isValid} style={{ flex:2.4, padding:"14px 12px", minHeight:54 }}>
          <Icon name="check" size={18} color="#fff" stroke={2.6} />
          {isValid ? `${tr("Enregistrer","Save")} · ${fmtRdv(form.date, form.heure)}` : tr("Enregistrer le RDV","Save appointment")}
        </button>
      </div>
      {!isValid && <div style={{ fontSize:13, color:"#B45309", marginTop:10, textAlign:"center" }}>{tr("Le nom du client et le jour sont obligatoires","Client name and day are required")}</div>}
    </div>
  );
}

// ── Landing Page ─────────────────────────────────────────────
function ContactModal({ onClose }) {
  const [nom, setNom] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState("");
  const { t } = useLang();

  const handleSend = async () => {
    if (!nom.trim() || !email.trim() || !message.trim()) {
      setError(t("Veuillez remplir tous les champs.","Please fill in all fields."));
      return;
    }
    setSending(true);
    setError("");
    try {
      // Envoi via la fonction Supabase "contact" : la clé Resend reste côté serveur
      const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": CONFIG.SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ nom, email, message })
      });
      if (res.ok) {
        setSent(true);
      } else {
        setError(t("Erreur lors de l'envoi. Réessayez.","Sending failed. Try again."));
      }
    } catch(e) {
      setError(t("Erreur réseau. Réessayez.","Network error. Try again."));
    }
    setSending(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000060", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:480, overflow:"hidden" }}>
        <div style={{ padding:"24px 32px", borderBottom:"1px solid #e2e8f0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontWeight:800, fontSize:18, color:"#1e293b" }}>{t("📬 Nous contacter","📬 Contact us")}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#64748B" }}>✕</button>
        </div>
        <div style={{ padding:"28px 32px" }}>
          {sent ? (
            <div style={{ textAlign:"center", padding:"20px 0" }}>
              <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
              <div style={{ fontWeight:700, fontSize:18, color:"#1e293b", marginBottom:8 }}>{t("Message envoyé !","Message sent!")}</div>
              <div style={{ fontSize:14, color:"#64748b", marginBottom:24 }}>{t("Nous vous répondrons dans les plus brefs délais.","We will get back to you as soon as possible.")}</div>
              <button onClick={onClose} style={{ background:"#2450E6", color:"#fff", border:"none", borderRadius:10, padding:"12px 32px", cursor:"pointer", fontWeight:700 }}>{t("Fermer","Close")}</button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, color:"#64748B", fontFamily:"inherit", marginBottom:6 }}>{t("VOTRE NOM","YOUR NAME")}</div>
                <input value={nom} onChange={e=>setNom(e.target.value)} placeholder={t("Nom complet","Full name")} style={{ width:"100%", padding:"11px 14px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14, fontFamily:"DM Sans, sans-serif" }} />
              </div>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, color:"#64748B", fontFamily:"inherit", marginBottom:6 }}>{t("VOTRE EMAIL","YOUR EMAIL")}</div>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@..." style={{ width:"100%", padding:"11px 14px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14, fontFamily:"DM Sans, sans-serif" }} />
              </div>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, color:"#64748B", fontFamily:"inherit", marginBottom:6 }}>MESSAGE</div>
                <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder={t("Votre message...","Your message...")} rows={4} style={{ width:"100%", padding:"11px 14px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14, fontFamily:"DM Sans, sans-serif", resize:"vertical" }} />
              </div>
              {error && <div style={{ color:"#ef4444", fontSize:13, marginBottom:14 }}>⚠️ {error}</div>}
              <button onClick={handleSend} disabled={sending} style={{ width:"100%", background:"#2450E6", color:"#fff", border:"none", borderRadius:10, padding:"13px", cursor:"pointer", fontWeight:700, fontSize:14, opacity:sending?0.7:1 }}>
                {sending ? t("⏳ Envoi en cours...","⏳ Sending...") : t("📤 Envoyer le message","📤 Send message")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LegalModal({ type, onClose }) {
  const { lang } = useLang();

  const privacyFr = `
POLITIQUE DE CONFIDENTIALITÉ — CallRDV
Dernière mise à jour : novembre 2026

1. RESPONSABLE DU TRAITEMENT
CallRDV est édité par un entrepreneur individuel.
Contact : contact@callrdv.com

2. DONNÉES COLLECTÉES
Dans le cadre de l'utilisation de CallRDV, nous collectons :
• Données d'identification : nom, adresse email
• Données professionnelles : rendez-vous, contacts clients, notes
• Données techniques : adresse IP, type de navigateur, logs de connexion

3. FINALITÉS DU TRAITEMENT
Vos données sont utilisées pour :
• Fournir le service de gestion de rendez-vous
• Envoyer les rappels automatiques par email (à vous et, si vous le choisissez, à vos clients)
• Gérer votre abonnement et vos paiements
• Améliorer le service

4. BASE LÉGALE
Le traitement de vos données est fondé sur :
• L'exécution du contrat (utilisation du service)
• Votre consentement (communications marketing)
• L'intérêt légitime (sécurité, amélioration du service)

5. DONNÉES DES CLIENTS DES PROFESSIONNELS
Les professionnels qui utilisent CallRDV peuvent enregistrer les coordonnées de leurs propres clients (nom, téléphone, email, informations du rendez-vous). Pour ces données :
• Le professionnel est responsable du traitement. CallRDV agit comme sous-traitant (article 28 du RGPD) et ne traite ces données que pour son compte, afin de faire fonctionner le service.
• Si l'email d'un client est renseigné, CallRDV lui envoie un rappel de rendez-vous 3 jours et 1 jour avant, au nom du professionnel. Ces emails ne contiennent aucune publicité.
• Ces données ne sont ni vendues, ni louées, ni utilisées à d'autres fins.
• Un client qui ne souhaite plus recevoir de rappels, ou qui veut accéder à ses données, les corriger ou les faire supprimer, peut s'adresser au professionnel (par exemple en répondant au rappel reçu) ou nous écrire via le formulaire de contact de callrdv.com.
• Le professionnel peut modifier ou supprimer ces données à tout moment depuis son compte.

6. DESTINATAIRES DES DONNÉES
Vos données peuvent être partagées avec nos prestataires techniques :
• Supabase (base de données et authentification) — données hébergées en Irlande (Union européenne)
• Stripe (paiements) — États-Unis
• Resend (envoi des emails) — États-Unis
• Vercel (hébergement du site) — États-Unis
Les transferts hors de l'Union européenne sont encadrés par des garanties appropriées (clauses contractuelles types).

7. DURÉE DE CONSERVATION
• Données de compte : jusqu'à suppression du compte + 1 an
• Données de rendez-vous : durée de l'abonnement + 1 an
• Données de paiement : 10 ans (obligation légale)

8. VOS DROITS
Conformément au RGPD, vous disposez des droits suivants :
• Droit d'accès à vos données
• Droit de rectification
• Droit à l'effacement ("droit à l'oubli")
• Droit à la portabilité
• Droit d'opposition
Pour exercer vos droits : contact@callrdv.com

9. SÉCURITÉ
Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données (chiffrement SSL, authentification sécurisée, accès restreint).

10. COOKIES
CallRDV utilise uniquement le stockage technique nécessaire au fonctionnement du service (session utilisateur, langue, préférences d'affichage). Aucun cookie publicitaire n'est utilisé.

11. MODIFICATIONS
Nous nous réservons le droit de modifier cette politique. Vous serez informé par email en cas de changement substantiel.

12. RÉCLAMATIONS
Vous pouvez introduire une réclamation auprès de la CNIL : www.cnil.fr
  `;

  const cguFr = `
CONDITIONS GÉNÉRALES D'UTILISATION — CallRDV
Dernière mise à jour : novembre 2026

1. OBJET
Les présentes CGU régissent l'utilisation du service CallRDV accessible sur callrdv.com, un outil SaaS de gestion de rendez-vous pris par téléphone.

2. ACCEPTATION
L'utilisation du service implique l'acceptation pleine et entière des présentes CGU. Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser le service.

3. DESCRIPTION DU SERVICE
CallRDV permet de :
• Créer et gérer des rendez-vous
• Gérer une base de contacts clients
• Recevoir des rappels automatiques par email
• Envoyer des rappels automatiques par email à vos clients, lorsque leur email est renseigné
• Accéder à des statistiques d'activité

4. INSCRIPTION
Pour utiliser CallRDV, vous devez créer un compte avec une adresse email valide. Vous êtes responsable de la confidentialité de vos identifiants.

5. PLANS ET TARIFS
• Gratuit : 10 RDV par mois, toutes les fonctionnalités, sans carte bancaire
• Pro : RDV illimités, 20€ par mois, sans engagement
Les prix sont susceptibles d'évoluer avec un préavis de 30 jours.

6. PAIEMENT
Les paiements sont traités par Stripe. Les abonnements sont sans engagement et résiliables à tout moment. Aucun remboursement n'est effectué pour les périodes entamées.

7. DONNÉES ET CONFIDENTIALITÉ
L'utilisation du service implique le traitement de données personnelles conformément à notre Politique de Confidentialité.

8. RESPONSABILITÉS
CallRDV s'engage à fournir le service avec un soin raisonnable. Nous ne sommes pas responsables des pertes de données dues à des cas de force majeure ou à une utilisation incorrecte.

L'utilisateur s'engage à :
• Ne pas utiliser le service à des fins illégales
• Ne pas tenter de compromettre la sécurité du service
• Respecter les droits des tiers

Données de vos clients : lorsque vous enregistrez les coordonnées de vos clients, notamment leur email pour les rappels, vous garantissez les avoir obtenues de manière légitime, avoir informé vos clients qu'ils pourront recevoir des rappels de rendez-vous par email, et respecter la réglementation applicable (RGPD). Vous restez responsable de ces données ; CallRDV les traite uniquement pour votre compte.

9. PROPRIÉTÉ INTELLECTUELLE
L'ensemble des éléments de CallRDV (code, design, marque) sont protégés par le droit de la propriété intellectuelle. Toute reproduction est interdite sans autorisation.

10. RÉSILIATION
Vous pouvez supprimer votre compte à tout moment. Nous nous réservons le droit de suspendre un compte en cas de violation des présentes CGU.

11. DROIT APPLICABLE
Les présentes CGU sont soumises au droit français. Tout litige sera soumis aux tribunaux compétents de France.

12. CONTACT
Pour toute question : contact@callrdv.com
  `;

  const privacyEn = `
PRIVACY POLICY — CallRDV
Last updated: November 2026
(English translation provided for convenience. In case of discrepancy, the French version prevails.)

1. DATA CONTROLLER
CallRDV is published by a sole trader based in France.
Contact: contact@callrdv.com

2. DATA WE COLLECT
When you use CallRDV, we collect:
• Identification data: name, email address
• Business data: appointments, client contacts, notes
• Technical data: IP address, browser type, connection logs

3. PURPOSES
Your data is used to:
• Provide the appointment management service
• Send automatic email reminders (to you and, if you choose, to your clients)
• Manage your subscription and payments
• Improve the service

4. LEGAL BASIS
Processing of your data is based on:
• Performance of the contract (use of the service)
• Your consent (marketing communications)
• Legitimate interest (security, service improvement)

5. DATA ABOUT YOUR CLIENTS
Professionals using CallRDV can store details about their own clients (name, phone, email, appointment information). For this data:
• The professional is the data controller. CallRDV acts as a processor (Article 28 GDPR) and only processes this data on the professional's behalf, to run the service.
• If a client's email is provided, CallRDV sends them an appointment reminder 3 days and 1 day before, on behalf of the professional. These emails contain no advertising.
• This data is never sold, rented or used for any other purpose.
• A client who no longer wants reminders, or who wants to access, correct or delete their data, can contact the professional (for example by replying to the reminder) or write to us through the contact form on callrdv.com.
• The professional can edit or delete this data at any time from their account.

6. RECIPIENTS
Your data may be shared with our technical providers:
• Supabase (database and authentication) — data hosted in Ireland (European Union)
• Stripe (payments) — United States
• Resend (email delivery) — United States
• Vercel (website hosting) — United States
Transfers outside the European Union are covered by appropriate safeguards (standard contractual clauses).

7. RETENTION
• Account data: until account deletion + 1 year
• Appointment data: subscription period + 1 year
• Payment data: 10 years (legal obligation)

8. YOUR RIGHTS
Under the GDPR, you have the right to:
• Access your data
• Rectify it
• Erase it ("right to be forgotten")
• Data portability
• Object to processing
To exercise your rights: contact@callrdv.com

9. SECURITY
We implement appropriate technical and organisational measures to protect your data (SSL encryption, secure authentication, restricted access).

10. COOKIES
CallRDV only uses the technical storage needed for the service to work (user session, language, display preferences). No advertising cookies are used.

11. CHANGES
We may update this policy. You will be informed by email of any substantial change.

12. COMPLAINTS
You can lodge a complaint with the French data protection authority (CNIL): www.cnil.fr
  `;

  const cguEn = `
TERMS OF USE — CallRDV
Last updated: November 2026
(English translation provided for convenience. In case of discrepancy, the French version prevails.)

1. PURPOSE
These terms govern the use of CallRDV, available at callrdv.com, a SaaS tool for managing appointments booked by phone.

2. ACCEPTANCE
Using the service means you fully accept these terms. If you do not accept them, you must not use the service.

3. THE SERVICE
CallRDV lets you:
• Create and manage appointments
• Manage a client contact list
• Receive automatic email reminders
• Send automatic email reminders to your clients when their email is provided
• View activity statistics

4. SIGN-UP
To use CallRDV you must create an account with a valid email address. You are responsible for keeping your login details confidential.

5. PLANS AND PRICING
• Free: 10 appointments per month, all features, no credit card
• Pro: unlimited appointments, €20 per month, cancel anytime
Prices may change with 30 days' notice.

6. PAYMENT
Payments are processed by Stripe. Subscriptions have no minimum term and can be cancelled at any time. No refund is given for a period already started.

7. DATA AND PRIVACY
Using the service involves processing personal data in accordance with our Privacy Policy.

8. RESPONSIBILITIES
CallRDV undertakes to provide the service with reasonable care. We are not liable for data loss caused by force majeure or incorrect use.

You agree to:
• Not use the service for illegal purposes
• Not attempt to compromise the security of the service
• Respect the rights of others

Your clients' data: when you store your clients' details, in particular their email for reminders, you confirm that you obtained them lawfully, that you have told your clients they may receive appointment reminders by email, and that you comply with applicable law (GDPR). You remain responsible for this data; CallRDV only processes it on your behalf.

9. INTELLECTUAL PROPERTY
All elements of CallRDV (code, design, brand) are protected by intellectual property law. Any reproduction without permission is prohibited.

10. TERMINATION
You can delete your account at any time. We may suspend an account that breaches these terms.

11. GOVERNING LAW
These terms are governed by French law. Any dispute will be brought before the competent courts of France.

12. CONTACT
For any question: contact@callrdv.com
  `;

  const en = lang === "en";
  const content = type === "privacy" ? (en ? privacyEn : privacyFr) : (en ? cguEn : cguFr);
  const title = type === "privacy"
    ? (en ? "Privacy Policy" : "Politique de Confidentialité")
    : (en ? "Terms of Use" : "Conditions Générales d'Utilisation");

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000060", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:680, maxHeight:"85vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:"24px 32px", borderBottom:"1px solid #e2e8f0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontWeight:800, fontSize:18, color:"#1e293b" }}>📄 {title}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#64748B" }}>✕</button>
        </div>
        <div style={{ padding:"24px 32px", overflowY:"auto", flex:1 }}>
          <pre style={{ fontFamily:"DM Sans, sans-serif", fontSize:13, color:"#475569", lineHeight:1.8, whiteSpace:"pre-wrap" }}>{content}</pre>
        </div>
        <div style={{ padding:"16px 32px", borderTop:"1px solid #e2e8f0", textAlign:"center" }}>
          <button onClick={onClose} style={{ background:"#2450E6", color:"#fff", border:"none", borderRadius:10, padding:"12px 32px", cursor:"pointer", fontWeight:700, fontSize:14 }}>
            {en ? "Close" : "Fermer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LandingPage({ onLogin, onSignup }) {
  const [legalType, setLegalType] = React.useState(null);
  const [showContact, setShowContact] = React.useState(false);
  const { t } = useLang();

  React.useEffect(() => {
    window.__showLegal = (type) => setLegalType(type);
    return () => { delete window.__showLegal; };
  }, []);

  const LP_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    .lp-body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; background: #FFFFFF; color: #0F172A; overflow-x: hidden; }
    .lp-body *, .lp-body *::before, .lp-body *::after { box-sizing: border-box; }
    .lp-wrap { max-width: 1160px; margin: 0 auto; padding: 0 24px; }
    .lp-nav { position: sticky; top: 0; z-index: 100; background: rgba(255,255,255,0.94); backdrop-filter: blur(12px); border-bottom: 1px solid #E2E8F0; }
    .lp-nav-in { display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 68px; }
    .lp-logo { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 19px; letter-spacing: -0.02em; color: #0F172A; }
    .lp-logo-ic { width: 36px; height: 36px; border-radius: 10px; background: #2450E6; display: flex; align-items: center; justify-content: center; }
    .lp-nav-right { display: flex; align-items: center; gap: 10px; }
    .lp-nav-links { display: flex; align-items: center; gap: 24px; margin-right: 8px; }
    .lp-nav-links a { text-decoration: none; color: #475569; font-size: 15px; font-weight: 600; }
    .lp-nav-links a:hover { color: #2450E6; }
    .lp-btn-nav { background: #fff; color: #0F172A; border: 1px solid #E2E8F0; padding: 10px 18px; border-radius: 12px; font: 700 14px 'Plus Jakarta Sans', sans-serif; cursor: pointer; min-height: 44px; }
    .lp-btn-nav:hover { border-color: #2450E6; color: #2450E6; }
    .lp-login-mobile { display: none; background: #fff; color: #0F172A; border: 1px solid #E2E8F0; border-radius: 12px; padding: 8px 14px; font: 700 14px 'Plus Jakarta Sans', sans-serif; cursor: pointer; min-height: 40px; }
    .lp-btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: #2450E6; color: #fff; padding: 15px 26px; border-radius: 14px; font: 800 16px 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; box-shadow: 0 8px 22px rgba(36,80,230,0.28); transition: background .2s, transform .2s; min-height: 52px; }
    .lp-btn-primary:hover { background: #1A3BB0; transform: translateY(-1px); }
    .lp-hero { background: linear-gradient(180deg, #F5F6F8 0%, #FFFFFF 100%); padding: 72px 0 64px; }
    .lp-hero-in { display: grid; grid-template-columns: minmax(0,1.1fr) minmax(0,0.9fr); gap: 48px; align-items: center; }
    .lp-badge { display: inline-flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #E2E8F0; border-radius: 999px; padding: 7px 14px; font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 22px; }
    .lp-badge i { width: 8px; height: 8px; border-radius: 50%; background: #16A34A; display: inline-block; }
    .lp-h1 { font-size: clamp(38px, 5vw, 58px); line-height: 1.08; font-weight: 800; letter-spacing: -0.035em; margin: 0 0 20px; }
    .lp-h1 span { color: #2450E6; }
    .lp-sub { font-size: 18px; color: #475569; line-height: 1.65; margin: 0 0 30px; max-width: 540px; }
    .lp-note { font-size: 14px; color: #475569; margin-top: 14px; display: flex; align-items: center; gap: 8px; }
    .lp-phone { width: 300px; margin: 0 auto; background: #0F172A; border-radius: 42px; padding: 12px; box-shadow: 0 30px 70px rgba(15,23,42,0.25); }
    .lp-screen { background: #F5F6F8; border-radius: 32px; overflow: hidden; padding: 18px 14px 16px; }
    .lp-scr-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .lp-scr-h { font-size: 19px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 2px; }
    .lp-scr-s { font-size: 11px; color: #475569; margin-bottom: 12px; }
    .lp-scr-card { background: #fff; border-radius: 16px; padding: 12px; box-shadow: 0 4px 14px rgba(15,23,42,0.06); margin-bottom: 12px; }
    .lp-scr-lab { font-size: 11px; font-weight: 800; margin-bottom: 8px; }
    .lp-scr-row { display: flex; gap: 6px; }
    .lp-scr-in { flex: 1; background: #F5F6F8; border: 1px solid #E2E8F0; border-radius: 11px; height: 38px; display: flex; align-items: center; gap: 7px; padding: 0 10px; font-size: 12px; color: #64748B; }
    .lp-scr-go { width: 38px; height: 38px; border-radius: 11px; background: #2450E6; display: flex; align-items: center; justify-content: center; }
    .lp-scr-t { font-size: 12px; font-weight: 800; margin: 4px 2px 8px; }
    .lp-scr-rdv { background: #fff; border-radius: 13px; padding: 9px; display: flex; gap: 9px; align-items: center; margin-bottom: 7px; }
    .lp-scr-d { width: 38px; text-align: center; border-radius: 9px; background: #EEF2FF; color: #2450E6; padding: 5px 0; flex-shrink: 0; }
    .lp-scr-d b { display: block; font-size: 15px; line-height: 1.1; }
    .lp-scr-d small { display: block; font-size: 9px; font-weight: 800; text-transform: uppercase; }
    .lp-scr-n { flex: 1; min-width: 0; font-size: 12px; font-weight: 700; }
    .lp-scr-n small { display: block; font-size: 10px; font-weight: 500; color: #475569; }
    .lp-pill { font-size: 10px; font-weight: 800; border-radius: 999px; padding: 3px 8px; white-space: nowrap; }
    .lp-ok { color: #15803D; background: #DCFCE7; } .lp-wait { color: #B45309; background: #FEF3C7; }
    .lp-scr-nav { display: grid; grid-template-columns: repeat(5,1fr); align-items: center; background: #fff; border-radius: 16px; margin-top: 10px; padding: 8px 4px; color: #64748B; }
    .lp-scr-nav span { display: flex; justify-content: center; }
    .lp-scr-plus { width: 36px; height: 36px; border-radius: 12px; background: #2450E6; display: flex; align-items: center; justify-content: center; margin: 0 auto; }
    .lp-facts { padding: 8px 0 56px; }
    .lp-facts-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
    .lp-fact { background: #F5F6F8; border-radius: 16px; padding: 18px; display: flex; gap: 12px; align-items: center; font-size: 14px; font-weight: 700; }
    .lp-fact-ic { width: 40px; height: 40px; border-radius: 12px; background: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .lp-section { padding: 72px 0; }
    .lp-gris { background: #F5F6F8; }
    .lp-label { font-size: 13px; font-weight: 800; color: #2450E6; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
    .lp-h2 { font-size: clamp(28px, 3.2vw, 40px); font-weight: 800; letter-spacing: -0.03em; line-height: 1.15; margin: 0 0 12px; }
    .lp-section-sub { font-size: 17px; color: #475569; line-height: 1.65; max-width: 560px; margin: 0 0 40px; }
    .lp-steps { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 18px; }
    .lp-step { background: #fff; border-radius: 20px; padding: 26px; box-shadow: 0 1px 2px rgba(15,23,42,.05), 0 8px 24px rgba(15,23,42,.05); }
    .lp-step-n { width: 38px; height: 38px; border-radius: 12px; background: #2450E6; color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
    .lp-step h3, .lp-feature h3 { font-size: 17px; font-weight: 800; margin: 0 0 8px; }
    .lp-step p, .lp-feature p { font-size: 15px; color: #475569; line-height: 1.65; margin: 0; }
    .lp-features-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 18px; }
    .lp-feature { background: #fff; border: 1px solid #E2E8F0; border-radius: 20px; padding: 26px; transition: border-color .2s, box-shadow .2s; }
    .lp-feature:hover { border-color: #2450E6; box-shadow: 0 10px 30px rgba(36,80,230,0.08); }
    .lp-feature-icon { width: 46px; height: 46px; border-radius: 14px; background: #EEF2FF; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
    .lp-price { max-width: 440px; margin: 0 auto; background: #fff; border: 2px solid #2450E6; border-radius: 24px; padding: 32px 28px; box-shadow: 0 20px 50px rgba(36,80,230,0.12); }
    .lp-price-name { font-size: 14px; font-weight: 800; color: #2450E6; text-transform: uppercase; letter-spacing: 0.08em; }
    .lp-price-amount { font-size: 56px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; margin: 12px 0 4px; }
    .lp-price-amount small { font-size: 17px; font-weight: 600; color: #475569; letter-spacing: 0; }
    .lp-price ul { list-style: none; padding: 0; margin: 22px 0 26px; display: flex; flex-direction: column; gap: 12px; }
    .lp-price li { display: flex; gap: 10px; align-items: flex-start; font-size: 15px; color: #334155; line-height: 1.45; }
    .lp-resa-in { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,0.85fr); gap: 48px; align-items: center; }
    .lp-resa-list { list-style: none; padding: 0; margin: 0 0 28px; display: flex; flex-direction: column; gap: 14px; }
    .lp-resa-list li { display: flex; gap: 12px; align-items: flex-start; font-size: 16px; color: #334155; line-height: 1.55; }
    .lp-resa-list b { color: #0F172A; }
    .lp-resa-ic { width: 32px; height: 32px; border-radius: 10px; background: #EEF2FF; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .lp-pub-head { background: #fff; border-radius: 16px; padding: 12px; display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
    .lp-pub-av { width: 36px; height: 36px; border-radius: 11px; background: #2450E6; color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; }
    .lp-pub-days { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 5px; margin-bottom: 10px; }
    .lp-pub-day { background: #fff; border: 1px solid #E2E8F0; border-radius: 10px; text-align: center; font-size: 9px; font-weight: 600; color: #475569; padding: 5px 0; line-height: 1.3; }
    .lp-pub-day b { display: block; font-size: 14px; color: #0F172A; }
    .lp-pub-day.on { background: #2450E6; border-color: #2450E6; color: #fff; } .lp-pub-day.on b { color: #fff; }
    .lp-pub-hours { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 6px; }
    .lp-pub-h { background: #fff; border: 1px solid #E2E8F0; border-radius: 10px; text-align: center; font-size: 12px; font-weight: 700; padding: 9px 0; }
    .lp-pub-h.on { background: #2450E6; border-color: #2450E6; color: #fff; }
    .lp-pub-h.off { background: transparent; border-style: dashed; color: #94A3B8; text-decoration: line-through; font-weight: 600; }
    @media(max-width:960px){ .lp-resa-in{grid-template-columns:1fr;} }
    .lp-cta { background: #2450E6; color: #fff; text-align: center; padding: 72px 0; }
    .lp-cta h2 { font-size: clamp(28px, 3.6vw, 44px); font-weight: 800; letter-spacing: -0.03em; margin: 0 0 12px; }
    .lp-cta p { font-size: 17px; color: #DBE4FF; margin: 0 0 28px; }
    .lp-cta .lp-btn-primary { background: #fff; color: #2450E6; box-shadow: 0 10px 26px rgba(0,0,0,0.18); }
    .lp-cta .lp-btn-primary:hover { background: #EEF2FF; }
    .lp-footer-in { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; padding: 28px 24px; }
    .lp-footer-links { display: flex; gap: 20px; flex-wrap: wrap; }
    .lp-footer-links a { font-size: 14px; color: #475569; text-decoration: none; font-weight: 600; }
    .lp-footer-links a:hover { color: #2450E6; }
    .lp-footer-copy { font-size: 13px; color: #475569; }
    @media(max-width:960px){ .lp-hero-in{grid-template-columns:1fr;} .lp-facts-grid{grid-template-columns:repeat(2,minmax(0,1fr));} .lp-features-grid{grid-template-columns:repeat(2,minmax(0,1fr));} }
    @media(max-width:768px){ .lp-nav-links{display:none;} .lp-login-mobile{display:inline-block;} .lp-hero{padding:44px 0 40px;} .lp-steps,.lp-features-grid{grid-template-columns:1fr;} .lp-section{padding:56px 0;} .lp-footer-in{flex-direction:column;text-align:center;} .lp-phone{width:280px;} }
  `;

  const features = t([
    { icon:"search", title:"Recherche client instantanée", desc:"Tapez le nom de votre client : sa fiche apparaît avec son numéro, son email et son historique." },
    { icon:"file", title:"Fiches adaptées à votre métier", desc:"Garage, médical, beauté, juridique… chaque type de RDV a ses propres champs." },
    { icon:"mail", title:"Rappels automatiques", desc:"Un email de rappel 3 jours et 1 jour avant chaque RDV, pour vous et pour votre client si vous avez son email. Il confirme ou annule en un clic." },
    { icon:"whatsapp", title:"WhatsApp et SMS", desc:"Envoyez un RDV à votre client par WhatsApp ou SMS en un geste, avec la date, l'heure et le lieu." },
    { icon:"chart", title:"Tableau de bord", desc:"Suivez votre activité : RDV par semaine, catégories les plus fréquentes, évolution sur 6 mois." },
    { icon:"calendar", title:"Synchronisé avec votre agenda", desc:"Vos RDV apparaissent tout seuls dans Google Agenda, Apple Calendrier ou Outlook. Vue liste, semaine ou mois, et planning en PDF." },
  ],[
    { icon:"search", title:"Instant client search", desc:"Type your client's name: their record appears with their phone number, email and history." },
    { icon:"file", title:"Forms that fit your business", desc:"Garage, medical, beauty, legal… each type of appointment has its own fields." },
    { icon:"mail", title:"Automatic reminders", desc:"An email reminder 3 days and 1 day before every appointment, for you and for your client if you have their email. They confirm or cancel in one click." },
    { icon:"whatsapp", title:"WhatsApp and text", desc:"Send an appointment to your client by WhatsApp or text in one tap, with date, time and place." },
    { icon:"chart", title:"Dashboard", desc:"Track your activity: appointments per week, top categories, 6-month trend." },
    { icon:"calendar", title:"Synced with your calendar", desc:"Your appointments show up by themselves in Google Calendar, Apple Calendar or Outlook. List, week or month view, and PDF schedule." },
  ]);
  const etapes = t([
    { title:"Un client appelle", desc:"Pendant l'appel, tapez son nom. S'il est déjà venu, sa fiche s'ouvre toute seule." },
    { title:"Touchez le jour et l'heure", desc:"Pas de calendrier à faire défiler : deux gestes et le RDV est enregistré." },
    { title:"Votre client est prévenu", desc:"Il reçoit une confirmation par email, puis des rappels. Il confirme ou annule en un clic." },
  ],[
    { title:"A client calls", desc:"During the call, type their name. If they've been before, their record opens by itself." },
    { title:"Tap the day and time", desc:"No calendar to scroll through: two taps and the appointment is saved." },
    { title:"Your client is kept informed", desc:"They get a confirmation email, then reminders. They confirm or cancel in one click." },
  ]);
  const faits = t([["clock","Réservation en ligne 24h/24"],["mail","Rappels automatiques par email"],["calendar","Synchronisé avec votre agenda"],["pin","Données hébergées en Europe"]],[["clock","Online booking 24/7"],["mail","Automatic email reminders"],["calendar","Synced with your calendar"],["pin","Data hosted in Europe"]]);
  const jour = (n) => { const d = new Date(); d.setDate(d.getDate()+n); return { j: d.toLocaleDateString(t("fr-FR","en-GB"), { weekday:"short" }).replace(".",""), n: d.getDate() }; };

  return (
    <div className="lp-body">
      {legalType && <LegalModal type={legalType} onClose={()=>setLegalType(null)} />}
      {showContact && <ContactModal onClose={()=>setShowContact(false)} />}
      <style>{LP_CSS}</style>

      {/* NAV */}
      <nav className="lp-nav">
        <div className="lp-wrap lp-nav-in">
          <div className="lp-logo"><span className="lp-logo-ic"><Icon name="phone" size={18} color="#fff" /></span>CallRDV</div>
          <div className="lp-nav-right">
            <div className="lp-nav-links">
              <a href="#lp-comment">{t("Comment ça marche","How it works")}</a>
              <a href="#lp-resa">{t("Réservation en ligne","Online booking")}</a>
              <a href="#lp-features">{t("Fonctionnalités","Features")}</a>
              <a href="#lp-pricing">{t("Tarif","Pricing")}</a>
              <button className="lp-btn-nav" onClick={onLogin}>{t("Se connecter","Log in")}</button>
            </div>
            <button className="lp-login-mobile" onClick={onLogin}>{t("Connexion","Log in")}</button>
            <LangSwitch />
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-wrap lp-hero-in">
          <div>
            <div className="lp-badge"><i></i>{t("Nouveau : réservation en ligne","New: online booking")}</div>
            <h1 className="lp-h1">{t(<>Un appel devient un <span>rendez-vous</span> en quelques secondes</>, <>A phone call becomes an <span>appointment</span> in seconds</>)}</h1>
            <p className="lp-sub">{t("Pour les garages, coiffeurs, artisans et tous les pros qui prennent leurs RDV par téléphone. Avec votre page de réservation, vos clients peuvent aussi réserver seuls, 24h/24. Tout arrive au même endroit, avec confirmation et rappels automatiques.","For garages, hairdressers, tradespeople and every business that books by phone. With your booking page, clients can also book on their own, 24/7. Everything lands in one place, with automatic confirmation and reminders.")}</p>
            <button className="lp-btn-primary" onClick={onSignup}>{t("Commencer gratuitement →","Start for free →")}</button>
            <div className="lp-note"><Icon name="check" size={16} color="#16A34A" stroke={2.6} />{t("10 RDV gratuits par mois · sans carte bancaire","10 free appointments a month · no credit card")}</div>
          </div>

          {/* Aperçu de l'appli */}
          <div aria-hidden="true">
            <div className="lp-phone">
              <div className="lp-screen">
                <div className="lp-scr-top">
                  <span style={{ display:"flex", alignItems:"center", gap:7, fontWeight:800, fontSize:14 }}><span className="lp-logo-ic" style={{ width:26, height:26, borderRadius:8 }}><Icon name="phone" size={13} color="#fff" /></span>CallRDV</span>
                  <span style={{ fontSize:10, fontWeight:700, color:"#475569", background:"#fff", border:"1px solid #E2E8F0", borderRadius:999, padding:"4px 8px" }}>{t("7 RDV restants","7 left")}</span>
                </div>
                <div className="lp-scr-h">{t("Bonjour Mehdi","Hello Mike")}</div>
                <div className="lp-scr-s">{t("3 RDV à venir","3 upcoming appointments")}</div>
                <div className="lp-scr-card">
                  <div className="lp-scr-lab">{t("Nouveau rendez-vous","New appointment")}</div>
                  <div className="lp-scr-row"><div className="lp-scr-in"><Icon name="search" size={14} color="#64748B" />{t("Nom du client…","Client's name…")}</div><div className="lp-scr-go"><Icon name="arrow" size={16} color="#fff" stroke={2.4} /></div></div>
                </div>
                <div className="lp-scr-t">{t("Prochains rendez-vous","Upcoming appointments")}</div>
                {[[0,t("M. Leroy","Tom Baker"),t("09:00 · Pneus hiver","09:00 · Winter tyres"),true],[2,t("Mme Durand","Sarah Miller"),t("14:30 · Révision","14:30 · Car service"),false],[3,t("Karim B.","James Lee"),t("16:30 · Vidange","16:30 · Oil change"),true]].map(([n,nom,detail,okk]) => { const d = jour(n); return (
                  <div key={nom} className="lp-scr-rdv">
                    <div className="lp-scr-d"><small>{d.j}</small><b>{d.n}</b></div>
                    <div className="lp-scr-n">{nom}<small>{detail}</small></div>
                    <span className={`lp-pill ${okk ? "lp-ok" : "lp-wait"}`}>{okk ? t("Confirmé","Confirmed") : t("En attente","Pending")}</span>
                  </div>
                ); })}
                <div className="lp-scr-nav">
                  <span style={{ color:"#2450E6" }}><Icon name="home" size={18} /></span><span><Icon name="calendar" size={18} /></span>
                  <span className="lp-scr-plus"><Icon name="plus" size={18} color="#fff" stroke={2.6} /></span>
                  <span><Icon name="users" size={18} /></span><span><Icon name="settings" size={18} /></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* POINTS CLÉS */}
      <section className="lp-facts">
        <div className="lp-wrap lp-facts-grid">
          {faits.map(([ic, txt]) => (
            <div key={txt} className="lp-fact"><span className="lp-fact-ic"><Icon name={ic} size={20} color="#2450E6" /></span>{txt}</div>
          ))}
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="lp-section lp-gris" id="lp-comment">
        <div className="lp-wrap">
          <div className="lp-label">{t("Comment ça marche","How it works")}</div>
          <h2 className="lp-h2">{t("Trois étapes, pendant l'appel","Three steps, during the call")}</h2>
          <p className="lp-section-sub">{t("Pas de formation : si vous savez envoyer un SMS, vous savez utiliser CallRDV.","No training needed: if you can send a text, you can use CallRDV.")}</p>
          <div className="lp-steps">
            {etapes.map((e, i) => (
              <div key={e.title} className="lp-step"><div className="lp-step-n">{i+1}</div><h3>{e.title}</h3><p>{e.desc}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* RÉSERVATION EN LIGNE */}
      <section className="lp-section" id="lp-resa">
        <div className="lp-wrap lp-resa-in">
          <div>
            <div className="lp-label">{t("Réservation en ligne","Online booking")}</div>
            <h2 className="lp-h2">{t("Vos clients réservent seuls, même quand vous ne décrochez pas","Clients book on their own, even when you can't pick up")}</h2>
            <p className="lp-section-sub" style={{ marginBottom:26 }}>{t("Vous avez votre page de réservation. Le client choisit sa prestation et un créneau libre, il reçoit sa confirmation par email. Le RDV arrive directement dans votre agenda, à côté de ceux pris par téléphone.","You get your own booking page. The client picks a service and a free slot, and gets a confirmation email. The appointment lands straight in your calendar, next to the ones taken by phone.")}</p>
            <ul className="lp-resa-list">
              {t([
                ["share", <><b>Votre lien à partager</b> : WhatsApp, Google, Instagram, ou un QR code en vitrine.</>],
                ["clock", <><b>Vos prestations et vos horaires</b> : vous fixez la durée, les jours, la pause du midi.</>],
                ["check", <><b>Jamais deux clients sur le même créneau</b>, même s'ils réservent en même temps.</>],
                ["users", <><b>Confirmation automatique</b>, ou vous validez vous-même chaque demande.</>],
              ],[
                ["share", <><b>Your link to share</b>: WhatsApp, Google, Instagram, or a QR code in your window.</>],
                ["clock", <><b>Your services and opening hours</b>: you set the length, the days, the lunch break.</>],
                ["check", <><b>Never two clients on the same slot</b>, even if they book at the same time.</>],
                ["users", <><b>Automatic confirmation</b>, or you approve each request yourself.</>],
              ]).map(([ic, txt], i) => (
                <li key={i}><span className="lp-resa-ic"><Icon name={ic} size={17} color="#2450E6" /></span><span>{txt}</span></li>
              ))}
            </ul>
            <button className="lp-btn-primary" onClick={onSignup}>{t("Créer ma page gratuitement →","Create my page for free →")}</button>
          </div>
          {/* Aperçu de la page que voit le client */}
          <div aria-hidden="true">
            <div className="lp-phone">
              <div className="lp-screen">
                <div className="lp-pub-head">
                  <span className="lp-pub-av">G</span>
                  <span style={{ minWidth:0 }}><span style={{ display:"block", fontWeight:800, fontSize:14 }}>{t("Garage Mehdi","Mike's Garage")}</span><span style={{ fontSize:10, color:"#475569" }}>{t("Révision voiture · 1 h","Car service · 1 h")}</span></span>
                </div>
                <div style={{ fontSize:10, fontWeight:800, color:"#2450E6", textTransform:"uppercase", letterSpacing:"0.06em", margin:"4px 2px 4px" }}>{t("Étape 2 sur 3","Step 2 of 3")}</div>
                <div style={{ fontSize:17, fontWeight:800, letterSpacing:"-0.02em", margin:"0 2px 10px" }}>{t("Choisissez un créneau","Choose a time")}</div>
                <div className="lp-pub-days">
                  {[1,2,3,4,5,6].filter(n => { const d = new Date(); d.setDate(d.getDate()+n); return d.getDay() !== 0; }).slice(0,4).map((n, i) => { const d = jour(n); return <div key={n} className={`lp-pub-day ${i===1?"on":""}`}>{d.j}<b>{d.n}</b></div>; })}
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:"#475569", margin:"0 2px 6px" }}>{t("Matin","Morning")}</div>
                <div className="lp-pub-hours" style={{ marginBottom:10 }}>
                  <div className="lp-pub-h">09:00</div><div className="lp-pub-h off">10:00</div><div className="lp-pub-h">11:00</div>
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:"#475569", margin:"0 2px 6px" }}>{t("Après-midi","Afternoon")}</div>
                <div className="lp-pub-hours">
                  <div className="lp-pub-h on">14:00</div><div className="lp-pub-h">15:00</div><div className="lp-pub-h off">16:00</div>
                  <div className="lp-pub-h">17:00</div>
                </div>
                <div style={{ background:"#fff", borderRadius:13, padding:"10px 12px", marginTop:14, display:"flex", alignItems:"center", gap:8, fontSize:11, color:"#475569" }}>
                  <span style={{ width:22, height:22, borderRadius:"50%", background:"#16A34A", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Icon name="check" size={13} color="#fff" stroke={3} /></span>
                  {t("Confirmation envoyée par email","Confirmation sent by email")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* FONCTIONNALITÉS */}
      <section className="lp-section" id="lp-features">
        <div className="lp-wrap">
          <div className="lp-label">{t("Fonctionnalités","Features")}</div>
          <h2 className="lp-h2">{t("Tout ce qu'il faut pour gérer vos RDV","Everything you need to manage your appointments")}</h2>
          <p className="lp-section-sub">{t("Une appli pensée pour aller vite, sur téléphone comme sur ordinateur.","An app built for speed, on your phone and on your computer.")}</p>
          <div className="lp-features-grid">
            {features.map(({icon,title,desc})=>(
              <div key={title} className="lp-feature">
                <div className="lp-feature-icon"><Icon name={icon} size={22} color="#2450E6" /></div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TARIF */}
      <section className="lp-section lp-gris" id="lp-pricing">
        <div className="lp-wrap">
          <div style={{ textAlign:"center" }}>
            <div className="lp-label">{t("Tarif","Pricing")}</div>
            <h2 className="lp-h2">{t("Un seul prix, tout inclus","One price, everything included")}</h2>
            <p className="lp-section-sub" style={{ margin:"0 auto 36px" }}>{t("Essayez gratuitement avant de vous abonner.","Try it for free before subscribing.")}</p>
          </div>
          <div className="lp-price">
            <div className="lp-price-name">CallRDV Pro</div>
            <div className="lp-price-amount">20€ <small>{t("/ mois","/ month")}</small></div>
            <div style={{ fontSize:14, color:"#475569" }}>{t("Sans engagement","Cancel anytime")}</div>
            <ul>
              {t(["RDV illimités, par téléphone et en ligne","Page de réservation en ligne avec votre lien et QR code","Rappels email à vous et à vos clients","Confirmation ou annulation en un clic par le client","Fiches clients et import des contacts du téléphone","Synchronisation Google Agenda, Apple Calendrier, Outlook"],["Unlimited appointments, by phone and online","Online booking page with your own link and QR code","Email reminders for you and your clients","One-click confirmation or cancellation by the client","Client profiles and phone contacts import","Sync with Google Calendar, Apple Calendar, Outlook"]).map(x => (
                <li key={x}><Icon name="check" size={18} color="#16A34A" stroke={2.6} style={{ marginTop:1 }} />{x}</li>
              ))}
            </ul>
            <button className="lp-btn-primary" style={{ width:"100%" }} onClick={onSignup}>{t("Commencer gratuitement →","Start for free →")}</button>
            <div style={{ fontSize:14, color:"#475569", textAlign:"center", marginTop:12 }}>{t("10 RDV offerts chaque mois pour essayer, sans carte bancaire.","10 free appointments every month to try it, no credit card.")}</div>
          </div>
        </div>
      </section>

      {/* APPEL À L'ACTION */}
      <section className="lp-cta">
        <div className="lp-wrap">
          <h2>{t("Prêt à ne plus rien oublier ?","Ready to stop forgetting appointments?")}</h2>
          <p>{t("Créez votre compte en une minute. Gratuit pour commencer.","Create your account in a minute. Free to start.")}</p>
          <button className="lp-btn-primary" onClick={onSignup}>{t("Créer mon compte gratuitement →","Create my free account →")}</button>
        </div>
      </section>

      {/* PIED DE PAGE */}
      <footer>
        <div className="lp-wrap lp-footer-in">
          <div className="lp-logo" style={{ fontSize:17 }}><span className="lp-logo-ic" style={{ width:30, height:30, borderRadius:9 }}><Icon name="phone" size={15} color="#fff" /></span>CallRDV</div>
          <div className="lp-footer-links">
            <a href="#privacy" onClick={(e)=>{e.preventDefault();window.__showLegal("privacy");}}>{t("Confidentialité","Privacy")}</a>
            <a href="#cgu" onClick={(e)=>{e.preventDefault();window.__showLegal("cgu");}}>{t("CGU","Terms")}</a>
            <a href="#contact" onClick={(e)=>{e.preventDefault();setShowContact(true);}}>{t("Contact","Contact")}</a>
          </div>
          <div className="lp-footer-copy">{t("© 2026 CallRDV · Données hébergées en Europe","© 2026 CallRDV · Data hosted in Europe")}</div>
        </div>
      </footer>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────
// ── Push Notification Helper ─────────────────────────────────
function sendPushNotif(title, body) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  new Notification(title, { body, icon: "/icon-192.png" });
}

// ── Page publique : le client confirme ou annule depuis le lien de son email de rappel ──
// ── Guide de première connexion : 4 bulles qui montrent l'essentiel ──
function GuideBienvenue({ onFin, onCreer }) {
  const [etape, setEtape] = useState(0);
  const [rect, setRect] = useState(null);
  const [vw, setVw] = useState(window.innerWidth);
  const tel = vw < 700;
  const etapes = [
    { cible: "#carte-recherche", titre: tr("Un client vous appelle ?","A client is calling?"), texte: tr("Tapez son nom ici pendant l'appel. Si vous le connaissez déjà, sa fiche s'ouvre avec son numéro et son email.","Type their name here during the call. If you already know them, their record opens with their phone number and email.") },
    { cible: tel ? "#bn-plus" : "#btn-nouveau-pc", titre: tr("Créez un RDV à tout moment","Create an appointment anytime"), texte: tr("Ce bouton ouvre directement un nouveau rendez-vous, depuis n'importe quel écran.","This button opens a new appointment straight away, from any screen.") },
    { cible: tel ? "#bn-agenda" : "#onglet-agenda", titre: tr("Vos clients sont prévenus","Your clients are kept informed"), texte: tr("S'il a un email, votre client reçoit une confirmation, puis un rappel 3 jours et 1 jour avant. Dans Mes RDV, le statut passe à « Confirmé » quand il répond.","If they have an email, your client gets a confirmation, then a reminder 3 days and 1 day before. In Appointments, the status switches to \"Confirmed\" when they reply.") },
    { cible: null, titre: tr("C'est parti !","You're all set!"), texte: tr("Vous avez 10 RDV gratuits par mois. Créez votre premier rendez-vous en 30 secondes.","You have 10 free appointments a month. Create your first one in 30 seconds.") },
  ];
  const e = etapes[etape];
  const dernier = etape === etapes.length - 1;

  useEffect(() => {
    const mesurer = () => {
      setVw(window.innerWidth);
      const el = e.cible ? document.querySelector(e.cible) : null;
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) { el.scrollIntoView({ block: "center" }); }
      const r2 = el.getBoundingClientRect();
      setRect({ top: r2.top, left: r2.left, width: r2.width, height: r2.height });
    };
    mesurer();
    const t = setTimeout(mesurer, 120);
    window.addEventListener("resize", mesurer);
    return () => { clearTimeout(t); window.removeEventListener("resize", mesurer); };
  }, [etape, e.cible]);

  useEffect(() => {
    const echap = (ev) => { if (ev.key === "Escape") onFin(); };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [onFin]);

  const marge = 8;
  const largeurBulle = Math.min(380, window.innerWidth - 32);
  let bulle = { left: (window.innerWidth - largeurBulle) / 2, top: Math.max(24, window.innerHeight / 2 - 140) };
  if (rect) {
    const enHaut = rect.top + rect.height / 2 < window.innerHeight / 2;
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - largeurBulle / 2), window.innerWidth - largeurBulle - 16);
    bulle = enHaut ? { left, top: rect.top + rect.height + marge + 14 } : { left, bottom: window.innerHeight - rect.top + marge + 14 };
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:500 }}>
      {rect ? (
        <div aria-hidden="true" style={{ position:"fixed", top:rect.top - marge, left:rect.left - marge, width:rect.width + marge*2, height:rect.height + marge*2, borderRadius:20, boxShadow:"0 0 0 9999px rgba(15,23,42,.62)", border:"3px solid #fff", transition:"all .3s ease", pointerEvents:"none" }} />
      ) : (
        <div aria-hidden="true" style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.62)" }} />
      )}
      <div role="dialog" aria-modal="true" aria-labelledby="guide-titre" style={{ position:"fixed", width:largeurBulle, ...bulle, background:"#fff", borderRadius:20, padding:20, boxShadow:"0 20px 50px rgba(15,23,42,.3)", display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:12, fontWeight:800, color:"var(--accent)", textTransform:"uppercase", letterSpacing:"0.06em" }}>{tr(`Étape ${etape+1} sur ${etapes.length}`, `Step ${etape+1} of ${etapes.length}`)}</span>
          <button onClick={onFin} style={{ border:"none", background:"none", fontSize:13, fontWeight:700, color:"var(--text2)", cursor:"pointer", padding:"8px 4px", minHeight:44 }}>{tr("Passer le guide","Skip the tour")}</button>
        </div>
        <h2 id="guide-titre" style={{ fontSize:19, fontWeight:800, letterSpacing:"-0.01em" }}>{e.titre}</h2>
        <p style={{ fontSize:14, lineHeight:1.55, color:"#334155" }}>{e.texte}</p>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:6, gap:10 }}>
          <div style={{ display:"flex", gap:6 }} aria-hidden="true">
            {etapes.map((_, k) => <span key={k} style={{ width: k===etape ? 22 : 8, height:8, borderRadius:999, background: k===etape ? "var(--accent)" : "#CBD5E1", transition:"all .2s" }} />)}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {etape > 0 && <button onClick={()=>setEtape(etape-1)} className="btn btn-outline btn-sm" style={{ minHeight:46 }}>{tr("Retour","Back")}</button>}
            {dernier
              ? <button autoFocus onClick={onCreer} className="btn btn-primary" style={{ minHeight:46, padding:"0 16px", whiteSpace:"nowrap" }}>{tr("Créer mon 1er RDV","Create my first one")}</button>
              : <button autoFocus onClick={()=>setEtape(etape+1)} className="btn btn-primary" style={{ minHeight:46, padding:"0 22px" }}>{tr("Suivant","Next")}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Réservation en ligne ─────────────────────────────────────
// Listes de départ par métier (le pro les modifie comme il veut)
const PRESTATIONS_DEPART = {
  medical:     [["Consultation","Consultation",20],["Première consultation","First consultation",30],["Renouvellement d'ordonnance","Prescription renewal",15]],
  dentiste:    [["Contrôle","Check-up",30],["Détartrage","Scale and polish",30],["Soin dentaire","Dental treatment",45]],
  kine:        [["Séance","Session",30],["Bilan","Assessment",45],["Séance d'ostéopathie","Osteopathy session",45]],
  veterinaire: [["Consultation","Consultation",20],["Vaccination","Vaccination",15],["Contrôle après opération","Post-surgery check",20]],
  garage:      [["Révision voiture","Car service",60],["Changement pneus","Tyre change",45],["Diagnostic","Diagnostic",30],["Vidange","Oil change",30]],
  travaux:     [["Devis à domicile","Home quote",60],["Intervention","Job",120],["Dépannage","Repair call-out",60]],
  juridique:   [["Premier rendez-vous","First meeting",60],["Consultation","Consultation",30],["Signature","Signing",60]],
  banque:      [["Rendez-vous conseiller","Adviser meeting",45],["Ouverture de compte","Account opening",30],["Bilan assurance","Insurance review",60]],
  beaute:      [["Coupe femme","Women's haircut",45],["Coupe homme","Men's haircut",30],["Barbe","Beard trim",15],["Couleur","Colour",90],["Brushing","Blow-dry",30]],
  restaurant:  [["Réservation de table","Table booking",90]],
  formation:   [["Rendez-vous parents","Parent meeting",20],["Cours particulier","Private lesson",60]],
  pro:         [["Rendez-vous","Meeting",30],["Réunion","Long meeting",60]],
  perso:       [["Rendez-vous","Appointment",30]],
  autre:       [["Rendez-vous","Appointment",30],["Rendez-vous long","Long appointment",60]],
};
const prestationsDepart = (metier) => (PRESTATIONS_DEPART[metier] || PRESTATIONS_DEPART.autre)
  .map(([fr, en, duree], i) => ({ id: `p${i + 1}`, nom: tr(fr, en), duree }));
// Lundi → vendredi 9h-12h et 14h-18h, samedi matin, fermé le dimanche (0 = dimanche)
const HORAIRES_DEPART = { "1":[["09:00","12:00"],["14:00","18:00"]], "2":[["09:00","12:00"],["14:00","18:00"]], "3":[["09:00","12:00"],["14:00","18:00"]], "4":[["09:00","12:00"],["14:00","18:00"]], "5":[["09:00","12:00"],["14:00","18:00"]], "6":[["09:00","12:00"]], "0":[] };
const slugDepuis = (txt) => String(txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
const SLUG_OK = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const lienReservation = (slug) => `https://callrdv.com/${slug}`;
// Mots réservés : ne peuvent pas servir de lien (pages ou fichiers du site, futurs usages)
const SLUGS_RESERVES = ["api","app","admin","login","connexion","inscription","signup","reglages","settings","aide","help","contact","tarifs","pricing","cgu","cgv","mentions-legales","confidentialite","privacy","static","build","public","index","manifest","service-worker","callrdv","r","rdv"];
const dureeTxt = (m) => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
const appelReservation = (corps) => fetch(`${CONFIG.SUPABASE_URL}/functions/v1/reservation`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "apikey": CONFIG.SUPABASE_ANON_KEY },
  body: JSON.stringify(corps),
}).then(async r => ({ status: r.status, data: await r.json().catch(() => ({})) }));

// Réglages de la page de réservation (ouverts depuis Réglages)
function ReglagesReservation({ user, onSave, onClose }) {
  const s = user.booking_settings || {};
  const [actif, setActif] = useState(!!user.booking_enabled);
  const [slug, setSlug] = useState(user.booking_slug || slugDepuis(user.name) || slugDepuis((user.email || "").split("@")[0]));
  const [nom, setNom] = useState(s.nom || user.name || "");
  const [adresse, setAdresse] = useState(s.adresse || "");
  const [tel, setTel] = useState(s.tel || "");
  const [prestations, setPrestations] = useState(Array.isArray(s.prestations) && s.prestations.length ? s.prestations : prestationsDepart(user.metier));
  const [horaires, setHoraires] = useState(s.horaires && typeof s.horaires === "object" ? s.horaires : HORAIRES_DEPART);
  const [delai, setDelai] = useState(s.delai_h ?? 2);
  const [joursMax, setJoursMax] = useState(s.jours_max ?? 30);
  const [validation, setValidation] = useState(!!s.validation);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [copie, setCopie] = useState(false);

  const jours = [["1",tr("Lundi","Monday")],["2",tr("Mardi","Tuesday")],["3",tr("Mercredi","Wednesday")],["4",tr("Jeudi","Thursday")],["5",tr("Vendredi","Friday")],["6",tr("Samedi","Saturday")],["0",tr("Dimanche","Sunday")]];
  const majPlage = (j, i, k, v) => setHoraires(h => ({ ...h, [j]: (h[j] || []).map((p, n) => n === i ? (k === 0 ? [v, p[1]] : [p[0], v]) : p) }));
  const lien = lienReservation(slug);
  const dejaEnregistre = user.booking_enabled && user.booking_slug === slug;

  const enregistrer = async () => {
    setErreur("");
    if (SLUGS_RESERVES.includes(slug)) { setErreur(tr("Ce lien est réservé par CallRDV. Choisissez-en un autre (par exemple votre nom ou celui de votre activité).","This link is reserved by CallRDV. Please choose another one (for example your name or your business name).")); return; }
    if (!SLUG_OK.test(slug)) { setErreur(tr("Le lien doit faire 3 à 40 caractères : lettres sans accent, chiffres et tirets.","The link must be 3 to 40 characters: letters, numbers and hyphens.")); return; }
    const liste = prestations.map(p => ({ ...p, nom: (p.nom || "").trim() })).filter(p => p.nom);
    if (actif && liste.length === 0) { setErreur(tr("Ajoutez au moins une prestation.","Add at least one service.")); return; }
    for (const [j] of jours) for (const p of horaires[j] || []) if (!p[0] || !p[1] || p[0] >= p[1]) { setErreur(tr("Une plage horaire est incomplète ou finit avant de commencer.","A time range is incomplete or ends before it starts.")); return; }
    if (actif && !jours.some(([j]) => (horaires[j] || []).length)) { setErreur(tr("Ouvrez au moins un jour.","Open at least one day.")); return; }
    const data = {
      booking_enabled: actif,
      booking_slug: slug,
      booking_settings: { nom: nom.trim(), adresse: adresse.trim(), tel: tel.trim(), prestations: liste, horaires, pas: 30, delai_h: Number(delai), jours_max: Number(joursMax), validation, tz: "Europe/Paris" },
    };
    setEnvoi(true);
    try {
      const r = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
        method: "PATCH",
        headers: { ...sb.headers(user.token), "Prefer": "return=minimal" },
        body: JSON.stringify(data),
      });
      if (r.status === 409) { setErreur(tr("Ce lien est déjà pris par un autre professionnel. Choisissez-en un autre.","This link is already taken. Please choose another one.")); setEnvoi(false); return; }
      if (!r.ok) throw new Error(String(r.status));
      onSave(data);
      onClose();
    } catch { setErreur(tr("L'enregistrement n'a pas marché. Réessayez.","Saving failed. Please try again.")); }
    setEnvoi(false);
  };

  const copier = async () => {
    try { await navigator.clipboard.writeText(lien); setCopie(true); setTimeout(() => setCopie(false), 2500); }
    catch { window.prompt(tr("Copiez ce lien :","Copy this link:"), lien); }
  };
  const bloc = { marginBottom:18, padding:16, borderRadius:14, background:"#F8FAFC", border:"1px solid var(--border)" };
  const btnPetit = { display:"flex", alignItems:"center", justifyContent:"center", gap:8, minHeight:44, borderRadius:12, border:"1px solid var(--border)", background:"#fff", fontSize:13, fontWeight:700, color:"var(--text)", textDecoration:"none", cursor:"pointer", padding:"0 10px" };
  const interrupteur = (valeur, change, label) => (
    <button type="button" role="switch" aria-checked={valeur} onClick={() => change(!valeur)} style={{ display:"flex", alignItems:"center", gap:12, width:"100%", background:"none", border:"none", padding:0, cursor:"pointer", textAlign:"left", font:"inherit", color:"var(--text)" }}>
      <span style={{ flex:1, fontSize:14, fontWeight:700 }}>{label}</span>
      <span style={{ width:44, height:26, borderRadius:13, background:valeur ? "var(--accent)" : "#CBD5E1", position:"relative", flexShrink:0, transition:"background .2s" }}>
        <span style={{ position:"absolute", top:3, left:valeur ? 21 : 3, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,.2)" }} />
      </span>
    </button>
  );

  return (
    <div className="sheet-fond" onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.5)", zIndex:260, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div className="card fade-up sheet" role="dialog" aria-label={tr("Réservation en ligne","Online booking")} onClick={e => e.stopPropagation()} style={{ width:"100%", maxWidth:520, padding:24, maxHeight:"92vh", overflowY:"auto" }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:6 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:20, letterSpacing:"-0.01em" }}>{tr("Réservation en ligne","Online booking")}</div>
            <div style={{ fontSize:13, color:"var(--text2)", lineHeight:1.5, marginTop:4 }}>{tr("Vos clients réservent seuls, 24h/24, sur votre page. Vous continuez aussi à prendre des RDV par téléphone : tout arrive dans Mes RDV.","Your clients book on their own, 24/7, on your page. You keep taking phone bookings too: everything lands in your appointments.")}</div>
          </div>
          <button onClick={onClose} aria-label={tr("Fermer","Close")} style={{ width:40, height:40, borderRadius:12, background:"#F1F5F9", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text)", flexShrink:0 }}><Icon name="x" size={18} /></button>
        </div>

        <div style={{ ...bloc, marginTop:14, background: actif ? "var(--accent-soft)" : "#F8FAFC" }}>
          {interrupteur(actif, setActif, tr("Activer ma page de réservation","Turn on my booking page"))}
        </div>

        <div style={bloc}>
          <label htmlFor="resa-slug" className="field-label" style={{ display:"block" }}>{tr("Mon lien","My link")}</label>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:13, color:"var(--text2)", whiteSpace:"nowrap" }}>callrdv.com/</span>
            <input id="resa-slug" value={slug} onChange={e => setSlug(slugDepuis(e.target.value))} placeholder="garage-mehdi" style={{ flex:1, minWidth:0 }} />
          </div>
          {dejaEnregistre ? (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0,1fr))", gap:8, marginTop:12 }}>
                <button type="button" onClick={copier} style={btnPetit}>{copie ? tr("Copié ✓","Copied ✓") : tr("Copier","Copy")}</button>
                <a href={`https://wa.me/?text=${encodeURIComponent(tr("Réservez votre rendez-vous en ligne : ","Book your appointment online: ") + lien)}`} target="_blank" rel="noopener noreferrer" style={{ ...btnPetit, background:"#F0FDF4", borderColor:"#BBF7D0", color:"#14532D" }}>WhatsApp</a>
                <a href={lien} target="_blank" rel="noopener noreferrer" style={btnPetit}>{tr("Voir","Open")}</a>
              </div>
              <details style={{ marginTop:10 }}>
                <summary style={{ cursor:"pointer", fontSize:13, fontWeight:700, color:"var(--text2)", padding:"6px 0" }}>{tr("QR code à imprimer (vitrine, comptoir)","QR code to print (shop window, counter)")}</summary>
                <div style={{ textAlign:"center", paddingTop:8 }}>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(lien)}`} width="200" height="200" alt={tr("QR code de ma page de réservation","QR code for my booking page")} style={{ borderRadius:12, background:"#fff" }} />
                  <div style={{ fontSize:12, color:"var(--text2)", marginTop:6 }}>{tr("Appui long sur l'image pour l'enregistrer.","Long-press the image to save it.")}</div>
                </div>
              </details>
            </>
          ) : (
            <div style={{ fontSize:12, color:"var(--text2)", marginTop:8, lineHeight:1.5 }}>{tr("Enregistrez pour obtenir le lien à partager (WhatsApp, Google, réseaux, QR code).","Save to get the link to share (WhatsApp, Google, social media, QR code).")}</div>
          )}
        </div>

        <div style={bloc}>
          <div className="field-label">{tr("Ce que voient vos clients","What your clients see")}</div>
          <input value={nom} onChange={e => setNom(e.target.value)} placeholder={tr("Nom de votre activité (ex : Garage Mehdi)","Business name (e.g. Mehdi's Garage)")} aria-label={tr("Nom affiché","Display name")} style={{ marginBottom:8 }} />
          <input value={adresse} onChange={e => setAdresse(e.target.value)} placeholder={tr("Adresse (facultatif)","Address (optional)")} aria-label={tr("Adresse","Address")} style={{ marginBottom:8 }} />
          <input type="tel" value={tel} onChange={e => setTel(e.target.value)} placeholder={tr("Téléphone à afficher (facultatif)","Phone to display (optional)")} aria-label={tr("Téléphone","Phone")} />
        </div>

        <div style={bloc}>
          <div className="field-label">{tr("Prestations proposées","Services offered")}</div>
          <div style={{ fontSize:12, color:"var(--text2)", marginBottom:10, lineHeight:1.5 }}>{tr("Liste de départ selon votre métier : modifiez, supprimez ou ajoutez.","Starter list for your business: edit, remove or add.")}</div>
          {prestations.map((p, i) => (
            <div key={p.id} style={{ display:"flex", gap:6, marginBottom:8, alignItems:"center" }}>
              <input value={p.nom} onChange={e => setPrestations(l => l.map((x, n) => n === i ? { ...x, nom: e.target.value } : x))} aria-label={tr("Nom de la prestation","Service name")} style={{ flex:1, minWidth:0 }} />
              <select value={p.duree} onChange={e => setPrestations(l => l.map((x, n) => n === i ? { ...x, duree: Number(e.target.value) } : x))} aria-label={tr("Durée","Duration")} style={{ width:112, flexShrink:0, paddingRight:28 }}>
                {[...new Set([10,15,20,30,45,60,90,120,180,240, p.duree])].sort((a,b)=>a-b).map(m => <option key={m} value={m}>{dureeTxt(m)}</option>)}
              </select>
              <button type="button" onClick={() => setPrestations(l => l.filter((_, n) => n !== i))} aria-label={tr("Supprimer","Remove")} style={{ width:40, height:40, borderRadius:10, border:"1px solid #FECACA", background:"#FEF2F2", color:"#B91C1C", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Icon name="trash" size={16} /></button>
            </div>
          ))}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button type="button" onClick={() => setPrestations(l => [...l, { id: `p${Date.now()}`, nom: "", duree: 30 }])} style={btnPetit}><Icon name="plus" size={16} /> {tr("Ajouter","Add")}</button>
            <button type="button" onClick={() => { if (window.confirm(tr("Remplacer votre liste par la liste de départ ?","Replace your list with the starter list?"))) setPrestations(prestationsDepart(user.metier)); }} style={{ ...btnPetit, color:"var(--text2)" }}>{tr("Liste de départ","Starter list")}</button>
          </div>
        </div>

        <div style={bloc}>
          <div className="field-label">{tr("Horaires d'ouverture","Opening hours")}</div>
          {jours.map(([j, label]) => {
            const plages = horaires[j] || [];
            return (
              <div key={j} style={{ padding:"8px 0", borderBottom:"1px solid #EEF2F7" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ flex:1, fontSize:14, fontWeight:700 }}>{label}</span>
                  <button type="button" onClick={() => setHoraires(h => ({ ...h, [j]: plages.length ? [] : [["09:00","12:00"],["14:00","18:00"]] }))} style={{ fontSize:13, fontWeight:700, border:"none", background:"none", cursor:"pointer", color: plages.length ? "#B91C1C" : "var(--accent)", padding:"6px 0" }}>
                    {plages.length ? tr("Fermer ce jour","Close this day") : tr("Ouvrir","Open")}
                  </button>
                </div>
                {plages.length === 0 && <div style={{ fontSize:13, color:"var(--text2)" }}>{tr("Fermé","Closed")}</div>}
                {plages.map((p, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginTop:6 }}>
                    <input type="time" step="900" value={p[0]} onChange={e => majPlage(j, i, 0, e.target.value)} aria-label={tr(`${label}, début`,`${label}, start`)} style={{ flex:1, minWidth:0 }} />
                    <span style={{ color:"var(--text2)" }}>→</span>
                    <input type="time" step="900" value={p[1]} onChange={e => majPlage(j, i, 1, e.target.value)} aria-label={tr(`${label}, fin`,`${label}, end`)} style={{ flex:1, minWidth:0 }} />
                    {plages.length > 1 && <button type="button" onClick={() => setHoraires(h => ({ ...h, [j]: plages.filter((_, n) => n !== i) }))} aria-label={tr("Retirer cette plage","Remove this range")} style={{ width:36, height:36, borderRadius:10, border:"1px solid var(--border)", background:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, color:"var(--text2)" }}><Icon name="x" size={14} /></button>}
                  </div>
                ))}
                {plages.length === 1 && <button type="button" onClick={() => setHoraires(h => ({ ...h, [j]: [[plages[0][0], "12:00"], ["14:00", plages[0][1] > "14:00" ? plages[0][1] : "18:00"]] }))} style={{ fontSize:12, fontWeight:700, border:"none", background:"none", cursor:"pointer", color:"var(--accent)", padding:"6px 0 0" }}>{tr("+ Pause du midi","+ Lunch break")}</button>}
              </div>
            );
          })}
        </div>

        <div style={bloc}>
          <label htmlFor="resa-delai" className="field-label" style={{ display:"block" }}>{tr("Réserver au plus tard","Latest booking")}</label>
          <select id="resa-delai" value={delai} onChange={e => setDelai(e.target.value)} style={{ marginBottom:12 }}>
            {[[0,tr("Jusqu'à la dernière minute","Up to the last minute")],[1,tr("1 h avant","1 h before")],[2,tr("2 h avant","2 h before")],[4,tr("4 h avant","4 h before")],[12,tr("12 h avant","12 h before")],[24,tr("La veille (24 h avant)","The day before (24 h)")],[48,tr("2 jours avant","2 days before")]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label htmlFor="resa-max" className="field-label" style={{ display:"block" }}>{tr("Réserver jusqu'à","Book up to")}</label>
          <select id="resa-max" value={joursMax} onChange={e => setJoursMax(e.target.value)} style={{ marginBottom:14 }}>
            {[7,14,30,60,90].map(v => <option key={v} value={v}>{tr(`${v} jours à l'avance`,`${v} days ahead`)}</option>)}
          </select>
          {interrupteur(validation, setValidation, tr("Je valide moi-même chaque réservation","I approve each booking myself"))}
          <div style={{ fontSize:12, color:"var(--text2)", marginTop:6, lineHeight:1.5 }}>
            {validation
              ? tr("Le client reçoit « demande reçue ». Le créneau est bloqué jusqu'à ce que vous acceptiez ou refusiez dans Mes RDV.","The client gets “request received”. The slot is held until you accept or decline in your appointments.")
              : tr("Le RDV est confirmé tout de suite : le client et vous recevez un email.","The appointment is confirmed straight away: you and the client get an email.")}
          </div>
        </div>

        {(user.plan || "free") === "free" && <div style={{ fontSize:12, color:"var(--text2)", marginBottom:14, lineHeight:1.5 }}>{tr("Les réservations en ligne comptent dans vos 10 RDV gratuits du mois. Une fois la limite atteinte, votre page affiche votre numéro de téléphone à la place.","Online bookings count toward your 10 free appointments a month. Once the limit is reached, your page shows your phone number instead.")}</div>}
        {erreur && <div role="alert" style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"#B91C1C", borderRadius:12, padding:"10px 14px", fontSize:13, fontWeight:600, marginBottom:12 }}>{erreur}</div>}
        <div style={{ display:"flex", gap:10 }}>
          <button className="btn btn-outline" onClick={onClose} style={{ flex:1 }}>{tr("Annuler","Cancel")}</button>
          <button id="resa-enregistrer" className="btn btn-primary" onClick={enregistrer} disabled={envoi} style={{ flex:2 }}>{envoi ? <span className="spinner"></span> : tr("Enregistrer","Save")}</button>
        </div>
      </div>
    </div>
  );
}

// Page publique : callrdv.com/<lien> (ancien format callrdv.com/?r=<lien> toujours accepté)
function ReservationPage({ slug }) {
  const [page, setPage] = useState(null);
  const [etat, setEtat] = useState("chargement"); // chargement | introuvable | erreur | pret
  const [etape, setEtape] = useState(1);
  const [prestation, setPrestation] = useState(null);
  const [jours, setJours] = useState(null);
  const [jour, setJour] = useState("");
  const [heure, setHeure] = useState("");
  const [form, setForm] = useState({ nom:"", tel:"", email:"", message:"", site:"" });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [fini, setFini] = useState(null);

  useEffect(() => {
    appelReservation({ slug, action: "page" }).then(({ status, data }) => {
      if (status === 200 && data.prestations) { setPage(data); setEtat("pret"); try { document.title = `${data.nom || "CallRDV"} – ${tr("Réserver","Book")}`; } catch {} }
      else setEtat(status === 404 ? "introuvable" : "erreur");
    }).catch(() => setEtat("erreur"));
  }, [slug]);

  const chargerCreneaux = async (p) => {
    setJours(null); setHeure("");
    const { status, data } = await appelReservation({ slug, action: "creneaux", prestation: p.id }).catch(() => ({ status: 0, data: {} }));
    if (status !== 200 || !Array.isArray(data.jours)) { setErreur(tr("Impossible de charger les créneaux. Réessayez.","Could not load the time slots. Please try again.")); setJours([]); return; }
    setJours(data.jours);
    setJour(j => data.jours.find(x => x.date === j && x.heures.length)?.date || data.jours.find(x => x.heures.length)?.date || "");
  };
  const choisirPrestation = (p) => { setPrestation(p); setErreur(""); setEtape(2); chargerCreneaux(p); window.scrollTo(0, 0); };

  const reserver = async (e) => {
    e.preventDefault();
    setErreur("");
    if (form.nom.trim().length < 2) { setErreur(tr("Indiquez votre nom.","Please enter your name.")); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setErreur(tr("Votre email ne semble pas correct.","Your email does not look right.")); return; }
    setEnvoi(true);
    const { status, data } = await appelReservation({ slug, action: "reserver", prestation: prestation.id, date: jour, heure, ...form }).catch(() => ({ status: 0, data: {} }));
    setEnvoi(false);
    if (status === 200 && data.ok) { setFini(data); setEtape(4); window.scrollTo(0, 0); return; }
    const msg = {
      pris: tr("Ce créneau vient d'être pris. Choisissez-en un autre.","This slot was just taken. Please choose another one."),
      trop: tr("Vous avez déjà fait plusieurs réservations aujourd'hui. Pour en faire une autre, appelez directement.","You have already made several bookings today. To make another one, please call directly."),
      complet: tr("La réservation en ligne est momentanément indisponible. Appelez directement.","Online booking is temporarily unavailable. Please call directly."),
      ferme: tr("La réservation en ligne est fermée pour le moment.","Online booking is closed for now."),
      email: tr("Votre email ne semble pas correct.","Your email does not look right."),
      tel: tr("Votre numéro de téléphone ne semble pas correct.","Your phone number does not look right."),
      nom: tr("Indiquez votre nom.","Please enter your name."),
    }[data.error] || tr("La réservation n'a pas pu aboutir. Réessayez.","The booking could not be completed. Please try again.");
    setErreur(msg);
    if (data.error === "pris") { setEtape(2); chargerCreneaux(prestation); }
  };

  const telechargerIcs = () => {
    const r = fini.rdv;
    const [h, m] = r.heure.split(":").map(Number);
    const debut = new Date(`${r.date}T${r.heure}:00`);
    const finRdv = new Date(debut.getTime() + (r.duree || 30) * 60000);
    const loc = (d) => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}00`;
    const e = (v) => String(v||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n");
    const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//CallRDV//callrdv.com//FR","BEGIN:VEVENT", `UID:${r.date}-${h}${m}-${slug}@callrdv.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d+/g,"")}`,
      `DTSTART:${loc(debut)}`, `DTEND:${loc(finRdv)}`, `SUMMARY:${e(`${r.prestation} · ${r.nom}`)}`, ...(r.adresse ? [`LOCATION:${e(r.adresse)}`] : []), "END:VEVENT","END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type:"text/calendar;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "rendez-vous.ics"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const dateLongue = (iso) => { const d = new Date(iso + "T12:00:00"); const t = d.toLocaleDateString(locale(), { weekday:"long", day:"numeric", month:"long" }); return t.charAt(0).toUpperCase() + t.slice(1); };
  const telLien = page?.tel ? `tel:${page.tel.replace(/[^\d+]/g, "")}` : "";
  const carte = { background:"#fff", borderRadius:16, padding:16 };
  const titreEtape = (n, txt) => (<>
    <div style={{ fontSize:12, fontWeight:800, color:"var(--accent)", textTransform:"uppercase", letterSpacing:"0.06em" }}>{tr(`Étape ${n} sur 3`,`Step ${n} of 3`)}</div>
    <h2 style={{ margin:"4px 0 12px", fontSize:22, fontWeight:800, letterSpacing:"-0.02em" }}>{txt}</h2>
  </>);
  const retour = (vers) => <button onClick={() => { setErreur(""); setEtape(vers); }} aria-label={tr("Retour","Back")} style={{ width:40, height:40, borderRadius:12, border:"1px solid var(--border)", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"var(--text)", flexShrink:0 }}><Icon name="back" size={18} /></button>;

  const enTete = page && (etape === 1 || etape === 4 ? (
    <header style={{ background:"#fff", padding:"22px 20px 18px", borderBottom:"1px solid var(--border)", display:"flex", gap:14, alignItems:"center" }}>
      <div style={{ width:52, height:52, borderRadius:16, background:"var(--accent)", color:"#fff", fontSize:22, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{(page.nom || "?").trim().charAt(0).toUpperCase()}</div>
      <div style={{ minWidth:0 }}>
        <h1 style={{ margin:0, fontSize:20, fontWeight:800, letterSpacing:"-0.02em" }}>{page.nom || tr("Prise de rendez-vous","Book an appointment")}</h1>
        {page.adresse && <div style={{ fontSize:13, color:"var(--text2)" }}>{page.adresse}</div>}
      </div>
    </header>
  ) : (
    <header style={{ background:"#fff", padding:"16px 20px", borderBottom:"1px solid var(--border)", display:"flex", gap:12, alignItems:"center" }}>
      {retour(etape - 1)}
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:16, fontWeight:800 }}>{page.nom}</div>
        <div style={{ fontSize:13, color:"var(--text2)" }}>{prestation?.nom} · {etape === 3 && jour ? `${new Date(jour + "T12:00:00").toLocaleDateString(locale(), { weekday:"short", day:"numeric", month:"short" })} ${tr("à","at")} ${heure}` : dureeTxt(prestation?.duree || 30)}</div>
      </div>
    </header>
  ));

  const jourChoisi = jours?.find(j => j.date === jour);
  const matin = (jourChoisi?.heures || []).filter(h => h < "12:00");
  const aprem = (jourChoisi?.heures || []).filter(h => h >= "12:00");
  const grilleHeures = (liste) => (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0,1fr))", gap:8 }}>
      {liste.map(h => <button key={h} onClick={() => { setHeure(h); setErreur(""); setEtape(3); window.scrollTo(0, 0); }} style={{ height:46, borderRadius:12, border:"1px solid var(--border)", background:"#fff", fontWeight:700, fontSize:15, cursor:"pointer", color:"var(--text)" }}>{h}</button>)}
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <div style={{ minHeight:"100vh", background:"#F5F6F8", display:"flex", justifyContent:"center" }}>
        <div style={{ width:"100%", maxWidth:520, display:"flex", flexDirection:"column", minHeight:"100vh" }}>
          {etat === "chargement" && <div style={{ padding:60, textAlign:"center", color:"var(--text2)" }}>{tr("Chargement…","Loading…")}</div>}
          {(etat === "introuvable" || etat === "erreur") && (
            <div style={{ padding:"64px 20px", textAlign:"center" }}>
              <div style={{ fontWeight:800, fontSize:20, marginBottom:8 }}>{etat === "introuvable" ? tr("Page introuvable","Page not found") : tr("Une erreur est survenue","Something went wrong")}</div>
              <div style={{ fontSize:14, color:"var(--text2)", lineHeight:1.6 }}>{etat === "introuvable" ? tr("Ce lien de réservation n'existe pas ou n'est plus actif. Contactez directement votre professionnel.","This booking link does not exist or is no longer active. Please contact your professional directly.") : tr("Réessayez dans quelques instants.","Please try again in a moment.")}</div>
            </div>
          )}
          {etat === "pret" && (<>
            {enTete}
            <main style={{ flex:1, padding:20, display:"flex", flexDirection:"column", gap:12 }}>
              {erreur && <div role="alert" style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"#B91C1C", borderRadius:12, padding:"12px 14px", fontSize:14, fontWeight:600 }}>{erreur}</div>}

              {etape === 1 && (page.complet ? (
                <div style={{ ...carte, fontSize:15, lineHeight:1.6 }}>
                  {tr("La réservation en ligne est momentanément indisponible.","Online booking is temporarily unavailable.")}
                  {page.tel && <> {tr("Appelez-nous :","Please call us:")} <a href={telLien} style={{ fontWeight:800, textDecoration:"none" }}>{page.tel}</a></>}
                </div>
              ) : (<>
                {titreEtape(1, tr("Que souhaitez-vous réserver ?","What would you like to book?"))}
                {page.prestations.map(p => (
                  <button key={p.id} onClick={() => choisirPrestation(p)} style={{ ...carte, display:"flex", alignItems:"center", gap:12, border:"1px solid transparent", cursor:"pointer", textAlign:"left", font:"inherit", color:"var(--text)", width:"100%" }}>
                    <span style={{ flex:1 }}><span style={{ display:"block", fontSize:16, fontWeight:800 }}>{p.nom}</span><span style={{ fontSize:13, color:"var(--text2)" }}>{dureeTxt(p.duree)}</span></span>
                    <span style={{ transform:"scaleX(-1)", display:"flex", color:"var(--text2)" }}><Icon name="back" size={20} /></span>
                  </button>
                ))}
                {page.validation && <div style={{ fontSize:13, color:"var(--text2)", lineHeight:1.5 }}>{tr("Votre demande sera confirmée par email après validation.","Your request will be confirmed by email once approved.")}</div>}
                {page.tel && <div style={{ ...carte, marginTop:6, fontSize:14, color:"var(--text2)" }}>{tr("Vous préférez appeler ?","Prefer to call?")} <a href={telLien} style={{ fontWeight:800, textDecoration:"none" }}>{page.tel}</a></div>}
              </>))}

              {etape === 2 && (<>
                {titreEtape(2, tr("Choisissez un créneau","Choose a time"))}
                {jours === null && <div style={{ color:"var(--text2)", padding:"20px 0" }}>{tr("Recherche des créneaux libres…","Looking for free slots…")}</div>}
                {jours && !jours.some(j => j.heures.length) && (
                  <div style={{ ...carte, fontSize:14, lineHeight:1.6 }}>{tr("Plus aucun créneau libre pour le moment.","No free slots for now.")}{page.tel && <> {tr("Appelez :","Call:")} <a href={telLien} style={{ fontWeight:800, textDecoration:"none" }}>{page.tel}</a></>}</div>
                )}
                {jours && jours.some(j => j.heures.length) && (<>
                  <div role="listbox" aria-label={tr("Jour","Day")} style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
                    {jours.filter(j => j.heures.length).map(j => {
                      const d = new Date(j.date + "T12:00:00"); const on = j.date === jour;
                      return (
                        <button key={j.date} role="option" aria-selected={on} onClick={() => setJour(j.date)} style={{ minWidth:62, height:66, borderRadius:12, border: on ? "none" : "1px solid var(--border)", background: on ? "var(--accent)" : "#fff", color: on ? "#fff" : "var(--text2)", fontSize:11, fontWeight:600, cursor:"pointer", flexShrink:0, lineHeight:1.3 }}>
                          {d.toLocaleDateString(locale(), { weekday:"short" })}<br />
                          <span style={{ fontSize:18, fontWeight:800, color: on ? "#fff" : "var(--text)" }}>{d.getDate()}</span><br />
                          {d.toLocaleDateString(locale(), { month:"short" })}
                        </button>
                      );
                    })}
                  </div>
                  {jourChoisi && <div style={{ fontSize:14, fontWeight:800, marginTop:6 }}>{dateLongue(jour)}</div>}
                  {matin.length > 0 && (<><div style={{ fontSize:13, fontWeight:700, color:"var(--text2)" }}>{tr("Matin","Morning")}</div>{grilleHeures(matin)}</>)}
                  {aprem.length > 0 && (<><div style={{ fontSize:13, fontWeight:700, color:"var(--text2)", marginTop:4 }}>{tr("Après-midi","Afternoon")}</div>{grilleHeures(aprem)}</>)}
                </>)}
              </>)}

              {etape === 3 && (
                <form onSubmit={reserver} style={{ display:"flex", flexDirection:"column", gap:12 }} noValidate>
                  {titreEtape(3, tr("Vos coordonnées","Your details"))}
                  <div><label htmlFor="r-nom" className="field-label" style={{ display:"block" }}>{tr("Nom et prénom","Full name")}</label>
                    <input id="r-nom" autoComplete="name" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} required maxLength={80} /></div>
                  <div><label htmlFor="r-tel" className="field-label" style={{ display:"block" }}>{tr("Téléphone","Phone")}</label>
                    <input id="r-tel" type="tel" autoComplete="tel" value={form.tel} onChange={e => setForm(f => ({ ...f, tel: e.target.value }))} maxLength={30} /></div>
                  <div><label htmlFor="r-email" className="field-label" style={{ display:"block" }}>Email</label>
                    <input id="r-email" type="email" autoComplete="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required maxLength={120} />
                    <div style={{ fontSize:12, color:"var(--text2)", marginTop:6 }}>{tr("Pour recevoir la confirmation et les rappels.","To get the confirmation and reminders.")}</div></div>
                  <div><label htmlFor="r-msg" className="field-label" style={{ display:"block" }}>{tr("Un mot (facultatif)","A note (optional)")}</label>
                    <input id="r-msg" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} maxLength={300} /></div>
                  {/* Champ piège invisible pour les robots */}
                  <div aria-hidden="true" style={{ position:"absolute", left:"-9999px", width:1, height:1, overflow:"hidden" }}>
                    <label htmlFor="r-site">Site</label><input id="r-site" tabIndex={-1} autoComplete="off" value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))} />
                  </div>
                  <button id="r-confirmer" type="submit" className="btn btn-primary" disabled={envoi} style={{ height:54, fontSize:16, marginTop:4 }}>{envoi ? <span className="spinner"></span> : page.validation ? tr("Envoyer ma demande","Send my request") : tr("Confirmer ma réservation","Confirm my booking")}</button>
                  <div style={{ fontSize:12, color:"var(--text2)", textAlign:"center", lineHeight:1.5 }}>{tr(`Vos coordonnées sont transmises uniquement à ${page.nom || "ce professionnel"}.`,`Your details are only shared with ${page.nom || "this professional"}.`)}</div>
                </form>
              )}

              {etape === 4 && fini && (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14, textAlign:"center", paddingTop:20 }}>
                  <div style={{ width:72, height:72, borderRadius:"50%", background: fini.statut === "a_valider" ? "#F59E0B" : "#16A34A", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name={fini.statut === "a_valider" ? "clock" : "check"} size={34} color="#fff" stroke={2.8} /></div>
                  <h2 style={{ margin:0, fontSize:26, fontWeight:800, letterSpacing:"-0.02em" }}>{fini.statut === "a_valider" ? tr("Demande envoyée","Request sent") : tr("C'est réservé !","You're booked!")}</h2>
                  <p style={{ margin:0, fontSize:15, color:"var(--text2)", lineHeight:1.6, maxWidth:340 }}>
                    {fini.statut === "a_valider"
                      ? tr(`${page.nom || "Le professionnel"} va valider votre demande. Vous recevrez un email à ${form.email.trim()}.`,`${page.nom || "The professional"} will approve your request. You will get an email at ${form.email.trim()}.`)
                      : fini.email_envoye ? tr(`Un email de confirmation vient de partir à ${form.email.trim()}.`,`A confirmation email has been sent to ${form.email.trim()}.`) : tr("Votre rendez-vous est enregistré.","Your appointment is booked.")}
                  </p>
                  <section style={{ ...carte, width:"100%", textAlign:"left", display:"flex", flexDirection:"column", gap:10 }}>
                    <div style={{ fontSize:16, fontWeight:800 }}>{fini.rdv.prestation}</div>
                    <div style={{ display:"flex", gap:10, alignItems:"center", fontSize:14 }}><Icon name="calendar" size={18} color="var(--text2)" />{dateLongue(fini.rdv.date)} {tr("à","at")} {fini.rdv.heure}</div>
                    {fini.rdv.adresse && <div style={{ display:"flex", gap:10, alignItems:"center", fontSize:14 }}><Icon name="pin" size={18} color="var(--text2)" />{fini.rdv.adresse}</div>}
                  </section>
                  <div style={{ width:"100%", display:"grid", gridTemplateColumns:"repeat(2, minmax(0,1fr))", gap:8 }}>
                    <button onClick={telechargerIcs} className="btn btn-outline" style={{ height:48 }}>{tr("Ajouter au calendrier","Add to calendar")}</button>
                    <a href={fini.lien} className="btn btn-outline" style={{ height:48, color:"#B91C1C", borderColor:"#FECACA", background:"#FEF2F2", textDecoration:"none", display:"flex", alignItems:"center", justifyContent:"center" }}>{tr("Annuler","Cancel")}</a>
                  </div>
                  {fini.statut !== "a_valider" && <p style={{ margin:0, fontSize:13, color:"var(--text2)" }}>{tr("Vous recevrez un rappel par email avant le rendez-vous.","You will get an email reminder before the appointment.")}</p>}
                </div>
              )}
            </main>
          </>)}
          <footer style={{ padding:"14px 20px 22px", textAlign:"center", fontSize:12, color:"var(--text2)" }}>{tr("Réservation avec","Booking by")} <a href="https://callrdv.com" style={{ color:"var(--text2)" }}>CallRDV</a></footer>
        </div>
      </div>
    </>
  );
}

function ReponseRdvPage({ id, t }) {
  const [rdv, setRdv] = useState(null);
  const [etat, setEtat] = useState("chargement"); // chargement | pret | introuvable | erreur | confirme | annule | demande_annulation
  const [envoi, setEnvoi] = useState(false);
  const lg = rdv?.lang || CURRENT_LANG;
  const L = (fr, en) => lg === "en" ? en : fr;
  const appel = (action) => fetch(`${CONFIG.SUPABASE_URL}/functions/v1/reponse-rdv`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": CONFIG.SUPABASE_ANON_KEY },
    body: JSON.stringify(action ? { id, t, action } : { id, t }),
  }).then(async r => ({ status: r.status, data: await r.json().catch(() => ({})) }));

  useEffect(() => {
    appel().then(({ status, data }) => {
      if (status === 200 && data.rdv) { setRdv(data.rdv); setEtat("pret"); }
      else setEtat(status === 404 ? "introuvable" : "erreur");
    }).catch(() => setEtat("erreur"));
  }, []);

  const repondre = async (action) => {
    setEnvoi(true);
    try {
      const { status, data } = await appel(action);
      if (data.rdv) setRdv(data.rdv);
      if (status === 200) setEtat(action);
      else if (data.error === "deja_annule" || data.error === "passe" || data.error === "a_valider") setEtat("pret");
      else setEtat("erreur");
    } catch { setEtat("erreur"); }
    setEnvoi(false);
  };

  let dateTxt = "";
  if (rdv?.date) {
    const d = new Date(rdv.date + "T12:00:00");
    dateTxt = isNaN(d.getTime()) ? rdv.date : d.toLocaleDateString(lg === "en" ? "en-GB" : "fr-FR", { weekday:"long", day:"numeric", month:"long" });
    dateTxt = dateTxt.charAt(0).toUpperCase() + dateTxt.slice(1) + (rdv.heure ? L(" à ", " at ") + rdv.heure : "");
  }
  const btn = (bg, color, border) => ({ width:"100%", padding:"14px", borderRadius:10, border:`1px solid ${border}`, background:bg, color, fontSize:15, fontWeight:700, cursor:envoi?"wait":"pointer", opacity:envoi?.6:1, marginTop:10 });
  const msg = (icone, titre, texte, couleur) => (
    <div style={{ textAlign:"center", padding:"10px 0" }}>
      <div style={{ fontSize:40, marginBottom:10 }}>{icone}</div>
      <div style={{ fontWeight:800, fontSize:18, color:couleur||"#1e293b", marginBottom:8 }}>{titre}</div>
      {texte && <div style={{ fontSize:14, color:"#64748b", lineHeight:1.6 }}>{texte}</div>}
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#F5F6F8", display:"flex", alignItems:"center", justifyContent:"center", padding:16, fontFamily:"system-ui, -apple-system, sans-serif" }}>
      <div style={{ background:"#fff", borderRadius:16, padding:"28px 22px", width:"100%", maxWidth:420, boxShadow:"0 8px 30px rgba(15,35,64,.08)" }}>
        <div style={{ fontWeight:800, color:"#2450E6", fontSize:16, marginBottom:20 }}>📞 CallRDV</div>
        {etat === "chargement" && msg("⏳", L("Chargement…","Loading…"))}
        {etat === "introuvable" && msg("🔍", L("Lien non valide","Invalid link"), L("Ce rendez-vous n'existe plus ou le lien est incomplet. Contactez directement votre professionnel.","This appointment no longer exists or the link is incomplete. Please contact your professional directly."))}
        {etat === "erreur" && msg("⚠️", L("Une erreur est survenue","Something went wrong"), L("Réessayez dans quelques instants, ou contactez directement votre professionnel.","Please try again in a moment, or contact your professional directly."))}
        {rdv && etat !== "chargement" && etat !== "introuvable" && etat !== "erreur" && (
          <>
            <div style={{ background:"#f8fafc", borderRadius:12, padding:"16px", marginBottom:18, fontSize:14, color:"#334155", lineHeight:1.8 }}>
              <div style={{ fontWeight:800, fontSize:16, color:"#1e293b", marginBottom:4 }}>{rdv.titre || L("Rendez-vous","Appointment")}</div>
              {rdv.pro && <div>🏢 {rdv.pro}</div>}
              <div>📅 {dateTxt}</div>
              {rdv.lieu && <div>📍 {rdv.lieu}</div>}
              {rdv.personne && <div>👤 {rdv.personne}</div>}
            </div>
            {etat === "confirme" && msg("✅", L("Merci, votre RDV est confirmé","Thank you, your appointment is confirmed"), L("Votre professionnel voit votre confirmation.","Your professional can see your confirmation."), "#16a34a")}
            {etat === "annule" && msg("❌", L("Votre RDV est annulé","Your appointment is cancelled"), L("Votre professionnel a été prévenu.","Your professional has been notified."), "#ef4444")}
            {etat === "demande_annulation" && (
              <div>
                <div style={{ fontWeight:700, fontSize:15, color:"#1e293b", textAlign:"center", marginBottom:6 }}>{L("Vous êtes sûr de vouloir annuler ?","Are you sure you want to cancel?")}</div>
                <button disabled={envoi} onClick={()=>repondre("annule")} style={btn("#ef4444","#fff","#ef4444")}>{L("Oui, j'annule mon RDV","Yes, cancel my appointment")}</button>
                <button disabled={envoi} onClick={()=>setEtat("pret")} style={btn("#fff","#475569","#e2e8f0")}>{L("Non, retour","No, go back")}</button>
              </div>
            )}
            {etat === "pret" && (rdv.passe
              ? msg("🕐", L("Ce rendez-vous est passé","This appointment has passed"), L("Il n'est plus possible de le confirmer ou de l'annuler.","It can no longer be confirmed or cancelled."))
              : rdv.statut === "annule"
              ? msg("❌", L("Ce rendez-vous est annulé","This appointment is cancelled"), L("Pour reprendre rendez-vous, contactez directement votre professionnel.","To book again, please contact your professional directly."), "#ef4444")
              : (
                <div>
                  {rdv.statut === "confirme" && <div style={{ textAlign:"center", color:"#16a34a", fontWeight:700, fontSize:14, marginBottom:6 }}>{L("✅ Votre RDV est confirmé","✅ Your appointment is confirmed")}</div>}
                  {rdv.statut === "a_valider" && <div style={{ textAlign:"center", color:"#B45309", fontWeight:700, fontSize:14, marginBottom:6, lineHeight:1.5 }}>{L("⏳ Demande en attente de validation. Vous recevrez un email.","⏳ Request waiting for approval. You will get an email.")}</div>}
                  {rdv.statut !== "confirme" && rdv.statut !== "a_valider" && <button disabled={envoi} onClick={()=>repondre("confirme")} style={btn("#16a34a","#fff","#16a34a")}>{L("✅ Je confirme ma venue","✅ I'll be there")}</button>}
                  <button disabled={envoi} onClick={()=>setEtat("demande_annulation")} style={btn("#fff","#ef4444","#fecaca")}>{L("❌ J'annule mon RDV","❌ Cancel my appointment")}</button>
                </div>
              ))}
          </>
        )}
        <div style={{ marginTop:22, fontSize:11, color:"#64748B", textAlign:"center" }}>CallRDV — callrdv.com</div>
      </div>
    </div>
  );
}

export default function App() {
  const auth = useAuth();
  const { user, loading, signIn, signUp, signOut, updateUser, loginWithToken } = auth;
  const { lang } = useLang();
  const [recoveryToken, setRecoveryToken] = useState(null);
  const token = user?.token;

  const [phase, setPhase]         = useState("idle");   // idle | calling | form | agenda
  const [appointments, setAppts]  = useState([]);
  const [calRdv, setCalRdv]       = useState(null);
  const [showAgenda, setShowAgenda] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [patients, setPatients] = useState([]);
  const [showPatients, setShowPatients] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [showMetierSetup, setShowMetierSetup] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  const [editingRdv, setEditingRdv] = useState(null);
  const [stripeSuccess, setStripeSuccess] = useState(() => window.location.search.includes("success=1"));
  const [showPricing, setPrice]   = useState(false);
  const [saved, setSaved]         = useState(false);
  const [recordTime, setRecTime]  = useState(0);
  const timerRef = useRef(null);
  // Page publique de réservation : callrdv.com/<lien>, ou l'ancien format callrdv.com/?r=<lien>
  const [lienResa] = useState(() => {
    const r = (new URLSearchParams(window.location.search).get("r") || "").trim().toLowerCase();
    if (SLUG_OK.test(r)) return r;
    const chemin = decodeURIComponent(window.location.pathname.replace(/^\/+|\/+$/g, "")).toLowerCase();
    return SLUG_OK.test(chemin) && !SLUGS_RESERVES.includes(chemin) ? chemin : null;
  });
  const [showResa, setShowResa] = useState(false);
  // Lien « Confirmer ou annuler mon RDV » reçu par le client dans son email de rappel
  const [reponseLien] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    return q.get("rdv") && q.get("t") ? { id: q.get("rdv"), t: q.get("t") } : null;
  });

  useEffect(() => {
    if (phase === "calling") { timerRef.current = setInterval(() => setRecTime(t=>t+1), 1000); }
    else { clearInterval(timerRef.current); setRecTime(0); }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const plan = PLANS[user?.plan || "free"];
  const canAdd = user && (plan.quota === Infinity || (user.usage||0) < plan.quota);

  // Retour d'un lien (Google, LinkedIn, confirmation d'email, mot de passe oublié)
  useEffect(() => {
    sb.getSessionFromUrl().then(async (s) => {
      if (!s) return;
      if (s.error) {
        alert(s.errorCode === "otp_expired"
          ? tr("Ce lien a expiré ou a déjà été utilisé. Refaites « Mot de passe oublié » pour en recevoir un nouveau.","This link has expired or was already used. Use “Forgot password” again to get a new one.")
          : tr("Ce lien n'est plus valide. Réessayez depuis la page de connexion.","This link is no longer valid. Please try again from the login page."));
        return;
      }
      setShowLanding(false);
      const ok = await loginWithToken(s.token, s.refresh_token);
      if (ok && s.type === "recovery") setRecoveryToken(s.token);
    });
  }, []);

  // Guide de première connexion (une fois par appareil, peut être revu depuis les Réglages)
  const [guide, setGuide] = useState(false);
  const guideLance = useRef(false);
  const guideVu = () => { try { return localStorage.getItem("callrdv_guide_vu") === "1"; } catch { return true; } };
  const finirGuide = () => { try { localStorage.setItem("callrdv_guide_vu", "1"); } catch {} setGuide(false); };

  // Navigation entre les écrans principaux
  const ongletActif = showAgenda ? "agenda" : showPatients ? "patients" : showStats ? "stats" : "home";
  const allerA = (tab) => {
    setShowAgenda(tab === "agenda"); setShowPatients(tab === "patients"); setShowStats(tab === "stats");
    window.scrollTo(0, 0);
  };

  // Petit message en bas de l'écran (ex : « Email envoyé au client »)
  const [toast, setToast] = useState("");
  const montrerToast = (txt) => { setToast(txt); setTimeout(() => setToast(""), 5000); };

  // Email au client : RDV enregistré ("nouveau") ou déplacé ("deplace")
  const notifierClient = async (id, type) => {
    try {
      const r = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/notifier-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": CONFIG.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ id, type }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.sent) montrerToast(type === "nouveau"
        ? tr(`📧 Email de confirmation envoyé à ${j.to}`, `📧 Confirmation email sent to ${j.to}`)
        : type === "annule"
        ? tr(`📧 ${j.to} a été prévenu de l'annulation`, `📧 ${j.to} has been told about the cancellation`)
        : tr(`📧 ${j.to} a été prévenu du changement`, `📧 ${j.to} has been told about the change`));
      else if (j.reason === "envoi" || !r.ok) montrerToast(tr("⚠️ L'email au client n'a pas pu partir. Le RDV est bien enregistré.","⚠️ The email to your client could not be sent. The appointment is saved."));
    } catch { /* l'email n'est pas indispensable : le RDV est enregistré */ }
  };

  // Ouvre « Nouveau rendez-vous » depuis n'importe quel écran (le formulaire s'affiche sur l'Accueil)
  const ouvrirFormulaire = (patient) => {
    if (!canAdd) { setPrice(true); return; }
    setShowAgenda(false); setShowPatients(false); setShowStats(false);
    window.__prefillNom = patient?.nom || "";
    window.__prefillPatient = patient || null;
    setPhase("form");
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    if (guideLance.current || !user || showMetierSetup || recoveryToken || stripeSuccess) return;
    if (phase !== "idle" || showAgenda || showPatients || showStats || guideVu()) return;
    // petit délai : laisse la fenêtre "métier" s'afficher d'abord si c'est un nouveau compte
    const t = setTimeout(() => { guideLance.current = true; setGuide(true); }, 900);
    return () => clearTimeout(t);
  }, [user, showMetierSetup, recoveryToken, stripeSuccess, phase, showAgenda, showPatients, showStats]);

  const handleDeleteRdv = async (id) => {
    if (!window.confirm(tr("Supprimer ce rendez-vous ?","Delete this appointment?"))) return;
    await sb.deleteAppointment(token, id);
    setAppts(prev => prev.filter(r => r.id !== id));
  };

  // Quand le pro annule un RDV à venir : proposer d'envoyer un email au client
  const proposerEmailAnnulation = (rdv) => {
    if (!rdv || rdv.statut === "annule") return false;
    if ((rdv.date || "") < isoLocal(new Date())) return false;
    const fiche = patients.find(p => p.nom && rdv.personne && p.nom.trim().toLowerCase() === rdv.personne.trim().toLowerCase());
    if (!rdv.client_email && !fiche?.email) return false;
    return window.confirm(tr(`Envoyer un email à ${rdv.personne} pour le prévenir que le RDV est annulé ?`, `Send ${rdv.personne} an email to let them know the appointment is cancelled?`));
  };

  const handleUpdateStatut = async (id, statut) => {
    const avant = appointments.find(r => r.id === id);
    const prevenir = statut === "annule" && proposerEmailAnnulation(avant);
    await sb.updateAppointment(token, id, { statut });
    setAppts(prev => prev.map(r => r.id === id ? { ...r, statut } : r));
    setCalRdv(prev => prev && prev.id === id ? { ...prev, statut } : prev);
    if (prevenir) notifierClient(id, "annule");
  };

  // Réservation en ligne en attente : le pro accepte ou refuse
  const accepterDemande = async (rdv) => {
    await sb.updateAppointment(token, rdv.id, { statut: "confirme" });
    setAppts(prev => prev.map(r => r.id === rdv.id ? { ...r, statut: "confirme" } : r));
    setCalRdv(prev => prev && prev.id === rdv.id ? { ...prev, statut: "confirme" } : prev);
    notifierClient(rdv.id, "nouveau");
  };
  const refuserDemande = async (rdv) => {
    if (!window.confirm(tr(`Refuser la demande de ${rdv.personne} ? Le client sera prévenu par email et le créneau sera libéré.`, `Decline ${rdv.personne}'s request? The client will be emailed and the slot freed.`))) return;
    await sb.updateAppointment(token, rdv.id, { statut: "annule" });
    setAppts(prev => prev.map(r => r.id === rdv.id ? { ...r, statut: "annule" } : r));
    setCalRdv(prev => prev && prev.id === rdv.id ? { ...prev, statut: "annule" } : prev);
    notifierClient(rdv.id, "annule");
    // Une demande refusée ne compte pas dans les RDV gratuits du mois
    if ((user.plan || "free") === "free" && (user.usage || 0) > 0) {
      updateUser({ usage: user.usage - 1 });
    }
  };
  const demandesEnAttente = appointments.filter(r => r.statut === "a_valider" && (r.date || "") >= isoLocal(new Date())).length;

  // Exposer toggle dark mode
  useEffect(() => {
    window.__toggleDarkMode = () => setDarkMode(d => !d);
    return () => { delete window.__toggleDarkMode; };
  }, []);

  // Dark mode
  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
    const root = document.documentElement;
    if (darkMode) {
      root.style.setProperty("--bg", "#0a0f1e");
      root.style.setProperty("--bg2", "#111827");
      root.style.setProperty("--card", "#1a2235");
      root.style.setProperty("--border", "#2d3748");
      root.style.setProperty("--text", "#f8fafc");
      root.style.setProperty("--text2", "#a0aec0");
      root.style.setProperty("--input-bg", "#111827");
      root.style.setProperty("--nav-bg", "rgba(10,15,30,0.98)");
      document.body.style.background = "#0a0f1e";
      document.body.style.color = "#f8fafc";
      document.body.style.colorScheme = "dark";
    } else {
      root.style.setProperty("--bg", "#f0f4f8");
      root.style.setProperty("--bg2", "#fff");
      root.style.setProperty("--card", "#fff");
      root.style.setProperty("--border", "#e2e8f0");
      root.style.setProperty("--text", "#1e293b");
      root.style.setProperty("--text2", "#64748b");
      root.style.setProperty("--input-bg", "#fff");
      root.style.setProperty("--nav-bg", "rgba(255,255,255,0.95)");
      document.body.style.background = "#f0f4f8";
      document.body.style.color = "#1e293b";
    }
  }, [darkMode]);

  // Vérification rappels push quotidiens
  useEffect(() => {
    if (!user?.push_enabled) return;
    if (Notification.permission !== "granted") return;
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const lastCheck = localStorage.getItem("lastPushCheck");
    if (lastCheck === todayStr) return;
    localStorage.setItem("lastPushCheck", todayStr);

    appointments.forEach(rdv => {
      if (!rdv.date) return;
      const rdvDate = new Date(rdv.date);
      const diff = Math.round((rdvDate - today) / (1000*60*60*24));
      if (diff === 3 && user.push_j3) {
        sendPushNotif(tr("📅 RDV dans 3 jours","📅 Appointment in 3 days"), tr(`${rdv.titre||"RDV"} avec ${rdv.personne} le ${rdv.date}${rdv.heure?" à "+rdv.heure:""}`, `${rdv.titre||"Appointment"} with ${rdv.personne} on ${rdv.date}${rdv.heure?" at "+rdv.heure:""}`));
      }
      if (diff === 1 && user.push_j1) {
        sendPushNotif(tr("⏰ RDV demain !","⏰ Appointment tomorrow!"), tr(`${rdv.titre||"RDV"} avec ${rdv.personne} demain${rdv.heure?" à "+rdv.heure:""}`, `${rdv.titre||"Appointment"} with ${rdv.personne} tomorrow${rdv.heure?" at "+rdv.heure:""}`));
      }
    });
  }, [appointments, user]);

  // Afficher la config métier au premier login
  useEffect(() => {
    if (user && !user.metier && !loading) {
      setShowMetierSetup(true);
    }
  }, [user, loading]);

  // Onboarding — montrer si nouveau utilisateur
  const isNewUser = appointments.length === 0 && patients.length === 0 && !loading;
  const [dismissOnboarding, setDismissOnboarding] = useState(false);
  const showOnboarding = isNewUser && !dismissOnboarding;

  // Exposer patients et startWithName pour la recherche client
  useEffect(() => {
    window.__patients = patients;
    window.__selectPatient = (id) => {
      const p = patients.find(x => x.id === id);
      if (p && canAdd) {
        document.getElementById("search-suggestions").style.display = "none";
        document.getElementById("search-client").value = p.nom;
        window.__startWithName(p.nom, p);
      }
    };
    window.__startWithName = (nom, patient) => {
      if (!canAdd) return;
      window.__prefillNom = nom;
      // Si le nom tapé correspond à une fiche client, on la reprend (email, téléphone...)
      window.__prefillPatient = patient || patients.find(x => x.nom && nom && x.nom.toLowerCase() === nom.trim().toLowerCase()) || null;
      setPhase("form");
    };
  }, [patients, canAdd]);

  // Mémoriser la langue du compte : les rappels (au pro et à ses clients) partent dans cette langue
  useEffect(() => {
    if (user?.id && token) sb.updateProfile(token, user.id, { lang }).catch(() => {});
  }, [user?.id, token, lang]);

  // Charger les patients depuis Supabase au login
  useEffect(() => {
    if (user?.id && token) {
      sb.getPatients(token, user.id).then(data => {
        if (Array.isArray(data)) setPatients(data);
      });
    }
  }, [user?.id]);

  // Charger les RDV depuis Supabase au login
  useEffect(() => {
    if (user?.id && token) {
      sb.getAppointments(token, user.id).then(data => {
        if (Array.isArray(data)) {
          setAppts(data.map(r => ({ ...r, confirmedAt: r.confirmed_at ? new Date(r.confirmed_at).toLocaleTimeString("fr-FR") : "" })));
        } else {
          console.error("Erreur chargement RDV:", data);
        }
      }).catch(err => console.error("Erreur RDV:", err));
    }
  }, [user?.id, token]);

  useEffect(() => {
    if (!user?.id || !token) return;
    const recharger = () => {
      if (document.visibilityState !== "visible") return;
      sb.getAppointments(token, user.id).then(data => {
        if (Array.isArray(data)) setAppts(data.map(r => ({ ...r, confirmedAt: r.confirmed_at ? new Date(r.confirmed_at).toLocaleTimeString("fr-FR") : "" })));
      }).catch(() => {});
    };
    document.addEventListener("visibilitychange", recharger);
    return () => document.removeEventListener("visibilitychange", recharger);
  }, [user?.id, token]);

  const handleSave = async (rdv) => {
    // Email du client : celui saisi, sinon celui de sa fiche
    const fiche = rdv.personne ? patients.find(p => p.nom && p.nom.toLowerCase() === rdv.personne.toLowerCase()) : null;
    const saisi = (rdv.client_email || "").trim();
    const clientEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(saisi) ? saisi : (fiche?.email || "");
    // Sauvegarder dans Supabase
    // Nettoyer l'objet pour ne garder que les champs valides
    const cleanRdv = {
      client_email: clientEmail || null,
      titre: (rdv.titre || "").trim() || (() => { const k = CATEGORIES.find(x => x.value === (rdv.categorie || "autre")) || CATEGORIES[CATEGORIES.length - 1]; return tr(k.titreFr, k.titreEn); })(),
      personne: rdv.personne || "",
      date: rdv.date || "",
      heure: rdv.heure || "",
      lieu: rdv.lieu || "",
      adresse: rdv.adresse || "",
      notes: rdv.notes || "",
      statut: rdv.statut || "en_attente",
      categorie: rdv.categorie || "autre"
    };
    const saved_res = await sb.addAppointment(token, user.id, cleanRdv);
    if (!saved_res || !Array.isArray(saved_res) || !saved_res[0]) {
      console.error("Erreur sauvegarde RDV:", saved_res);
      alert(tr("Erreur lors de la sauvegarde. Veuillez réessayer.","Could not save. Please try again."));
      return;
    }
    await sb.addAnalyse(token, user.id, true);
    // Email de confirmation au client (si on a son email) — sans bloquer l'écran
    if (clientEmail && saved_res[0].id) notifierClient(saved_res[0].id, "nouveau");

    // Notification push si activée
    if (user.push_confirm && user.push_enabled) {
      sendPushNotif(tr("✅ RDV créé !","✅ Appointment created!"), `${cleanRdv.titre} ${tr("avec","with")} ${rdv.personne} — ${fmtRdv(rdv.date, rdv.heure)}`);
    }

    // Ajout automatique du patient si nouveau (avec son email s'il est connu)
    if (rdv.personne) {
      const exists = fiche;
      if (exists && clientEmail && !exists.email) {
        await sb.updatePatient(token, exists.id, { email: clientEmail });
        setPatients(prev => prev.map(p => p.id === exists.id ? { ...p, email: clientEmail } : p));
      }
      if (!exists) {
        const newPatient = await sb.addPatient(token, user.id, {
          nom: rdv.personne,
          email: clientEmail || "",
          categorie: rdv.categorie || "autre",
          notes: rdv.notes || "",
        });
        if (Array.isArray(newPatient) && newPatient[0]) {
          setPatients(prev => [...prev, newPatient[0]]);
        }
      }
    }
    const newUsage = (user.usage||0) + 1;
    await sb.updateProfile(token, user.id, { usage: newUsage });
    const display = Array.isArray(saved_res) && saved_res[0]
      ? { ...saved_res[0], confirmedAt: new Date().toLocaleTimeString("fr-FR") }
      : { ...rdv, confirmedAt: new Date().toLocaleTimeString("fr-FR") };
    setAppts(prev => [display, ...prev]);
    updateUser({ usage: newUsage });
    setPhase("idle");
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  };

  const handleUpgrade = (key) => {
    if (key==="free") { setPrice(false); return; }
    // Tant que le lien Stripe 20€ n'est pas renseigné, pas de page de paiement cassée
    if (!CONFIG.STRIPE_LINK.startsWith("https://")) {
      alert(tr("Le paiement en ligne de l'abonnement Pro (20€/mois) ouvre très bientôt. En attendant, contactez-nous via le formulaire de contact sur callrdv.com.","Online payment for the Pro plan (€20/month) opens very soon. Meanwhile, please contact us through the contact form on callrdv.com."));
      setPrice(false);
      return;
    }
    // Email pré-rempli pour que le paiement soit relié au bon compte
    const lien = `${CONFIG.STRIPE_LINK}${CONFIG.STRIPE_LINK.includes("?") ? "&" : "?"}prefilled_email=${encodeURIComponent(user.email || "")}`;
    window.open(lien, "_blank");
    setPrice(false);
  };

  if (lienResa) return <ReservationPage slug={lienResa} />;
  if (reponseLien) return <ReponseRdvPage id={reponseLien.id} t={reponseLien.t} />;

  if (!user) {
    if (showLanding) return <LandingPage onLogin={() => { setAuthMode("login"); setShowLanding(false); }} onSignup={() => { setAuthMode("register"); setShowLanding(false); }} />;
    return (<><style>{CSS}</style><AuthPage authHooks={{ signIn, signUp, loading }} initialMode={authMode} /></>);
  }

  return (
    <>
      <style>{CSS}</style>
      {showSettings && <SettingsModal user={user} token={token} sb={sb} onSave={(data)=>updateUser(data)} onClose={()=>setShowSettings(false)} onRevoirGuide={()=>{ setShowSettings(false); allerA("home"); setPhase("idle"); setTimeout(()=>setGuide(true), 250); }} onReservation={()=>{ setShowSettings(false); setShowResa(true); }} />}
      {showResa && <ReglagesReservation user={user} onSave={(data)=>{ updateUser(data); montrerToast(data.booking_enabled ? tr("✅ Page de réservation enregistrée","✅ Booking page saved") : tr("Page de réservation désactivée","Booking page turned off")); }} onClose={()=>setShowResa(false)} />}
      {showPricing && <PricingModal currentPlan={user.plan} onUpgrade={handleUpgrade} onClose={()=>setPrice(false)} />}
      {guide && <GuideBienvenue onFin={finirGuide} onCreer={()=>{ finirGuide(); ouvrirFormulaire(); }} />}
      {calRdv && <CalendarModal rdv={calRdv} onClose={()=>setCalRdv(null)} onEdit={setEditingRdv} onDelete={handleDeleteRdv} onUpdateStatut={handleUpdateStatut} onAccepter={accepterDemande} onRefuser={refuserDemande} />}

      <div className="app-root" style={{ minHeight:"100vh", background:"var(--bg)", fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif", color:"var(--text)", display:"flex", flexDirection:"column", transition:"background .3s,color .3s" }}>

        {/* NAV */}
        <nav className="app-nav" style={{ padding:"12px 24px", background:"#fff", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
          <button onClick={()=>allerA("home")} style={{ display:"flex", alignItems:"center", gap:10, background:"none", border:"none", cursor:"pointer", padding:0, color:"var(--text)" }} aria-label={tr("Accueil","Home")}>
            <span style={{ width:36, height:36, background:"var(--accent)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="phone" size={18} color="#fff" /></span>
            <span style={{ fontWeight:800, fontSize:18, letterSpacing:"-0.02em" }}>CallRDV</span>
          </button>
          <div className="app-nav-right" style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button onClick={()=>setPrice(true)} style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:999, padding:"7px 12px", fontSize:12, fontWeight:700, color: plan.quota===Infinity ? "#15803D" : "var(--text2)", cursor:"pointer", whiteSpace:"nowrap" }}>
              {plan.quota===Infinity ? "Pro" : tr(`${Math.max(0,plan.quota-(user.usage||0))} RDV restants`, `${Math.max(0,plan.quota-(user.usage||0))} left`)}
              {user.plan==="free" && <span style={{ color:"var(--accent)", marginLeft:6 }}>{tr("· Passer Pro","· Go Pro")}</span>}
            </button>
            <button className="hide-phone" onClick={()=>setShowSettings(true)} title={tr("Paramètres","Settings")} aria-label={tr("Paramètres","Settings")} style={{ width:40, height:40, background:"#fff", border:"1px solid var(--border)", borderRadius:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text)" }}><Icon name="settings" size={18} /></button>
            <button onClick={signOut} title={tr("Se déconnecter","Log out")} aria-label={tr("Se déconnecter","Log out")} style={{ width:40, height:40, background:"#fff", border:"1px solid var(--border)", borderRadius:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text)" }}><Icon name="logout" size={18} /></button>
          </div>
        </nav>

        {/* Onglets (ordinateur) */}
        <div className="app-tabs">
          {[["home","home",tr("Accueil","Home")],["agenda","calendar",tr("Mes RDV","Appointments")],["patients","users",tr("Clients","Clients")],...(appointments.length >= 5 ? [["stats","chart",tr("Statistiques","Stats")]] : [])].map(([tab,icone,label]) => (
            <button key={tab} id={`onglet-${tab}`} onClick={()=>allerA(tab)} className={`app-tab ${ongletActif===tab ? "app-tab-on" : ""}`}>
              <Icon name={icone} size={18} /> {label}
              {tab === "agenda" && demandesEnAttente > 0 && <span className="badge-num" aria-label={tr(`${demandesEnAttente} à valider`,`${demandesEnAttente} to approve`)}>{demandesEnAttente}</span>}
            </button>
          ))}
          <div style={{ flex:1 }} />
          <button id="btn-nouveau-pc" className="btn btn-primary btn-sm" onClick={()=>ouvrirFormulaire()} style={{ alignSelf:"center" }}>
            <Icon name="plus" size={16} stroke={2.6} /> {tr("Nouveau RDV","New appointment")}
          </button>
        </div>

        {/* Barre d'onglets du bas (téléphone) */}
        <nav className="bottom-nav" aria-label={tr("Navigation principale","Main navigation")}>
          <button id="bn-home" className={`bn-item ${ongletActif==="home" ? "bn-on" : ""}`} onClick={()=>allerA("home")}><Icon name="home" size={22} />{tr("Accueil","Home")}</button>
          <button id="bn-agenda" className={`bn-item ${ongletActif==="agenda" ? "bn-on" : ""}`} onClick={()=>allerA("agenda")} style={{ position:"relative" }}><Icon name="calendar" size={22} />{tr("Mes RDV","Appts")}{demandesEnAttente > 0 && <span className="badge-num" style={{ position:"absolute", top:2, left:"56%" }} aria-label={tr(`${demandesEnAttente} à valider`,`${demandesEnAttente} to approve`)}>{demandesEnAttente}</span>}</button>
          <div style={{ display:"flex", justifyContent:"center" }}><button id="bn-plus" className="bn-plus" onClick={()=>ouvrirFormulaire()} aria-label={tr("Nouveau rendez-vous","New appointment")}><Icon name="plus" size={26} color="#fff" stroke={2.6} /></button></div>
          <button id="bn-patients" className={`bn-item ${ongletActif==="patients" ? "bn-on" : ""}`} onClick={()=>allerA("patients")}><Icon name="users" size={22} />{tr("Clients","Clients")}</button>
          <button id="bn-reglages" className="bn-item" onClick={()=>setShowSettings(true)}><Icon name="settings" size={22} />{tr("Réglages","Settings")}</button>
        </nav>

        <div className={!showAgenda && !showPatients && !showStats ? "app-body app-body-home" : "app-body"} style={{ display:"flex", flex:1, overflow:"hidden" }}>

          {/* STATS VIEW */}
          {/* Configuration métier au premier login */}
          {showMetierSetup && (
            <div style={{ position:"fixed", inset:0, background:"#00000060", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
              <div className="card fade-up" style={{ width:"100%", maxWidth:480, padding:32 }}>
                <div style={{ textAlign:"center", marginBottom:24 }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>👋</div>
                  <div style={{ fontWeight:800, fontSize:20, marginBottom:8 }}>{tr("Bienvenue","Welcome")} {user?.name?.split(" ")[0] || ""} !</div>
                  <div style={{ fontSize:14, color:"#64748b", lineHeight:1.6 }}>{tr("Pour personnaliser CallRDV à votre activité, dites-nous quel est votre métier :","To tailor CallRDV to your business, tell us what you do:")}</div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  {[
                    { v:"medical", l:tr("🏥 Médical","🏥 Medical"), d:tr("Médecin, dentiste...","Doctor, dentist...") },
                    { v:"restaurant", l:"🍽️ Restaurant", d:tr("Réservations","Bookings") },
                    { v:"garage", l:"🔧 Garage", d:tr("Auto, mécanique","Cars, mechanics") },
                    { v:"beaute", l:tr("💈 Beauté","💈 Beauty"), d:tr("Coiffeur, esthétique","Hair, beauty salon") },
                    { v:"juridique", l:tr("⚖️ Juridique","⚖️ Legal"), d:tr("Avocat, notaire","Lawyer, notary") },
                    { v:"travaux", l:tr("🏠 Travaux","🏠 Trades"), d:tr("Artisan, BTP","Builder, plumber...") },
                    { v:"veterinaire", l:tr("🐾 Vétérinaire","🐾 Vet"), d:tr("Animaux","Animals") },
                    { v:"autre", l:tr("✨ Autre","✨ Other"), d:tr("Tous métiers","Any business") },
                  ].map(({v,l,d}) => (
                    <button key={v} onClick={async()=>{
                      await updateUser({ metier: v });
                      setShowMetierSetup(false);
                      if (v !== "autre" && canAdd && guideVu()) {
                        window.__prefillCategorie = v;
                        setPhase("form");
                      }
                    }} style={{ padding:"16px 12px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:12, cursor:"pointer", textAlign:"left", transition:"all .2s" }}>
                      <div style={{ fontWeight:700, fontSize:14, color:"#1e293b", marginBottom:4 }}>{l}</div>
                      <div style={{ fontSize:11, color:"#64748B" }}>{d}</div>
                    </button>
                  ))}
                </div>
                <button onClick={async()=>{
                  await updateUser({ metier: "autre" });
                  setShowMetierSetup(false);
                }} style={{ marginTop:16, width:"100%", background:"none", border:"none", color:"#64748B", fontSize:12, cursor:"pointer", textDecoration:"underline" }}>
                  {tr("Passer pour l'instant","Skip for now")}
                </button>
              </div>
            </div>
          )}

          {toast && (
            <div role="status" style={{ position:"fixed", left:"50%", bottom:96, transform:"translateX(-50%)", pointerEvents:"none", background:"#1e293b", color:"#fff", padding:"12px 18px", borderRadius:12, fontSize:13, fontWeight:600, zIndex:500, boxShadow:"0 8px 24px rgba(0,0,0,.2)", maxWidth:"calc(100vw - 32px)", textAlign:"center" }}>
              {toast}
            </div>
          )}

          {recoveryToken && <NewPasswordModal token={recoveryToken} onDone={()=>setRecoveryToken(null)} />}

          {/* Stripe Success Modal */}
          {stripeSuccess && (
            <div style={{ position:"fixed", inset:0, background:"#00000060", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
              <div className="card fade-up" style={{ maxWidth:420, width:"100%", padding:40, textAlign:"center" }}>
                <div style={{ fontSize:64, marginBottom:16 }}>🎉</div>
                <div style={{ fontWeight:800, fontSize:22, color:"#1e293b", marginBottom:10 }}>{tr("Paiement réussi !","Payment successful!")}</div>
                <div style={{ fontSize:15, color:"#64748b", lineHeight:1.7, marginBottom:28 }}>
                  {tr(<>Bienvenue dans le plan <strong>Pro</strong> !<br/>Votre compte a été mis à jour. Profitez de toutes les fonctionnalités sans limite.</>, <>Welcome to the <strong>Pro</strong> plan!<br/>Your account has been updated. Enjoy every feature with no limits.</>)}
                </div>
                <button className="btn btn-primary" onClick={()=>{ setStripeSuccess(false); window.history.replaceState({}, "", window.location.pathname); }} style={{ width:"100%", padding:14 }}>
                  {tr("🚀 Commencer à utiliser CallRDV","🚀 Start using CallRDV")}
                </button>
              </div>
            </div>
          )}



          {/* Bouton flottant + nouveau RDV (caché sur l'accueil pour ne pas dupliquer la barre de recherche) */}
          {user && !showMetierSetup && !stripeSuccess && !editingRdv && phase === "idle" && (showAgenda || showPatients || showStats) && (
            <button
              className="fab-desktop"
              onClick={()=>ouvrirFormulaire()}
              style={{
                position:"fixed",
                bottom:24,
                right:24,
                width:60,
                height:60,
                borderRadius:"50%",
                background: canAdd ? "#2450E6" : "#94a3b8",
                color:"#fff",
                border:"none",
                fontSize:28,
                fontWeight:700,
                cursor: canAdd ? "pointer" : "not-allowed",
                boxShadow:"0 8px 24px rgba(36,80,230,0.35)",
                zIndex:50,
                display:"flex",
                alignItems:"center",
                justifyContent:"center",
                transition:"all .2s"
              }}
              title={tr("Nouveau RDV","New appointment")}>
              +
            </button>
          )}

          {/* Modal modification RDV */}
          {editingRdv && (
            <div style={{ position:"fixed", inset:0, background:"#00000050", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24, overflowY:"auto" }}>
              <div className="card fade-up" style={{ width:"100%", maxWidth:500, padding:32, maxHeight:"90vh", overflowY:"auto" }}>
                <div style={{ fontWeight:800, fontSize:18, marginBottom:20 }}>{tr("Modifier le rendez-vous","Edit appointment")}</div>
                {[
                  { key:"titre", label:tr("Titre","Title"), type:"text" },
                  { key:"personne", label:tr("Contact / personne","Contact / person"), type:"text" },
                  { key:"date", label:tr("Date","Date"), type:"date" },
                  { key:"heure", label:tr("Heure","Time"), type:"time" },
                  { key:"client_email", label:tr("Email du client (rappel)","Client email (reminder)"), type:"email" },
                  { key:"lieu", label:tr("Lieu","Place"), type:"text" },
                  { key:"adresse", label:tr("Adresse","Address"), type:"text" },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom:14 }}>
                    <div className="field-label">{f.label}</div>
                    <input type={f.type} defaultValue={editingRdv[f.key]||""} id={`edit-rdv-${f.key}`} />
                  </div>
                ))}
                <div style={{ marginBottom:14 }}>
                  <div className="field-label">{tr("Statut","Status")}</div>
                  <select id="edit-rdv-statut" defaultValue={editingRdv.statut||"en_attente"} style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14 }}>
                    <option value="en_attente">{tr("⏳ En attente","⏳ Pending")}</option>
                    <option value="confirme">{tr("✅ Confirmé","✅ Confirmed")}</option>
                    <option value="reporte">{tr("🔄 Reporté","🔄 Postponed")}</option>
                    <option value="annule">{tr("❌ Annulé","❌ Cancelled")}</option>
                  </select>
                </div>
                <div style={{ marginBottom:20 }}>
                  <div className="field-label">Notes</div>
                  <textarea rows={3} defaultValue={editingRdv.notes||""} id="edit-rdv-notes" />
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <button className="btn btn-outline" onClick={()=>setEditingRdv(null)} style={{ flex:1 }}>{tr("Annuler","Cancel")}</button>
                  <button className="btn btn-primary" onClick={async ()=>{
                    const data = {};
                    ["titre","personne","date","heure","lieu","adresse"].forEach(k => { data[k] = document.getElementById(`edit-rdv-${k}`).value; });
                    const em = document.getElementById("edit-rdv-client_email").value.trim();
                    data.client_email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) ? em : null;
                    data.statut = document.getElementById("edit-rdv-statut").value;
                    data.notes = document.getElementById("edit-rdv-notes").value;
                    const prevenirAnnulation = data.statut === "annule" && proposerEmailAnnulation({ ...editingRdv, ...data, statut: editingRdv.statut });
                    await sb.updateAppointment(token, editingRdv.id, data);
                    setAppts(prev => prev.map(r => r.id === editingRdv.id ? { ...r, ...data } : r));
                    // Date ou heure changée : on prévient le client
                    const deplace = (data.date || "") !== (editingRdv.date || "") || (data.heure || "") !== (editingRdv.heure || "");
                    if (prevenirAnnulation) notifierClient(editingRdv.id, "annule");
                    else if (deplace && data.statut !== "annule") notifierClient(editingRdv.id, "deplace");
                    setEditingRdv(null);
                  }} style={{ flex:2 }}>{tr("💾 Sauvegarder","💾 Save")}</button>
                </div>
              </div>
            </div>
          )}

          {showStats && (
            <StatsView appointments={appointments} patients={patients} user={user} />
          )}

          {/* PATIENTS VIEW */}
          {showPatients && (
            <PatientsView
              patients={patients}
              setPatients={setPatients}
              user={user}
              token={token}
              sb={sb}
              appointments={appointments}
              onNewRdv={ouvrirFormulaire}
            />
          )}

          {/* AGENDA VIEW */}
          {showAgenda && (
            <CalendarView
              appointments={appointments}
              onNewCall={()=>ouvrirFormulaire()}
              onCalRdv={setCalRdv}
              onEditRdv={setEditingRdv}
              onDeleteRdv={handleDeleteRdv}
              onUpdateStatut={handleUpdateStatut}
              onAccepter={accepterDemande}
              onRefuser={refuserDemande}
              afficherSource={!!user.booking_enabled || appointments.some(r => r.source === "en_ligne")}
            />
          )}

          {/* MAIN */}
          {!showAgenda && !showPatients && !showStats && <div className="app-main" style={{ flex:1, padding:"28px", overflowY:"auto" }}>

            {/* IDLE */}
            {phase==="idle" && (
              <div className="fade-up">

                {saved && (
                  <div role="status" style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:16, padding:"14px 16px", marginBottom:18, display:"flex", alignItems:"center", gap:12, animation:"slideIn .4s ease" }}>
                    <span style={{ width:36, height:36, borderRadius:"50%", background:"#16A34A", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Icon name="check" size={18} color="#fff" stroke={2.6} /></span>
                    <div>
                      <div style={{ fontSize:14, fontWeight:800, color:"#15803D" }}>{tr("RDV enregistré avec succès !","Appointment saved!")}</div>
                      <div style={{ fontSize:13, color:"#166534" }}>{tr("Retrouvez-le dans Mes RDV.","You'll find it in Appointments.")}</div>
                    </div>
                  </div>
                )}

                <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.02em", lineHeight:1.2 }}>
                  {tr("Bonjour","Hello")} {(user.name||"").split(" ")[0]}
                </h1>
                <p style={{ color:"var(--text2)", fontSize:14, margin:"4px 0 20px" }}>
                  {(s => s.charAt(0).toUpperCase() + s.slice(1))(new Date().toLocaleDateString(locale(), { weekday:"long", day:"numeric", month:"long" }))}
                  {(() => { const n = appointments.filter(r => (r.date||"") >= isoLocal(new Date()) && r.statut !== "annule").length; return <span> · {n} {tr("RDV à venir", n>1?"upcoming appointments":"upcoming appointment")}</span>; })()}
                </p>

                {!canAdd && (
                  <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:16, padding:18, marginBottom:18 }}>
                    <div style={{ fontWeight:800, color:"#9A3412", marginBottom:6 }}>{tr("Quota mensuel atteint","Monthly limit reached")}</div>
                    <div style={{ fontSize:14, color:"#7C2D12", marginBottom:12 }}>{tr(`Vous avez utilisé vos ${plan.quota} RDV gratuits ce mois.`, `You have used your ${plan.quota} free appointments this month.`)}</div>
                    <button className="btn btn-primary btn-sm" onClick={()=>setPrice(true)}>{tr("Passer en Pro — 20€/mois","Go Pro — €20/month")}</button>
                  </div>
                )}

                {/* Recherche client */}
                <div id="carte-recherche" className="card" style={{ padding:16 }}>
                  <label htmlFor="search-client" className="field-label" style={{ display:"block", marginBottom:10 }}>{tr("Nouveau rendez-vous","New appointment")}</label>
                  <div style={{ position:"relative", display:"flex", gap:8 }}>
                    <div style={{ position:"relative", flex:1 }}>
                      <Icon name="search" size={18} color="#64748B" style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
                      <input
                        placeholder={tr("Nom du client…","Client's name…")}
                        id="search-client"
                        autoComplete="off"
                        onChange={e => {
                          const val = e.target.value;
                          const box = document.getElementById("search-suggestions");
                          if (!val.trim()) { box.style.display="none"; return; }
                          const matches = window.__patients?.filter(p => p.nom.toLowerCase().includes(val.toLowerCase())) || [];
                          if (matches.length > 0) {
                            const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
                            box.innerHTML = matches.slice(0, 8).map(p => `<div onclick="window.__selectPatient('${esc(p.id)}')" style="padding:12px 14px;cursor:pointer;border-bottom:1px solid #F1F5F9;font-size:14px;font-weight:700;color:#0F172A" onmouseover="this.style.background='#EEF2FF'" onmouseout="this.style.background='#fff'">${esc(p.nom)}${p.telephone ? `<span style="font-weight:500;color:#475569"> · ${esc(p.telephone)}</span>` : ""}</div>`).join("");
                            box.style.display = "block";
                          } else {
                            box.innerHTML = `<div style="padding:12px 14px;font-size:13px;color:#475569;">${tr("Nouveau client — appuyez sur → pour créer sa fiche","New client — press → to create their record")}</div>`;
                            box.style.display = "block";
                          }
                        }}
                        onKeyDown={e => {
                          if (e.key === "Enter" && canAdd) {
                            const val = e.target.value.trim();
                            if (val) { window.__startWithName(val); }
                          }
                        }}
                        style={{ paddingLeft:42, fontSize:16, height:52, background:"#F5F6F8" }}
                      />
                      <div id="search-suggestions" style={{ display:"none", position:"absolute", top:"calc(100% + 6px)", left:0, right:0, background:"#fff", border:"1px solid #E2E8F0", borderRadius:14, zIndex:100, boxShadow:"0 12px 30px rgba(15,23,42,.12)", overflow:"hidden" }}></div>
                    </div>
                    <button
                      onClick={() => {
                        const val = document.getElementById("search-client").value.trim();
                        if (canAdd) { if (val) window.__startWithName(val); else ouvrirFormulaire(); }
                      }}
                      disabled={!canAdd}
                      aria-label={tr("Créer le RDV","Create appointment")}
                      style={{ width:52, height:52, flexShrink:0, background:"var(--accent)", border:"none", borderRadius:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", opacity: canAdd ? 1 : .4 }}>
                      <Icon name="arrow" size={20} color="#fff" stroke={2.4} />
                    </button>
                  </div>
                  <div style={{ fontSize:13, color:"var(--text2)", marginTop:10 }}>
                    {tr("Pendant l'appel : tapez le nom, la fiche s'ouvre.","During the call: type the name, the form opens.")}
                  </div>
                </div>
              </div>
            )}

            {/* CALLING */}
            {phase==="calling" && (
              <div className="fade-up" style={{ textAlign:"center" }}>
                <div style={{ padding:"40px 0 30px" }}>
                  <div style={{ position:"relative", display:"inline-block", marginBottom:18 }}>
                    <div style={{ width:100, height:100, borderRadius:"50%", background:"#ff3333", display:"flex", alignItems:"center", justifyContent:"center", fontSize:40, position:"relative", zIndex:1 }}>📞</div>
                    <div style={{ position:"absolute", inset:-12, borderRadius:"50%", border:"2px solid #ff4444", animation:"ring 1.5s ease-out infinite" }}></div>
                    <div style={{ position:"absolute", inset:-24, borderRadius:"50%", border:"2px solid #ff444460", animation:"ring 1.5s ease-out .5s infinite" }}></div>
                  </div>
                  <div style={{ fontFamily:"inherit", fontSize:32, color:"#ff4444", fontWeight:"bold", marginBottom:4 }}>{fmt(recordTime)}</div>
                  <div style={{ fontSize:14, color:"#64748B" }}>{tr("Appel en cours","Call in progress")} <span style={{ animation:"blink 1s infinite", display:"inline-block" }}>●</span></div>
                </div>

                <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:16, padding:20, marginBottom:28, textAlign:"left" }}>
                  <div style={{ fontSize:12, color:"#64748B", fontFamily:"inherit", lineHeight:1.7 }}>
                    {tr(<>Passez votre appel normalement.<br/>Quand vous raccrochez, <span style={{ color:"#2450E6", fontWeight:700 }}>la fiche RDV s'ouvre</span> pour que vous puissiez saisir les détails immédiatement.</>, <>Make your call as usual.<br/>When you hang up, <span style={{ color:"#2450E6", fontWeight:700 }}>the appointment form opens</span> so you can fill in the details right away.</>)}
                  </div>
                </div>

                <button className="btn btn-red" onClick={()=>setPhase("form")} style={{ width:"100%", padding:"18px", fontSize:16, letterSpacing:"0.02em" }}>
                  {tr("🔴 Raccrocher","🔴 Hang up")}
                </button>
                <button className="btn btn-outline btn-sm" onClick={()=>setPhase("idle")} style={{ marginTop:10, width:"100%" }}>
                  {tr("Annuler l'appel","Cancel call")}
                </button>
              </div>
            )}

            {/* FORM — opens right after hanging up */}
            {phase==="form" && (
              <RdvForm
                onSave={handleSave}
                onCancel={()=>setPhase("idle")}
                userMetier={user?.metier}
              />
            )}
          </div>}

          {/* PROCHAINS RDV */}
          {showPatients || showAgenda || showStats ? null : (
          <div className="app-side" style={{ width:360, padding:"28px 24px", overflowY:"auto" }}>
            {(() => {
              const today = isoLocal(new Date());
              const prochains = appointments
                .filter(r => (r.date||"") >= today)
                .sort((a,b) => `${a.date} ${a.heure||""}` > `${b.date} ${b.heure||""}` ? 1 : -1)
                .slice(0, 5);
              return (
                <>
                  <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:12 }}>
                    <h2 style={{ fontSize:17, fontWeight:800 }}>{tr("Prochains rendez-vous","Upcoming appointments")}</h2>
                    {appointments.length > 0 && <button onClick={()=>allerA("agenda")} style={{ background:"none", border:"none", color:"var(--accent)", fontWeight:700, fontSize:14, cursor:"pointer", padding:"8px 0" }}>{tr("Tout voir","See all")}</button>}
                  </div>
                  {prochains.length === 0 ? (
                    <div className="card" style={{ textAlign:"center", padding:"28px 18px" }}>
                      <span style={{ width:48, height:48, borderRadius:14, background:"var(--accent-soft)", display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:10 }}><Icon name="calendar" size={22} color="var(--accent)" /></span>
                      <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>{tr("Aucun RDV à venir","No upcoming appointments")}</div>
                      <div style={{ fontSize:13, color:"var(--text2)" }}>{tr("Tapez le nom d'un client pour en créer un.","Type a client's name to create one.")}</div>
                    </div>
                  ) : prochains.map(rdv => {
                    const d = new Date((rdv.date||"") + "T12:00:00");
                    const jour = isNaN(d.getTime()) ? "" : d.toLocaleDateString(locale(), { weekday:"short" }).replace(".","");
                    return (
                      <button key={rdv.id} onClick={()=>setCalRdv(rdv)} className="card" style={{ width:"100%", textAlign:"left", padding:14, marginBottom:10, display:"flex", gap:14, alignItems:"center", cursor:"pointer", border:"none", font:"inherit", color:"inherit" }}>
                        <span style={{ width:52, flexShrink:0, textAlign:"center", borderRadius:12, background:"var(--accent-soft)", padding:"8px 0" }}>
                          <span style={{ display:"block", fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase" }}>{jour}</span>
                          <span style={{ display:"block", fontSize:20, fontWeight:800, color:"var(--accent)", lineHeight:1.1 }}>{isNaN(d.getTime()) ? "?" : d.getDate()}</span>
                        </span>
                        <span style={{ flex:1, minWidth:0 }}>
                          <span style={{ display:"block", fontSize:15, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{rdv.personne}</span>
                          <span style={{ display:"block", fontSize:13, color:"var(--text2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{rdv.heure ? `${rdv.heure} · ` : ""}{rdv.titre||tr("Rendez-vous","Appointment")}</span>
                        </span>
                        <StatutPill statut={rdv.statut} />
                      </button>
                    );
                  })}
                </>
              );
            })()}

            {/* Chiffres */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, margin:"18px 0 12px" }}>
              {[{ label:tr("RDV au total","Total appointments"), value:appointments.length },{ label:tr("Créés ce mois","Created this month"), value:user.usage||0 }].map(({label,value})=>(
                <div key={label} className="card" style={{ padding:14 }}>
                  <div style={{ fontWeight:800, fontSize:22, color:"var(--accent)" }}>{value}</div>
                  <div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>
            {appointments.length >= 5 && (
              <button onClick={()=>allerA("stats")} className="btn btn-outline btn-sm" style={{ width:"100%", marginBottom:12 }}><Icon name="chart" size={16} /> {tr("Voir les statistiques","See statistics")}</button>
            )}
            <div style={{ display:"flex", gap:8, alignItems:"center", fontSize:12, color:"var(--text2)", padding:"4px 2px" }}>
              <Icon name="check" size={14} color="#16A34A" /> {tr("Données hébergées en Europe. Aucun enregistrement vocal.","Data hosted in Europe. No voice recording.")}
            </div>
          </div>
          )}
        </div>
      </div>
    </>
  );
}
