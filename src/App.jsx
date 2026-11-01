import React, { useState, useEffect, useRef } from "react";

const CONFIG = {
  SUPABASE_URL: "https://vcnguzlwyacnlysnsogv.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbmd1emx3eWFjbmx5c25zb2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDg0MTcsImV4cCI6MjA4ODIyNDQxN30.rI1WkGgUjFlw7dbl4wDtXcItDqsEc5PaqpPpF35cSuU",
  STRIPE_LINK: "https://buy.stripe.com/8x2aEX5th2V02lIdJccMM02", // abonnement unique 20€/mois
};

// Supabase client leger (sans SDK)
const sb = {
  url: CONFIG.SUPABASE_URL,
  key: CONFIG.SUPABASE_ANON_KEY,
  headers: (token) => ({
    "Content-Type": "application/json",
    "apikey": CONFIG.SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${token || CONFIG.SUPABASE_ANON_KEY}`,
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
  pro:      { name: "Pro",     nameEn: "Pro",  price: 20, quota: Infinity, color: "#1e3a5f", features: ["RDV illimités", "Rappels email à vous et à vos clients", "Agenda, fiches clients, export PDF", "Sans engagement"], featuresEn: ["Unlimited appointments", "Email reminders for you and your clients", "Calendar, client profiles, PDF export", "Cancel anytime"] },
  business: { name: "Pro",     nameEn: "Pro",  price: 20, quota: Infinity, color: "#1e3a5f", features: ["RDV illimités", "Rappels email à vous et à vos clients", "Agenda, fiches clients, export PDF", "Sans engagement"], featuresEn: ["Unlimited appointments", "Email reminders for you and your clients", "Calendar, client profiles, PDF export", "Cancel anytime"] },
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
          style={{ padding:"6px 10px", fontSize:12, fontWeight:700, border:"none", cursor:"pointer", background: lang === l ? "#0f2340" : "transparent", color: lang === l ? "#fff" : "#64748b", fontFamily:"DM Mono, monospace" }}>
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
        push_confirm: profile.push_confirm !== false
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
    const userData = { id: res.user.id, email: res.user.email, name: profile?.name || res.user.user_metadata?.name || "", plan: profile?.plan || "free", usage: profile?.usage || 0, token: tk, metier: profile?.metier || null, rappels: profile?.rappels || ["j-1","j-3"], push_enabled: profile?.push_enabled || false, push_j1: profile?.push_j1 !== false, push_j3: profile?.push_j3 !== false, push_confirm: profile?.push_confirm !== false };
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
    setUser({ id: u.id, email: u.email, name: profile?.name || u.user_metadata?.full_name || u.user_metadata?.name || "", plan: profile?.plan || "free", usage: profile?.usage || 0, token: tk, metier: profile?.metier || null, rappels: profile?.rappels || ["j-1","j-3"], push_enabled: profile?.push_enabled || false, push_j1: profile?.push_j1 !== false, push_j3: profile?.push_j3 !== false, push_confirm: profile?.push_confirm !== false });
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
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Mono:wght@300;400&display=swap');
:root{--bg:#f0f4f8;--bg2:#fff;--card:#fff;--border:#e2e8f0;--text:#1e293b;--text2:#64748b;--input-bg:#fff;--nav-bg:rgba(255,255,255,0.95);}
*{box-sizing:border-box;margin:0;padding:0;}
/* Téléphone : la fiche prend toute la largeur, "Mon agenda" passe en dessous */
@media(max-width:700px){
  .app-body-home{flex-direction:column !important;overflow-y:auto !important;}
  .app-body-home .app-main{flex:none !important;overflow:visible !important;border-right:none !important;padding:18px 16px !important;}
  .app-body-home .app-side{width:100% !important;overflow:visible !important;border-top:1px solid #e2e8f0;}
  .pv-left{width:100% !important;border-right:none !important;}
  .pv-list .pv-right{display:none !important;}
  .pv-detail .pv-left{display:none !important;}
  .pv-right{padding:16px !important;}
  .pv-back{display:block !important;}
  .cal-head{padding:12px 14px !important;}
  .cal-tools{width:100%;}
  .cal-search{flex:1;min-width:0;width:auto !important;}
  .cal-nav{width:100%;justify-content:space-between;gap:6px !important;}
  .cal-title{min-width:0 !important;font-size:15px !important;}
  .cal-list{padding:14px !important;}
  .app-nav{padding:10px 12px !important;}
  .app-nav-name{display:none;}
  .app-nav-right{gap:6px !important;}
  .app-nav-right > *{padding:6px 8px !important;}
}
body{background:var(--bg);color:var(--text);transition:background .3s,color .3s;}
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
.btn{font-family:'Inter',sans-serif;font-weight:600;border:none;cursor:pointer;transition:all .2s;border-radius:10px;}
.btn-primary{background:#1e3a5f;color:#fff;padding:14px 28px;font-size:15px;}
.btn-primary:hover{background:#162d4a;transform:translateY(-1px);box-shadow:0 4px 16px #1e3a5f30;}
.btn-primary:disabled{opacity:.4;cursor:not-allowed;transform:none;}
.btn-red{background:#ef4444;color:#fff;padding:14px 28px;font-size:15px;}
.btn-red:hover{background:#dc2626;transform:translateY(-1px);}
.btn-outline{background:#fff;color:#1e3a5f;border:1.5px solid #cbd5e1;padding:12px 24px;font-size:14px;}
.btn-outline:hover{border-color:#1e3a5f;background:#f8faff;}
.btn-sm{padding:8px 16px;font-size:13px;border-radius:8px;}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;box-shadow:0 1px 4px #00000008;}
input,select{background:#fff;border:1.5px solid #e2e8f0;border-radius:8px;color:#1e293b;font-family:'Inter',sans-serif;font-size:14px;padding:11px 14px;width:100%;outline:none;transition:border-color .2s;}
input:focus,select:focus{border-color:#1e3a5f;box-shadow:0 0 0 3px #1e3a5f15;}
input::placeholder{color:#94a3b8;}
textarea{background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;color:#1e293b;font-family:'Inter',sans-serif;font-size:14px;padding:14px;width:100%;resize:none;outline:none;transition:border-color .2s;line-height:1.6;}
textarea:focus{border-color:#1e3a5f;box-shadow:0 0 0 3px #1e3a5f15;}
textarea::placeholder{color:#94a3b8;}
.spinner{width:20px;height:20px;border:2px solid #e2e8f0;border-top-color:#1e3a5f;border-radius:50%;animation:spin .8s linear infinite;display:inline-block;}
.privacy-badge{background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 16px;display:flex;align-items:flex-start;gap:10px;}
.erased-banner{background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:12px;animation:slideIn .4s ease;}
.field-label{font-size:11px;font-weight:600;color:#64748b;letter-spacing:.08em;margin-bottom:6px;font-family:'DM Mono',monospace;}
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
    <div style={{ minHeight:"100vh", background:"#f0f4f8", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',sans-serif", padding:24, position:"relative" }}>
      <LangSwitch style={{ position:"absolute", top:16, right:16 }} />
      <div style={{ width:"100%", maxWidth:420 }} className="fade-up">
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:56, height:56, background:"#1e3a5f", borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, margin:"0 auto 14px" }}>📞</div>
          <div style={{ fontWeight:800, fontSize:28, color:"#1e293b", letterSpacing:"-0.03em" }}>CallRDV</div>
          <div style={{ fontSize:12, color:"#94a3b8", fontFamily:"DM Mono", marginTop:4 }}>{t("PRISE DE RDV AUTOMATIQUE", "APPOINTMENT BOOKING MADE EASY")}</div>
        </div>
        <div className="card" style={{ padding:32 }}>
          <div style={{ display:"flex", gap:8, marginBottom:24, background:"#f0f4f8", borderRadius:12, padding:4 }}>
            {["login","register"].map(m => (
              <button key={m} onClick={() => setMode(m)} className="btn" style={{ flex:1, padding:"10px", fontSize:13, borderRadius:10, background:mode===m?"#1e3a5f":"transparent", color:mode===m?"#f0f4f8":"#94a3b8" }}>
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
              <span onClick={()=>{ setForgotMode(true); setError(""); setForgotSent(false); }} style={{ fontSize:12, color:"#4a90d9", cursor:"pointer", fontFamily:"DM Mono" }}>
                {t("Mot de passe oublié ?","Forgot password?")}
              </span>
            </div>
          )}

          {/* Mode mot de passe oublié */}
          {forgotMode && (
            <div style={{ background:"#f0f4ff", border:"1px solid #1e3a5f30", borderRadius:12, padding:20, marginTop:12 }}>
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
                  <button onClick={handleForgot} disabled={forgotLoading} style={{ width:"100%", background:"#1e3a5f", color:"#fff", border:"none", borderRadius:8, padding:"11px", cursor:"pointer", fontWeight:700, fontSize:13, opacity:forgotLoading?0.7:1 }}>
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
                style={{ width:36, height:20, borderRadius:10, background:rememberMe?"#1e3a5f":"#e2e8f0", cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}>
                <div style={{ position:"absolute", top:2, left:rememberMe?16:2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s" }}></div>
              </div>
              <span style={{ fontSize:13, color:"#64748b", cursor:"pointer" }} onClick={()=>setRememberMe(r=>!r)}>{t("Se souvenir de moi","Remember me")}</span>
            </div>
          )}
          {info && <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", color:"#166534", borderRadius:10, padding:"12px 14px", fontSize:13, marginTop:12, lineHeight:1.5 }}>{info}</div>}
          {error && <div style={{ color:"#ff6b6b", fontSize:13, marginTop:10, fontFamily:"DM Mono" }}>⚠ {error}</div>}
          <button className="btn btn-primary" onClick={handle} disabled={loading} style={{ width:"100%", marginTop:18, display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            {loading ? <span className="spinner"></span> : (mode==="login" ? t("Se connecter","Log in") : t("Créer mon compte","Create my account"))}
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:10, margin:"16px 0" }}>
            <div style={{ flex:1, height:1, background:"#e2e8f0" }}></div>
            <span style={{ fontSize:11, color:"#94a3b8", fontFamily:"DM Mono" }}>{t("OU","OR")}</span>
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
            <span style={{ fontSize:15 }}>🔒</span>
            <div style={{ fontSize:11, color:"#0369a1", fontFamily:"DM Mono", lineHeight:1.6 }}>
              <span style={{ color:"#0284c7", fontWeight:700 }}>{t("Données protégées. ","Data protected. ")}</span>
              {t("Aucun stockage vocal. Conforme RGPD.","No voice recording. GDPR compliant.")}
            </div>
          </div>
        </div>
        <div style={{ marginTop:20, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {Object.entries(PLANS).filter(([k]) => k !== "business").map(([k,p]) => (
            <div key={k} style={{ background:"#fff", border:`1px solid ${p.color}30`, borderRadius:12, padding:12, textAlign:"center" }}>
              <div style={{ fontWeight:700, fontSize:14, color:p.color }}>{p.price===0?t("Gratuit","Free"):`${p.price}€${t("/mois","/mo")}`}</div>
              <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"DM Mono", marginTop:2 }}>{k==="free"?t("10 RDV par mois","10 appointments/month"):t("RDV illimités","Unlimited")}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Pricing Modal ────────────────────────────────────────────
function PricingModal({ currentPlan, onUpgrade, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"#f0f4f8ee", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:560, maxHeight:"92vh", overflowY:"auto" }} className="fade-up">
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontWeight:800, fontSize:26, color:"#1e293b" }}>{tr("Un seul prix, tout inclus","One price, everything included")}</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:16 }}>
          {Object.entries(PLANS).filter(([key]) => key !== "business").map(([key, plan]) => (
            <div key={key} className="card" style={{ border:`1px solid ${plan.color}40`, position:"relative", transform:key==="pro"?"scale(1.04)":"none" }}>
              <div style={{ color:plan.color, fontWeight:800, fontSize:22, marginBottom:4 }}>
                {plan.price===0?tr("Gratuit","Free"):`${plan.price}€`}{plan.price>0&&<span style={{ fontSize:13, fontWeight:400, color:"#94a3b8" }}>{tr("/mois","/month")}</span>}
              </div>
              <div style={{ fontWeight:700, fontSize:16, marginBottom:14, color:"#1e293b" }}>{tr(plan.name, plan.nameEn)}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:18 }}>
                {tr(plan.features, plan.featuresEn).map(f => <div key={f} style={{ fontSize:13, color:"#64748b", display:"flex", gap:8 }}><span style={{ color:plan.color }}>✓</span>{f}</div>)}
              </div>
              {(currentPlan===key || (key==="pro" && currentPlan==="business"))
                ? <div style={{ textAlign:"center", padding:"12px", background:`${plan.color}15`, borderRadius:10, fontSize:13, color:plan.color, fontFamily:"DM Mono" }}>{tr("Plan actuel","Current plan")}</div>
                : <button onClick={()=>onUpgrade(key)} style={{ width:"100%", background:plan.color, color:"#f0f4f8", padding:"12px", fontFamily:"'Inter',sans-serif", fontWeight:700, border:"none", cursor:"pointer", borderRadius:10, fontSize:14 }}>{key==="free"?tr("Rester gratuit","Stay on Free"):tr(`Passer au ${plan.name} — ${plan.price}€/mois`, `Go ${plan.nameEn} — €${plan.price}/month`)}</button>
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
function CalendarModal({ rdv, onClose, onEdit, onDelete, onUpdateStatut }) {
  const catColors = {
    medical:"#3b82f6", dentiste:"#06b6d4", kine:"#8b5cf6", veterinaire:"#f59e0b",
    garage:"#6b7280", travaux:"#f97316", juridique:"#7c3aed", banque:"#0891b2",
    beaute:"#ec4899", formation:"#10b981", pro:"#1e3a5f", perso:"#64748b",
    restaurant:"#e11d48", autre:"#94a3b8"
  };

  const exportTo = (type) => {
    const title = encodeURIComponent(rdv.titre);
    const details = encodeURIComponent(`${tr("Avec","With")}: ${rdv.personne}\n${tr("Lieu","Place")}: ${rdv.lieu||""}\n${rdv.notes||""}`);
    const loc = encodeURIComponent(rdv.adresse||rdv.lieu||"");
    const now = new Date();
    const start = now.toISOString().replace(/[-:]|\.\d+/g,"").slice(0,15)+"Z";
    const end = new Date(now.getTime()+3600000).toISOString().replace(/[-:]|\.\d+/g,"").slice(0,15)+"Z";
    if (type==="google") window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${loc}&dates=${start}/${end}`,"_blank");
    else window.open(`https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&body=${details}&location=${loc}`,"_blank");
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000050", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div className="card fade-up" style={{ width:"100%", maxWidth:460, padding:32 }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:24 }}>
          <div style={{ width:48, height:48, borderRadius:12, background:(catColors[rdv.categorie]||"#94a3b8")+"20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
            📋
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:18, color:"#1e293b", marginBottom:4 }}>{rdv.titre||tr("Rendez-vous","Appointment")}</div>
            <div style={{ display:"inline-block", background:(catColors[rdv.categorie]||"#94a3b8")+"20", color:catColors[rdv.categorie]||"#94a3b8", padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:600 }}>{catLabel(rdv.categorie||"autre")}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#94a3b8", padding:4 }}>✕</button>
        </div>

        {/* Infos */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
          {[
            { icon:"👤", label:tr("Contact","Contact"), value:rdv.personne },
            { icon:"📅", label:tr("Date","Date"), value:rdv.date ? new Date(rdv.date+"T12:00:00").toLocaleDateString(locale(), { weekday:"short", day:"numeric", month:"short", year:"numeric" }) : "" },
            { icon:"🕐", label:tr("Heure","Time"), value:rdv.heure||tr("Non définie","Not set") },
            { icon:"📍", label:tr("Lieu","Place"), value:rdv.lieu||tr("Non défini","Not set") },
          ].map(({icon,label,value}) => (
            <div key={label} style={{ background:"#f8fafc", borderRadius:10, padding:"10px 14px" }}>
              <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4 }}>{icon} {label}</div>
              <div style={{ fontSize:13, fontWeight:600, color:"#1e293b" }}>{value||"—"}</div>
            </div>
          ))}
        </div>

        {/* Statut */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, color:"#94a3b8", marginBottom:6, fontFamily:"DM Mono" }}>{tr("STATUT","STATUS")}</div>
          <select
            value={rdv.statut||"en_attente"}
            onChange={e => onUpdateStatut && onUpdateStatut(rdv.id, e.target.value)}
            style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14, background:"#fff" }}>
            <option value="en_attente">{tr("⏳ En attente","⏳ Pending")}</option>
            <option value="confirme">{tr("✅ Confirmé","✅ Confirmed")}</option>
            <option value="reporte">{tr("🔄 Reporté","🔄 Postponed")}</option>
            <option value="annule">{tr("❌ Annulé","❌ Cancelled")}</option>
          </select>
        </div>

        {rdv.notes && (
          <div style={{ background:"#f8fafc", borderRadius:10, padding:"12px 14px", marginBottom:20, fontSize:13, color:"#475569", lineHeight:1.6 }}>
            📝 {rdv.notes}
          </div>
        )}

        {/* Actions */}
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <button onClick={()=>{ onEdit && onEdit(rdv); onClose(); }} style={{ flex:1, background:"#f0f4ff", border:"1px solid #1e3a5f30", borderRadius:8, padding:"12px", cursor:"pointer", fontSize:14, fontWeight:600, color:"#1e3a5f" }}>{tr("✏️ Modifier","✏️ Edit")}</button>
          <button onClick={()=>{ onDelete && onDelete(rdv.id); onClose(); }} style={{ flex:1, background:"#fff5f5", border:"1px solid #fecaca", borderRadius:8, padding:"12px", cursor:"pointer", fontSize:14, fontWeight:600, color:"#ef4444" }}>{tr("🗑️ Supprimer","🗑️ Delete")}</button>
          <button onClick={()=>{
            const msg = `${tr("📅 Rappel RDV","📅 Appointment reminder")}\n${rdv.titre||tr("Rendez-vous","Appointment")}\n👤 ${rdv.personne||""}\n📆 ${rdv.date||""}${rdv.heure?tr(" à "," at ")+rdv.heure:""}\n📍 ${rdv.lieu||""}\n\nCallRDV — callrdv.com`;
            if (navigator.share) { navigator.share({ title:tr("RDV","Appointment"), text:msg }); }
            else { navigator.clipboard.writeText(msg); alert(tr("Copié !","Copied!")); }
          }} style={{ flex:1, background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:"12px", cursor:"pointer", fontSize:14, fontWeight:600, color:"#16a34a" }}>
            {tr("📤 Partager","📤 Share")}
          </button>
        </div>

        {/* Export (replié) */}
        <details style={{ marginTop:4 }}>
          <summary style={{ cursor:"pointer", fontSize:12, color:"#94a3b8", padding:"8px 0", textAlign:"center", listStyle:"none" }}>
            {tr("⚙️ Plus d'options","⚙️ More options")}
          </summary>
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button onClick={()=>exportTo("google")} style={{ flex:1, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"10px", cursor:"pointer", fontSize:12, color:"#64748b" }}>📅 Google Calendar</button>
            <button onClick={()=>exportTo("outlook")} style={{ flex:1, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"10px", cursor:"pointer", fontSize:12, color:"#64748b" }}>📆 Outlook</button>
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
    beaute:"#ec4899", formation:"#10b981", pro:"#1e3a5f", perso:"#64748b", autre:"#94a3b8"
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
    <div style={{ flex:1, overflowY:"auto", padding:28, background:"#f0f4f8" }}>
      <div style={{ maxWidth:900, margin:"0 auto" }}>
        <div style={{ fontWeight:800, fontSize:22, color:"#1e293b", marginBottom:4 }}>{tr("📊 Tableau de bord","📊 Dashboard")}</div>
        <div style={{ fontSize:13, color:"#94a3b8", marginBottom:24 }}>{tr("Vue d'ensemble de votre activité","An overview of your activity")}</div>

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
              <div style={{ fontSize:12, color:"#94a3b8", fontFamily:"DM Mono" }}>{label}</div>
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
                  <div style={{ fontSize:11, color:"#1e3a5f", fontWeight:700 }}>{count||""}</div>
                  <div style={{ width:"100%", background:"#1e3a5f", borderRadius:"4px 4px 0 0", height: count === 0 ? 4 : `${Math.round((count/maxCount)*100)}px`, transition:"height .3s", opacity: count===0?0.2:1 }}></div>
                  <div style={{ fontSize:10, color:"#94a3b8", fontFamily:"DM Mono" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Top categories */}
          <div className="card" style={{ padding:24 }}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:20 }}>{tr("🏆 Top catégories","🏆 Top categories")}</div>
            {topCats.length === 0 ? (
              <div style={{ color:"#94a3b8", fontSize:13 }}>{tr("Aucun RDV encore","No appointments yet")}</div>
            ) : topCats.map(([cat, count]) => (
              <div key={cat} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{catLabel(cat)}</span>
                  <span style={{ fontSize:13, color:"#94a3b8" }}>{count} {tr("RDV","appt.")}</span>
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
              <div style={{ fontSize:12, color:"#94a3b8", marginTop:4 }}>{user.plan==="free"?tr(`${user.usage||0}/10 RDV utilisés ce mois`,`${user.usage||0}/10 appointments used this month`):tr("RDV illimités","Unlimited appointments")}</div>
            </div>
            {user.plan==="free" && (
              <div style={{ background:"#f0f4ff", borderRadius:10, padding:14, fontSize:12, color:"#1e3a5f", lineHeight:1.6 }}>
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
                  <div style={{ fontSize:11, color:"#94a3b8" }}>{rdv.personne} · {fmtRdv(rdv.date, rdv.heure)}</div>
                </div>
              </div>
            ))}
            {appointments.length === 0 && <div style={{ color:"#94a3b8", fontSize:13 }}>{tr("Aucun RDV encore","No appointments yet")}</div>}
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
    beaute:"#ec4899", formation:"#10b981", pro:"#1e3a5f", perso:"#64748b", autre:"#94a3b8"
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
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #1e3a5f; }
        .logo { font-size: 22px; font-weight: 800; color: #1e3a5f; }
        .subtitle { font-size: 13px; color: #94a3b8; margin-top: 4px; }
        .title { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 20px; }
        .date { font-size: 12px; color: #94a3b8; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1e3a5f; color: #fff; padding: 12px 14px; text-align: left; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; }
        tr:hover td { background: #f8faff; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
        .badge { display: inline-block; background: #f0f4ff; color: #1e3a5f; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
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
      <div class="footer">CallRDV — ${tr("Conforme RGPD","GDPR compliant")} · callrdv.com</div>
    </body>
    </html>
  `;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

// ── Vue Agenda Calendrier ────────────────────────────────────
function CalendarView({ appointments, onNewCall, onCalRdv, onEditRdv, onDeleteRdv, onUpdateStatut }) {
  // semaine | mois | liste — sur téléphone, la liste est la seule vue lisible
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
    beaute:"#ec4899", formation:"#10b981", pro:"#1e3a5f", perso:"#64748b", autre:"#94a3b8"
  };

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"#f0f4f8" }}>
      {/* Calendar Header */}
      <div className="cal-head" style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
        {viewMode !== "liste" ? (
        <div className="cal-nav" style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={()=>navigate(-1)} style={{ background:"#f0f4f8", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:16 }}>‹</button>
          <div className="cal-title" style={{ fontWeight:700, fontSize:18, color:"#1e293b", minWidth:200, textAlign:"center" }}>
            {viewMode==="semaine"
              ? `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${moisNoms[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`
              : `${moisNoms[currentDate.getMonth()]} ${currentDate.getFullYear()}`
            }
          </div>
          <button onClick={()=>navigate(1)} style={{ background:"#f0f4f8", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:16 }}>›</button>
          <button onClick={()=>setCurrentDate(new Date())} style={{ background:"#1e3a5f", color:"#fff", border:"none", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:12, fontWeight:600, marginLeft:8 }}>{tr("Aujourd'hui","Today")}</button>
        </div>
        ) : (
          <div style={{ fontWeight:800, fontSize:18, color:"#1e293b" }}>{tr("Mes rendez-vous","My appointments")}</div>
        )}
        <div className="cal-tools" style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          {["semaine","mois","liste"].map(m => (
            <button key={m} onClick={()=>setViewMode(m)}
              style={{ background:viewMode===m?"#1e3a5f":"#f0f4f8", color:viewMode===m?"#fff":"#64748b", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:12, fontWeight:600, textTransform:"capitalize" }}>
              {({ semaine:tr("Semaine","Week"), mois:tr("Mois","Month"), liste:tr("Liste","List") })[m]}
            </button>
          ))}
          <button onClick={onNewCall} style={{ background:"#1e3a5f", color:"#fff", border:"none", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:12, fontWeight:600, marginLeft:6, whiteSpace:"nowrap" }}>
            + RDV
          </button>
          <button onClick={()=>exportPDF(appointments, viewMode)} style={{ background:"#f0f4f8", color:"#1e3a5f", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:12, fontWeight:600 }}>
            📄
          </button>
          <input
            placeholder={tr("🔍 Rechercher...","🔍 Search...")}
            value={agendaSearch}
            onChange={e => { setAgendaSearch(e.target.value); if(e.target.value) setViewMode("liste"); }}
            className="cal-search"
            style={{ fontSize:12, padding:"6px 10px", borderRadius:8, border:"1px solid #e2e8f0", width:120, background:"#fff" }}
          />
        </div>
      </div>

      {/* Week View */}
      {viewMode==="semaine" && (
        <div style={{ flex:1, overflowY:"auto", padding:"0" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", borderBottom:"1px solid #e2e8f0", background:"#fff" }}>
            {weekDays.map((day, i) => (
              <div key={i} style={{ padding:"12px 8px", textAlign:"center", borderRight:i<6?"1px solid #e2e8f0":"none" }}>
                <div style={{ fontSize:11, color:"#94a3b8", fontWeight:600, marginBottom:4 }}>{jours[i]}</div>
                <div style={{ width:32, height:32, borderRadius:"50%", background:isToday(day)?"#1e3a5f":"transparent", color:isToday(day)?"#fff":"#1e293b", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto", fontWeight:700, fontSize:15 }}>
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
                      style={{ background:catColors[rdv.categorie]||"#1e3a5f", color:"#fff", borderRadius:6, padding:"4px 8px", marginBottom:4, cursor:"pointer", fontSize:11, fontWeight:600, lineHeight:1.4 }}>
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
              <div key={j} style={{ padding:"10px 8px", textAlign:"center", fontSize:11, fontWeight:600, color:"#94a3b8" }}>{j}</div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)" }}>
            {monthDays.map(({ date, currentMonth }, i) => {
              const rdvs = getRdvsForDate(date);
              return (
                <div key={i} style={{ minHeight:90, borderRight:(i+1)%7!==0?"1px solid #e2e8f0":"none", borderBottom:"1px solid #e2e8f0", padding:6, background:isToday(date)?"#f8faff":currentMonth?"#fff":"#f8f9fa" }}>
                  <div style={{ width:24, height:24, borderRadius:"50%", background:isToday(date)?"#1e3a5f":"transparent", color:isToday(date)?"#fff":currentMonth?"#1e293b":"#cbd5e1", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:isToday(date)?700:400, marginBottom:4 }}>
                    {date.getDate()}
                  </div>
                  {rdvs.slice(0,2).map((rdv, j) => (
                    <div key={j} onClick={()=>onCalRdv(rdv)}
                      style={{ background:catColors[rdv.categorie]||"#1e3a5f", color:"#fff", borderRadius:4, padding:"2px 6px", marginBottom:2, cursor:"pointer", fontSize:10, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {rdv.titre||rdv.personne}
                    </div>
                  ))}
                  {rdvs.length > 2 && <div style={{ fontSize:10, color:"#94a3b8", paddingLeft:4 }}>+{rdvs.length-2}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode==="liste" && (
        <div className="cal-list" style={{ flex:1, overflowY:"auto", padding:24 }}>
          {appointments.length===0 ? (
            <div style={{ textAlign:"center", padding:"60px 0" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📅</div>
              <div style={{ color:"#94a3b8", fontSize:14 }}>{tr("Aucun RDV enregistré","No appointments yet")}</div>
            </div>
          ) : (() => {
            const q = agendaSearch.toLowerCase();
            const list = appointments.filter(r => !q || (r.titre||"").toLowerCase().includes(q) || (r.personne||"").toLowerCase().includes(q) || (r.lieu||"").toLowerCase().includes(q));
            const todayIso = isoLocal(new Date());
            const key = r => `${r.date||""} ${r.heure||""}`;
            const aVenir = list.filter(r => (r.date||"") >= todayIso).sort((a,b) => key(a) > key(b) ? 1 : -1);
            const passes = list.filter(r => (r.date||"") < todayIso).sort((a,b) => key(a) < key(b) ? 1 : -1);
            const carte = (rdv) => (
              <div key={rdv.id} className="card" onClick={()=>onCalRdv(rdv)} style={{ marginBottom:10, display:"flex", alignItems:"center", gap:12, padding:"14px 16px", cursor:"pointer", opacity:(rdv.date||"") < todayIso ? .65 : 1 }}>
                <div style={{ width:4, alignSelf:"stretch", minHeight:44, borderRadius:4, background:catColors[rdv.categorie]||"#1e3a5f", flexShrink:0 }}></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#1e3a5f", marginBottom:3 }}>{(s => s.charAt(0).toUpperCase() + s.slice(1))(fmtRdv(rdv.date, rdv.heure))}</div>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{rdv.personne}</div>
                  <div style={{ fontSize:12, color:"#64748b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{rdv.titre||tr("Rendez-vous","Appointment")}{rdv.lieu ? ` · 📍 ${rdv.lieu}` : ""}</div>
                  <div style={{ marginTop:6 }}>
                    <select
                      value={rdv.statut||"en_attente"}
                      onChange={e => onUpdateStatut(rdv.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      style={{ width:"auto", fontSize:11, padding:"2px 8px", borderRadius:20, border:"1px solid #e2e8f0", background: rdv.statut==="confirme"?"#f0fdf4":rdv.statut==="annule"?"#fff5f5":rdv.statut==="reporte"?"#fffbeb":"#f8fafc", color: rdv.statut==="confirme"?"#16a34a":rdv.statut==="annule"?"#ef4444":rdv.statut==="reporte"?"#d97706":"#64748b", cursor:"pointer" }}>
                      <option value="en_attente">{tr("⏳ En attente","⏳ Pending")}</option>
                      <option value="confirme">{tr("✅ Confirmé","✅ Confirmed")}</option>
                      <option value="reporte">{tr("🔄 Reporté","🔄 Postponed")}</option>
                      <option value="annule">{tr("❌ Annulé","❌ Cancelled")}</option>
                    </select>
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
                  <button onClick={(e)=>{e.stopPropagation();onEditRdv(rdv);}} title={tr("Modifier","Edit")} style={{ background:"#f0f4ff", border:"1px solid #1e3a5f30", borderRadius:8, padding:"6px 10px", cursor:"pointer", fontSize:13, color:"#1e3a5f" }}>✏️</button>
                  <button onClick={(e)=>{e.stopPropagation();onDeleteRdv(rdv.id);}} title={tr("Supprimer","Delete")} style={{ background:"#fff5f5", border:"1px solid #fecaca", borderRadius:8, padding:"6px 10px", cursor:"pointer", fontSize:13, color:"#ef4444" }}>🗑️</button>
                </div>
              </div>
            );
            const titre = (txt) => <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"DM Mono", letterSpacing:"0.08em", margin:"6px 0 10px" }}>{txt}</div>;
            if (list.length === 0) return <div style={{ textAlign:"center", color:"#94a3b8", fontSize:14, padding:"40px 0" }}>{tr("Aucun RDV trouvé","No appointments found")}</div>;
            return (
              <>
                {titre(tr(`À VENIR (${aVenir.length})`, `UPCOMING (${aVenir.length})`))}
                {aVenir.length === 0 ? <div style={{ color:"#94a3b8", fontSize:13, marginBottom:20 }}>{tr("Aucun RDV à venir","No upcoming appointments")}</div> : aVenir.map(carte)}
                {passes.length > 0 && <div style={{ marginTop:18 }}>{titre(tr(`PASSÉS (${passes.length})`, `PAST (${passes.length})`))}{passes.map(carte)}</div>}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── Patients View ────────────────────────────────────────────
function PatientsView({ patients, setPatients, user, token, sb, appointments }) {
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const [form, setForm] = React.useState({ nom:"", email:"", telephone:"", notes:"", categorie:"autre" });
  const [importing, setImporting] = React.useState(false);
  const [editingPatient, setEditingPatient] = React.useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = React.useState(false);
  const [sortBy, setSortBy] = React.useState("nom"); // nom | date | rdv
  const [confirmClean, setConfirmClean] = React.useState(false);

  const isDirtyContact = (p) => {
    const nom = p.nom || "";
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

  const handleCleanContacts = async () => {
    for (const p of dirtyContacts) {
      await sb.deletePatient(token, p.id);
    }
    setPatients(prev => prev.filter(p => !isDirtyContact(p)));
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
    beaute:"#ec4899", formation:"#10b981", pro:"#1e3a5f", perso:"#64748b", autre:"#94a3b8"
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

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      // Parser CSV robuste (gère les virgules dans les champs entre guillemets)
      const parseCSVLine = (line) => {
        const result = []; let cur = ""; let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '"') { inQuotes = !inQuotes; }
          else if (line[i] === ',' && !inQuotes) { result.push(cur.trim()); cur = ""; }
          else { cur += line[i]; }
        }
        result.push(cur.trim());
        return result;
      };
      const lines = evt.target.result.split("\n").filter(Boolean);
      const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g,"").trim());
      let added = 0;
      for (let i = 1; i < lines.length; i++) {
        const vals = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((h, idx) => row[h] = (vals[idx]||"").replace(/"/g,"").trim());

        // Support format Google Contacts / Outlook (First Name, Last Name, Mobile Phone...)
        const firstName = row["First Name"] || row["Prénom"] || row["prenom"] || "";
        const middleName = row["Middle Name"] || "";
        const lastName = row["Last Name"] || row["Nom"] || row["nom"] || "";
        const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
        const nom = fullName || row["nom"] || row["name"] || row["Name"] || vals[0] || "";
        if (!nom) continue;
        // Ignorer les contacts sans vrai nom (que des virgules, chiffres, emails)
        if (/^[,;\s\d@.+\-_]+$/.test(nom)) continue;
        if (nom.length < 2) continue;
        if (nom.length > 50) continue;
        // Ignorer données encodées base64/vCard
        if (/^[+\/=]/.test(nom)) continue;
        if (/^[A-Za-z0-9+/=]{20,}/.test(nom.replace(/\s/g, ""))) continue;
        if (nom.includes("=20=") || nom.includes("=4") || nom.includes("=6")) continue;
        if (/[A-Za-z0-9+/]{30,}/.test(nom)) continue;
        if (/^[\/+][A-Za-z0-9]{10,}/.test(nom)) continue;

        const email = row["E-mail Address"] || row["E-mail 2 Address"] || row["email"] || row["Email"] || row["mail"] || "";
        const telephone = row["Mobile Phone"] || row["Home Phone"] || row["Primary Phone"] || row["Business Phone"] || row["telephone"] || row["Téléphone"] || row["phone"] || "";

        const exists = patients.find(p => p.nom.toLowerCase() === nom.toLowerCase());
        if (!exists) {
          const res = await sb.addPatient(token, user.id, { nom, email, telephone, notes: row.notes||row.Notes||"", categorie:"autre" });
          if (Array.isArray(res) && res[0]) { setPatients(prev => [...prev, res[0]]); added++; }
        }
      }
      setImporting(false);
      alert(tr(`${added} client(s) importé(s) avec succès !`, `${added} client(s) imported successfully!`));
    };
    reader.readAsText(file);
  };

  const handleDeleteAll = async () => {
    for (const p of patients) {
      await sb.deletePatient(token, p.id);
    }
    setPatients([]);
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
              <button onClick={handleCleanContacts} style={{ flex:2, background:"#f97316", color:"#fff", border:"none", borderRadius:8, padding:"12px", cursor:"pointer", fontWeight:700, fontSize:14 }}>
                {tr(`🧹 Supprimer ces ${dirtyContacts.length} contacts`, `🧹 Delete these ${dirtyContacts.length} contacts`)}
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
            <div style={{ fontWeight:800, fontSize:18, marginBottom:20 }}>{tr("✏️ Modifier la fiche client","✏️ Edit client")}</div>
            {[
              { key:"nom", label:tr("NOM COMPLET *","FULL NAME *"), placeholder:tr("Nom complet","Full name"), type:"text" },
              { key:"email", label:"EMAIL", placeholder:"email@...", type:"email" },
              { key:"telephone", label:tr("TÉLÉPHONE","PHONE"), placeholder:tr("06...","Phone number"), type:"text" },
              { key:"date_naissance", label:tr("DATE DE NAISSANCE","DATE OF BIRTH"), placeholder:tr("JJ/MM/AAAA","DD/MM/YYYY"), type:"text" },
              { key:"adresse", label:tr("ADRESSE COMPLÈTE","FULL ADDRESS"), placeholder:tr("12 rue de la Paix, 75001 Paris","12 High Street, London"), type:"text" },
            ].map(field => (
              <div key={field.key} style={{ marginBottom:14 }}>
                <div className="field-label">{field.label}</div>
                <input type={field.type} placeholder={field.placeholder} defaultValue={editingPatient[field.key]||""} id={`edit-${field.key}`} />
              </div>
            ))}
            <div style={{ marginBottom:20 }}>
              <div className="field-label">NOTES</div>
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
      {/* Liste patients */}
      <div className="pv-left" style={{ width:320, borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
        <div style={{ padding:"16px", borderBottom:"1px solid #e2e8f0", background:"#fff" }}>
          <div style={{ marginBottom:10 }}>
            <input placeholder={tr("🔍 Rechercher un client...","🔍 Search a client...")} value={search} onChange={e=>setSearch(e.target.value)} style={{ width:"100%", fontSize:14, padding:"12px 16px" }} />
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center" }}>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ fontSize:12, padding:"8px 12px", borderRadius:8, border:"1px solid var(--border)", background:"var(--input-bg)", color:"var(--text)", cursor:"pointer", flex:1 }}>
              <option value="nom">{tr("Tri : A → Z","Sort: A → Z")}</option>
              <option value="rdv">{tr("Tri : Plus de RDV","Sort: Most appointments")}</option>
              <option value="date">{tr("Tri : Plus récents","Sort: Most recent")}</option>
            </select>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn btn-primary btn-sm" onClick={()=>setShowAdd(true)} style={{ flex:1 }}>{tr("+ Ajouter","+ Add")}</button>
            <label style={{ flex:1 }}>
              <div className="btn btn-outline btn-sm" style={{ textAlign:"center", cursor:"pointer" }}>
                {importing ? "⏳" : "📥 CSV"}
              </div>
              <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display:"none" }} />
            </label>
            {dirtyContacts.length > 0 && (
              <button className="btn btn-sm" onClick={()=>setConfirmClean(true)} style={{ background:"#fff8f0", border:"1px solid #fed7aa", color:"#f97316", borderRadius:8, padding:"6px 10px", cursor:"pointer", fontSize:12 }}>
                🧹 {dirtyContacts.length}
              </button>
            )}
            <button className="btn btn-sm" onClick={()=>setConfirmDeleteAll(true)} style={{ background:"#fff5f5", border:"1px solid #fecaca", color:"#ef4444", borderRadius:8, padding:"6px 10px", cursor:"pointer", fontSize:12 }}>{tr("🗑️ Tout","🗑️ All")}</button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 20px" }}>
              <div style={{ fontSize:36, marginBottom:8 }}>👥</div>
              <div style={{ color:"#94a3b8", fontSize:13 }}>{tr("Aucun client trouvé","No clients found")}</div>
              <div style={{ color:"#cbd5e1", fontSize:11, marginTop:4 }}>{tr("Ils s'ajoutent automatiquement à chaque RDV","They are added automatically with each appointment")}</div>
            </div>
          ) : filtered.map(p => (
            <div key={p.id} onClick={()=>{ setSelected(p); setTimeout(()=>{ document.getElementById("patients-right-panel")?.scrollTo({top:0,behavior:"smooth"}); window.scrollTo({top:0,behavior:"smooth"}); }, 50); }}
              style={{ padding:"14px 16px", borderBottom:"1px solid #f1f5f9", cursor:"pointer", background:selected?.id===p.id?"#f0f4ff":"#fff", display:"flex", alignItems:"center", gap:12, transition:"background .15s" }}>
              <div style={{ width:38, height:38, borderRadius:"50%", background:catColors[p.categorie]||"#94a3b8", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:15, flexShrink:0 }}>
                {p.nom[0]?.toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13, color:"#1e293b", marginBottom:2 }}>{p.nom}</div>
                <div style={{ fontSize:11, color:"#94a3b8" }}>{getPatientRdvs(p.nom).length} {tr("RDV","appt.")}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:"12px 16px", borderTop:"1px solid #e2e8f0", background:"#f8fafc" }}>
          <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"DM Mono" }}>{tr(`${patients.length} client(s) au total`, `${patients.length} client(s) in total`)}</div>
        </div>
      </div>

      {/* Fiche patient */}
      <div id="patients-right-panel" className="pv-right" style={{ flex:1, overflowY:"auto", padding:24 }}>
        {(selected || showAdd) && (
          <button className="pv-back" onClick={()=>{ setSelected(null); setShowAdd(false); }}
            style={{ display:"none", background:"none", border:"none", color:"#1e3a5f", fontWeight:700, fontSize:15, cursor:"pointer", padding:"4px 0", marginBottom:14 }}>
            {tr("← Retour aux clients","← Back to clients")}
          </button>
        )}
        {showAdd ? (
          <div className="card fade-up" style={{ maxWidth:480 }}>
            <div style={{ fontWeight:800, fontSize:18, marginBottom:20 }}>{tr("➕ Nouveau client","➕ New client")}</div>
            <div style={{ marginBottom:14 }}><div className="field-label">{tr("NOM *","NAME *")}</div><input placeholder={tr("Nom complet","Full name")} value={form.nom} onChange={e=>setForm(p=>({...p,nom:e.target.value}))} /></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
              <div><div className="field-label">EMAIL</div><input type="email" placeholder="email@..." value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} /></div>
              <div><div className="field-label">{tr("TÉLÉPHONE","PHONE")}</div><input placeholder={tr("06...","Phone number")} value={form.telephone} onChange={e=>setForm(p=>({...p,telephone:e.target.value}))} /></div>
            </div>
            <div style={{ marginBottom:14 }}><div className="field-label">NOTES</div><textarea rows={3} placeholder={tr("Informations importantes...","Important information...")} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} /></div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="btn btn-outline" onClick={()=>setShowAdd(false)} style={{ flex:1 }}>{tr("Annuler","Cancel")}</button>
              <button className="btn btn-primary" onClick={handleAdd} style={{ flex:2 }}>{tr("Ajouter le client","Add client")}</button>
            </div>
          </div>
        ) : selected ? (
          <div className="fade-up" id="fiche-patient">
            {/* Header fiche */}
            <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:24 }}>
              <div style={{ width:56, height:56, borderRadius:"50%", background:catColors[selected.categorie]||"#94a3b8", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:22, flexShrink:0 }}>
                {selected.nom[0]?.toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800, fontSize:22, color:"#1e293b" }}>{selected.nom}</div>
                <div style={{ fontSize:12, color:"#94a3b8" }}>{tr("Client depuis","Client since")} {new Date(selected.created_at).toLocaleDateString(locale())} · {getPatientRdvs(selected.nom).length} {tr("RDV","appt.")}</div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setEditingPatient(selected)} style={{ background:"#f0f4ff", border:"1px solid #1e3a5f30", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontSize:12, color:"#1e3a5f", fontWeight:600 }}>{tr("✏️ Modifier","✏️ Edit")}</button>
                <button onClick={()=>handleDelete(selected.id)} style={{ background:"#fff5f5", border:"1px solid #fecaca", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontSize:12, color:"#ef4444", fontWeight:600 }}>🗑️</button>
              </div>
            </div>

            {/* Coordonnées */}
            <div className="card" style={{ marginBottom:16 }}>
              <div className="field-label" style={{ marginBottom:14 }}>{tr("COORDONNÉES","CONTACT DETAILS")}</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                {[
                  { icon:"📧", label:"Email", value:selected.email },
                  { icon:"📞", label:tr("Téléphone","Phone"), value:selected.telephone },
                  { icon:"🎂", label:tr("Date de naissance","Date of birth"), value:selected.date_naissance },
                  { icon:"📍", label:tr("Adresse","Address"), value:selected.adresse },
                ].map(({icon,label,value}) => (
                  <div key={label} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                    <span style={{ fontSize:18, marginTop:1 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"DM Mono", marginBottom:2 }}>{label}</div>
                      <div style={{ fontSize:13, fontWeight:600, color: value ? "#1e293b" : "#cbd5e1" }}>{value || tr("Non renseigné","Not provided")}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {selected.notes && (
              <div className="card" style={{ marginBottom:16 }}>
                <div className="field-label" style={{ marginBottom:8 }}>📝 NOTES</div>
                <div style={{ fontSize:13, color:"#475569", lineHeight:1.7 }}>{selected.notes}</div>
              </div>
            )}

            {/* Historique RDV */}
            <div className="card">
              <div className="field-label" style={{ marginBottom:12 }}>{tr("📅 HISTORIQUE DES RDV","📅 APPOINTMENT HISTORY")}</div>
              {getPatientRdvs(selected.nom).length === 0 ? (
                <div style={{ color:"#94a3b8", fontSize:13, padding:"20px 0", textAlign:"center" }}>{tr("Aucun RDV enregistré pour ce client","No appointments for this client yet")}</div>
              ) : getPatientRdvs(selected.nom).sort((a,b) => b.date > a.date ? 1 : -1).map((rdv,i) => (
                <div key={i} style={{ display:"flex", gap:12, alignItems:"center", padding:"12px 0", borderBottom:"1px solid #f1f5f9" }}>
                  <div style={{ width:4, height:48, borderRadius:4, background:catColors[rdv.categorie]||"#94a3b8", flexShrink:0 }}></div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:13, marginBottom:2 }}>{rdv.titre||tr("Rendez-vous","Appointment")}</div>
                    <div style={{ fontSize:11, color:"#94a3b8" }}>📅 {fmtRdv(rdv.date, rdv.heure)}</div>
                    {rdv.lieu && <div style={{ fontSize:11, color:"#94a3b8" }}>📍 {rdv.lieu}</div>}
                  </div>
                  <div style={{ fontSize:11, background:(catColors[rdv.categorie]||"#94a3b8")+"20", color:catColors[rdv.categorie]||"#94a3b8", padding:"3px 10px", borderRadius:20, fontWeight:600 }}>
                    {catLabel(rdv.categorie||"autre")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign:"center", padding:"80px 40px" }}>
            <div style={{ fontSize:56, marginBottom:16 }}>👥</div>
            <div style={{ fontWeight:700, fontSize:18, color:"#1e293b", marginBottom:8 }}>{tr("Vos clients","Your clients")}</div>
            <div style={{ color:"#94a3b8", fontSize:14, lineHeight:1.7 }}>{tr(<>Sélectionnez un client pour voir sa fiche,<br/>ou ajoutez-en un manuellement.<br/><br/>💡 Ils s'ajoutent automatiquement à chaque nouveau RDV !</>, <>Select a client to see their profile,<br/>or add one manually.<br/><br/>💡 They are added automatically with each new appointment!</>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Paramètres Modal ─────────────────────────────────────────
function SettingsModal({ user, onSave, onClose, sb, token }) {
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
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const toggleRappel = (val) => {
    setRappels(prev => prev.includes(val) ? prev.filter(r=>r!==val) : [...prev, val]);
  };

  const handleSave = async () => {
    setSaving(true);
    const data = { rappels, email, push_enabled: pushEnabled, push_j3: pushJ3, push_j1: pushJ1, push_confirm: pushConfirm };
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
      style={{ width:44, height:24, borderRadius:12, background:value?"#1e3a5f":"#e2e8f0", cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}>
      <div style={{ position:"absolute", top:3, left:value?20:3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left .2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}></div>
    </div>
  );
  const darkOn = document.documentElement.style.getPropertyValue("--bg")==="#0a0f1e";

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000040", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24, overflowY:"auto" }}>
      <div className="card fade-up" style={{ width:"100%", maxWidth:420, padding:28, maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ fontWeight:800, fontSize:20, marginBottom:4, color:"#1e293b" }}>{tr("⚙️ Paramètres","⚙️ Settings")}</div>
        <div style={{ fontSize:13, color:"#94a3b8", marginBottom:24 }}>{tr("Configurez vos rappels de rendez-vous","Set up your appointment reminders")}</div>

        {/* Langue */}
        <div style={{ marginBottom:20 }}>
          <div className="field-label">{tr("LANGUE","LANGUAGE")}</div>
          <div style={{ marginTop:8 }}><LangSwitch /></div>
        </div>

        <div style={{ marginBottom:20 }}>
          <div className="field-label">{tr("EMAIL POUR LES RAPPELS","EMAIL FOR REMINDERS")}</div>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={tr("votre@email.com","your@email.com")} />
          <div style={{ fontSize:11, color:"#94a3b8", marginTop:6 }}>{tr("Vos rappels seront envoyés à cette adresse","Your reminders will be sent to this address")}</div>
        </div>

        <div style={{ marginBottom:24 }}>
          <div className="field-label">{tr("QUAND ENVOYER LES RAPPELS","WHEN TO SEND REMINDERS")}</div>
          <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>{tr("Pour vous, et pour vos clients dont l'email est renseigné.","For you, and for your clients whose email is provided.")}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:8 }}>
            {options.map(opt => (
              <div key={opt.value} onClick={()=>toggleRappel(opt.value)}
                style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 16px", borderRadius:10, border:`1.5px solid ${rappels.includes(opt.value)?"#1e3a5f":"#e2e8f0"}`, background:rappels.includes(opt.value)?"#f0f4ff":"#fff", cursor:"pointer", transition:"all .2s" }}>
                <span style={{ fontSize:20 }}>{opt.icon}</span>
                <span style={{ fontWeight:600, fontSize:14, color:rappels.includes(opt.value)?"#1e3a5f":"#475569" }}>{opt.label}</span>
                <div style={{ marginLeft:"auto", width:20, height:20, borderRadius:"50%", border:`2px solid ${rappels.includes(opt.value)?"#1e3a5f":"#cbd5e1"}`, background:rappels.includes(opt.value)?"#1e3a5f":"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
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
            <button onClick={requestPushPermission} style={{ width:"100%", background:"#f0f4ff", border:"1px solid #1e3a5f30", borderRadius:10, padding:"12px 16px", cursor:"pointer", fontSize:13, fontWeight:600, color:"#1e3a5f", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
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
      { key:"telephone", label:tr("TÉLÉPHONE","PHONE"), placeholder:tr("06...","Phone number"), type:"text" },
      { key:"motif", label:tr("MOTIF DE CONSULTATION","REASON FOR VISIT"), placeholder:tr("Douleur, contrôle, renouvellement...","Pain, check-up, prescription renewal..."), type:"text" },
      { key:"medecin", label:tr("MÉDECIN / SPÉCIALISTE","DOCTOR / SPECIALIST"), placeholder:tr("Dr. Martin, Cardiologue...","Dr Smith, cardiologist..."), type:"text" },
    ],
    restaurant: [
      { key:"nb_personnes", label:tr("NOMBRE DE PERSONNES","NUMBER OF GUESTS"), placeholder:"2", type:"number" },
      { key:"heure_arrivee", label:tr("HEURE D'ARRIVÉE","ARRIVAL TIME"), placeholder:tr("20h00","8:00 PM"), type:"text" },
      { key:"demandes", label:tr("DEMANDES SPÉCIALES","SPECIAL REQUESTS"), placeholder:tr("Table en terrasse, anniversaire, allergie...","Terrace table, birthday, allergy..."), type:"text" },
    ],
    garage: [
      { key:"vehicule", label:tr("MARQUE / MODÈLE","MAKE / MODEL"), placeholder:tr("Renault Clio, Peugeot 308...","Ford Focus, VW Golf..."), type:"text" },
      { key:"immat", label:tr("IMMATRICULATION","REGISTRATION"), placeholder:tr("AB-123-CD","AB12 CDE"), type:"text" },
      { key:"intervention", label:tr("TYPE D'INTERVENTION","TYPE OF WORK"), placeholder:tr("Révision, freins, courroie...","Service, brakes, timing belt..."), type:"text" },
    ],
    juridique: [
      { key:"type_dossier", label:tr("TYPE DE DOSSIER","TYPE OF CASE"), placeholder:tr("Succession, divorce, immobilier...","Probate, divorce, property..."), type:"text" },
      { key:"documents", label:tr("DOCUMENTS À APPORTER","DOCUMENTS TO BRING"), placeholder:tr("CNI, contrat, acte...","ID, contract, deed..."), type:"text" },
    ],
    travaux: [
      { key:"type_travaux", label:tr("TYPE DE TRAVAUX","TYPE OF WORK"), placeholder:tr("Plomberie, électricité, peinture...","Plumbing, electrics, painting..."), type:"text" },
      { key:"acces", label:tr("ACCÈS / DIGICODE","ACCESS / DOOR CODE"), placeholder:tr("Code d'accès, étage, interphone...","Door code, floor, intercom..."), type:"text" },
    ],
    beaute: [
      { key:"prestation", label:tr("PRESTATION","SERVICE"), placeholder:tr("Coupe, couleur, brushing...","Cut, colour, blow-dry..."), type:"text" },
      { key:"coiffeur", label:tr("PRÉFÉRENCE COIFFEUR","PREFERRED STYLIST"), placeholder:tr("Nom du coiffeur souhaité","Preferred stylist's name"), type:"text" },
    ],
    banque: [
      { key:"type_rdv", label:tr("TYPE DE RDV","TYPE OF APPOINTMENT"), placeholder:tr("Crédit, investissement, compte...","Loan, investment, account..."), type:"text" },
      { key:"documents", label:tr("DOCUMENTS À APPORTER","DOCUMENTS TO BRING"), placeholder:tr("Bulletins de salaire, avis d'imposition...","Payslips, tax return..."), type:"text" },
    ],
    veterinaire: [
      { key:"animal", label:tr("NOM DE L'ANIMAL","PET'S NAME"), placeholder:tr("Rex, Mimi...","Max, Bella..."), type:"text" },
      { key:"espece", label:tr("ESPÈCE / RACE","SPECIES / BREED"), placeholder:tr("Chien Labrador, Chat Siamois...","Labrador dog, Siamese cat..."), type:"text" },
      { key:"motif_veto", label:tr("MOTIF","REASON"), placeholder:tr("Vaccination, contrôle, urgence...","Vaccination, check-up, emergency..."), type:"text" },
    ],
  };

  const champs = champsSpecifiques[form.categorie] || [];

  return (
    <div className="form-open" style={{ maxWidth:560 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:28 }}>
        <div style={{ width:48, height:48, background:"#1e3a5f20", border:"1px solid #1e3a5f40", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>📋</div>
        <div>
          <div style={{ fontWeight:800, fontSize:22, letterSpacing:"-0.02em" }}>{tr("Nouveau rendez-vous","New appointment")}</div>
          <div style={{ fontSize:12, color:"#94a3b8", fontFamily:"DM Mono", marginTop:2 }}>{tr("Remplissez les détails de votre appel","Fill in the details of your call")}</div>
        </div>
      </div>

      {/* Categorie */}
      <div style={{ marginBottom:20 }}>
        <div className="field-label">{tr("TYPE DE RDV","APPOINTMENT TYPE")}</div>
        <select value={form.categorie} onChange={e=>handleCategorie(e.target.value)}
          style={{ appearance:"none", WebkitAppearance:"none", backgroundImage:"url('data:image/svg+xml;utf8,<svg fill=\"%23c8f542\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path d=\"M7 10l5 5 5-5z\"/></svg>')", backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center", backgroundSize:20, paddingRight:40 }}>
          {categories.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Titre */}
      <div style={{ marginBottom:16 }}>
        <div className="field-label">{tr("TITRE DU RDV","TITLE")}</div>
        <input placeholder={tr("Ex: Consultation Dr. Martin, Révision Renault...","e.g. Dr Smith check-up, Ford service...")} value={form.titre} onChange={e=>set("titre",e.target.value)} />
      </div>

      {/* Personne + Date */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
        <div>
          <div className="field-label">{tr("PERSONNE / CONTACT *","PERSON / CONTACT *")}</div>
          <div style={{ position:"relative" }}>
            <input
              placeholder={tr("Dr. Martin, Garage Renault...","Name of the person")}
              value={form.personne}
              onChange={e=>{ set("personne",e.target.value); setShowSuggestions(true); }}
              onFocus={()=>setShowSuggestions(true)}
              onBlur={()=>setTimeout(()=>setShowSuggestions(false), 200)}
              style={{ paddingRight:42 }}
              autoComplete="off"
            />
            {showSuggestions && form.personne && (() => {
              const allPatients = window.__patients || [];
              const matches = allPatients.filter(p => p.nom && p.nom.toLowerCase().includes(form.personne.toLowerCase()) && p.nom.toLowerCase() !== form.personne.toLowerCase()).slice(0, 6);
              if (matches.length === 0) return null;
              return (
                <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#fff", border:"1px solid #e2e8f0", borderRadius:"0 0 10px 10px", zIndex:50, maxHeight:200, overflowY:"auto", boxShadow:"0 4px 16px rgba(0,0,0,0.08)" }}>
                  {matches.map(p => (
                    <div
                      key={p.id}
                      onMouseDown={(e)=>{ e.preventDefault(); set("personne", p.nom); if (p.email) set("client_email", p.email); setShowSuggestions(false); }}
                      style={{ padding:"10px 14px", cursor:"pointer", borderBottom:"1px solid #f1f5f9", fontSize:13, color:"#1e293b" }}
                      onMouseEnter={e=>e.currentTarget.style.background="#f0f4ff"}
                      onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                      <div style={{ fontWeight:600 }}>{p.nom}</div>
                      {p.telephone && <div style={{ fontSize:11, color:"#94a3b8" }}>📞 {p.telephone}</div>}
                    </div>
                  ))}
                </div>
              );
            })()}
            <button onClick={speechPersonne.listening ? speechPersonne.stop : speechPersonne.start}
              style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:18, color: speechPersonne.listening ? "#ff4444" : "#1e3a5f" }}>
              {speechPersonne.listening ? "⏹" : "🎤"}
            </button>
          </div>
        </div>
        <div>
          <div className="field-label">{tr("DATE *","DATE *")}</div>
          <input type="date" value={form.date} onChange={e=>set("date",e.target.value)}
            style={{ colorScheme:"dark" }} />
        </div>
      </div>

      {/* Heure */}
      <div style={{ marginBottom:16 }}>
        <div className="field-label">{tr("HEURE","TIME")}</div>
        <input type="time" value={form.heure} onChange={e=>set("heure",e.target.value)}
          style={{ colorScheme:"dark" }} />
      </div>

      {/* Email du client : rappel automatique */}
      <div style={{ marginBottom:16 }}>
        <div className="field-label">{tr("EMAIL DU CLIENT","CLIENT EMAIL")}</div>
        <input type="email" inputMode="email" autoComplete="off" placeholder={tr("client@email.com (facultatif)","client@email.com (optional)")} value={form.client_email} onChange={e=>set("client_email",e.target.value)} />
        <div style={{ fontSize:11, color:"#94a3b8", marginTop:6 }}>{tr("📧 Si vous le renseignez, votre client reçoit un rappel automatique avant son RDV.","📧 If you fill it in, your client gets an automatic reminder before the appointment.")}</div>
      </div>

      {/* Bouton Plus de détails */}
      <div style={{ marginBottom:showMore?20:16 }}>
        <button type="button" onClick={()=>setShowMore(s=>!s)} style={{ background:"transparent", border:"1px dashed #cbd5e1", borderRadius:10, padding:"10px 16px", width:"100%", cursor:"pointer", color:"#64748b", fontSize:13, fontWeight:600, fontFamily:"Inter, sans-serif" }}>
          {showMore ? tr("− Moins de détails","− Fewer details") : tr("+ Plus de détails (lieu, adresse, notes...)","+ More details (place, address, notes...)")}
        </button>
      </div>

      {showMore && <>

      {/* Lieu + Adresse */}
      <div style={{ marginBottom:16 }}>
        <div className="field-label">{tr("LIEU","PLACE")}</div>
        <div style={{ position:"relative" }}>
          <input placeholder={tr("Ex: Cabinet médical, Garage Renault, Domicile...","e.g. Clinic, garage, client's home...")} value={form.lieu} onChange={e=>set("lieu",e.target.value)} style={{ paddingRight:42 }} />
          <button onClick={speechLieu.listening ? speechLieu.stop : speechLieu.start}
            style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:18, color: speechLieu.listening ? "#ff4444" : "#1e3a5f" }}>
            {speechLieu.listening ? "⏹" : "🎤"}
          </button>
        </div>
      </div>
      <div style={{ marginBottom:16 }}>
        <div className="field-label">{tr("ADRESSE COMPLÈTE","FULL ADDRESS")}</div>
        <input placeholder={tr("Ex: 12 rue de la Paix, 75001 Paris...","e.g. 12 High Street, London...")} value={form.adresse} onChange={e=>set("adresse",e.target.value)} />
      </div>

      {/* Champs dynamiques par catégorie */}
      {champs.length > 0 && (
        <div style={{ background:"#f8faff", border:"1px solid #e2e8f0", borderRadius:12, padding:16, marginBottom:20 }}>
          <div style={{ fontSize:11, color:"#1e3a5f", fontFamily:"DM Mono", fontWeight:700, marginBottom:14 }}>
            {tr("✨ INFORMATIONS SPÉCIFIQUES","✨ SPECIFIC DETAILS")}
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
        <div className="field-label">{tr("NOTES / INFORMATIONS COMPLÉMENTAIRES","NOTES / EXTRA INFORMATION")}</div>
        <div style={{ position:"relative" }}>
          <textarea rows={3} placeholder={tr("Documents à apporter, motif de la visite, informations importantes...","Documents to bring, reason for the visit, important information...")} value={form.notes} onChange={e=>set("notes",e.target.value)} style={{ paddingRight:48 }} />
          <button onClick={speechNotes.listening ? speechNotes.stop : speechNotes.start}
            style={{ position:"absolute", right:10, top:12, background:"none", border:"none", cursor:"pointer", fontSize:20, color: speechNotes.listening ? "#ff4444" : "#1e3a5f" }}>
            {speechNotes.listening ? "⏹" : "🎤"}
          </button>
        </div>
        {speechNotes.listening && (
          <div style={{ fontSize:11, color:"#ff4444", fontFamily:"DM Mono", marginTop:6, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ animation:"blink 1s infinite", display:"inline-block" }}>●</span> {tr("Parlez maintenant...","Speak now...")}
          </div>
        )}
      </div>

      {/* Privacy badge */}
      <div className="privacy-badge" style={{ marginBottom:20 }}>
        <span style={{ fontSize:14 }}>🔒</span>
        <div style={{ fontSize:11, color:"#0369a1", fontFamily:"DM Mono", lineHeight:1.5 }}>
          <span style={{ color:"#0284c7", fontWeight:700 }}>{tr("Données protégées — ","Data protected — ")}</span>
          {tr("Hébergées en Europe, accessibles uniquement depuis votre compte. Conforme RGPD.","Hosted in Europe, only accessible from your account. GDPR compliant.")}
        </div>
      </div>

      </>}

      {/* Buttons */}
      <div style={{ display:"flex", gap:10 }}>
        <button className="btn btn-outline" onClick={onCancel} style={{ flex:1 }}>{tr("Annuler","Cancel")}</button>
        <button className="btn btn-primary" onClick={()=>isValid&&onSave({ ...form, confirmedAt:new Date().toLocaleTimeString(locale()) })}
          disabled={!isValid} style={{ flex:2, padding:"15px" }}>
          {tr("✓ Enregistrer le RDV","✓ Save appointment")}
        </button>
      </div>
      {!isValid && <div style={{ fontSize:11, color:"#ff9a3c", fontFamily:"DM Mono", marginTop:10, textAlign:"center" }}>{tr("⚠ Personne et date sont obligatoires","⚠ Person and date are required")}</div>}
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
          "apikey": CONFIG.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
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
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#94a3b8" }}>✕</button>
        </div>
        <div style={{ padding:"28px 32px" }}>
          {sent ? (
            <div style={{ textAlign:"center", padding:"20px 0" }}>
              <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
              <div style={{ fontWeight:700, fontSize:18, color:"#1e293b", marginBottom:8 }}>{t("Message envoyé !","Message sent!")}</div>
              <div style={{ fontSize:14, color:"#64748b", marginBottom:24 }}>{t("Nous vous répondrons dans les plus brefs délais.","We will get back to you as soon as possible.")}</div>
              <button onClick={onClose} style={{ background:"#1e3a5f", color:"#fff", border:"none", borderRadius:10, padding:"12px 32px", cursor:"pointer", fontWeight:700 }}>{t("Fermer","Close")}</button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"DM Mono", marginBottom:6 }}>{t("VOTRE NOM","YOUR NAME")}</div>
                <input value={nom} onChange={e=>setNom(e.target.value)} placeholder={t("Nom complet","Full name")} style={{ width:"100%", padding:"11px 14px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14, fontFamily:"DM Sans, sans-serif" }} />
              </div>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"DM Mono", marginBottom:6 }}>{t("VOTRE EMAIL","YOUR EMAIL")}</div>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@..." style={{ width:"100%", padding:"11px 14px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14, fontFamily:"DM Sans, sans-serif" }} />
              </div>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"DM Mono", marginBottom:6 }}>MESSAGE</div>
                <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder={t("Votre message...","Your message...")} rows={4} style={{ width:"100%", padding:"11px 14px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14, fontFamily:"DM Sans, sans-serif", resize:"vertical" }} />
              </div>
              {error && <div style={{ color:"#ef4444", fontSize:13, marginBottom:14 }}>⚠️ {error}</div>}
              <button onClick={handleSend} disabled={sending} style={{ width:"100%", background:"#1e3a5f", color:"#fff", border:"none", borderRadius:10, padding:"13px", cursor:"pointer", fontWeight:700, fontSize:14, opacity:sending?0.7:1 }}>
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
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#94a3b8" }}>✕</button>
        </div>
        <div style={{ padding:"24px 32px", overflowY:"auto", flex:1 }}>
          <pre style={{ fontFamily:"DM Sans, sans-serif", fontSize:13, color:"#475569", lineHeight:1.8, whiteSpace:"pre-wrap" }}>{content}</pre>
        </div>
        <div style={{ padding:"16px 32px", borderTop:"1px solid #e2e8f0", textAlign:"center" }}>
          <button onClick={onClose} style={{ background:"#1e3a5f", color:"#fff", border:"none", borderRadius:10, padding:"12px 32px", cursor:"pointer", fontWeight:700, fontSize:14 }}>
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
    @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
    .lp-body { font-family: "DM Sans", sans-serif; background: #fafaf8; color: #0f2340; overflow-x: hidden; }
    .lp-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 20px 60px; background: rgba(250,250,248,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid #e2e8f0; }
    .lp-login-mobile { display: none; background: #fff; color: #0f2340; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 12px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
    @media(max-width:768px){ .lp-login-mobile { display: inline-block; } }
    .lp-logo { font-family: "Instrument Serif", serif; font-size: 22px; color: #0f2340; display: flex; align-items: center; gap: 10px; }
    .lp-logo span { background: #0f2340; color: #fff; border-radius: 8px; padding: 4px 10px; font-size: 12px; font-family: "DM Mono", monospace; }
    .lp-nav-links { display: flex; align-items: center; gap: 28px; }
    .lp-nav-links a { text-decoration: none; color: #64748b; font-size: 14px; font-weight: 500; transition: color .2s; }
    .lp-nav-links a:hover { color: #0f2340; }
    .lp-btn-nav { background: #0f2340 !important; color: #fff !important; padding: 10px 22px; border-radius: 8px; cursor: pointer; border: none; font-size: 14px; font-weight: 600; font-family: "DM Sans", sans-serif; }
    .lp-hero { min-height: 100vh; display: flex; align-items: center; padding: 120px 60px 80px; position: relative; overflow: hidden; background: linear-gradient(135deg, #f8faff 0%, #eef4fb 50%, #f8faff 100%); }
    .lp-hero-grid { position: absolute; inset: 0; background-image: linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px); background-size: 60px 60px; opacity: 0.4; }
    .lp-hero-content { position: relative; z-index: 1; max-width: 600px; }
    .lp-badge { display: inline-flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #e2e8f0; border-radius: 100px; padding: 6px 16px; font-size: 12px; font-family: "DM Mono", monospace; color: #1e3a5f; margin-bottom: 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .lp-badge::before { content: ""; width: 6px; height: 6px; background: #22c55e; border-radius: 50%; display: inline-block; }
    .lp-h1 { font-family: "Instrument Serif", serif; font-size: clamp(40px,5vw,62px); line-height: 1.1; color: #0f2340; margin-bottom: 24px; }
    .lp-h1 em { font-style: italic; color: #2d5a8e; }
    .lp-sub { font-size: 18px; color: #64748b; line-height: 1.7; margin-bottom: 40px; font-weight: 300; }
    .lp-actions { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
    .lp-btn-primary { background: #0f2340; color: #fff; padding: 14px 28px; border-radius: 10px; font-size: 15px; font-weight: 600; text-decoration: none; cursor: pointer; border: none; font-family: "DM Sans", sans-serif; box-shadow: 0 4px 16px rgba(30,58,95,0.3); transition: all .2s; }
    .lp-btn-primary:hover { background: #2d5a8e; transform: translateY(-1px); }
    .lp-btn-secondary { color: #0f2340; padding: 14px 28px; border-radius: 10px; font-size: 15px; font-weight: 500; text-decoration: none; border: 1px solid #e2e8f0; background: #fff; transition: all .2s; }
    .lp-btn-secondary:hover { background: #f0f4f8; }
    .lp-mockup { width: 440px; background: #fff; border-radius: 16px; box-shadow: 0 24px 64px rgba(15,35,64,0.15); overflow: hidden; border: 1px solid #e2e8f0; position: absolute; right: 60px; top: 50%; transform: translateY(-50%); z-index: 1; }
    .lp-mockup-bar { background: #0f2340; padding: 14px 20px; display: flex; align-items: center; gap: 8px; }
    .lp-dot { width: 10px; height: 10px; border-radius: 50%; }
    .lp-mockup-title { color: #fff; font-size: 12px; font-family: "DM Mono", monospace; margin-left: 8px; }
    .lp-mockup-body { padding: 20px; }
    .lp-search { background: #f0f4f8; border-radius: 8px; padding: 11px 14px; font-size: 12px; color: #94a3b8; margin-bottom: 16px; }
    .lp-rdv { background: #f8faff; border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; }
    .lp-rdv-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .lp-rdv-title { font-size: 12px; font-weight: 600; color: #0f2340; }
    .lp-rdv-sub { font-size: 10px; color: #94a3b8; margin-top: 2px; }
    .lp-rdv-tag { margin-left: auto; font-size: 10px; padding: 2px 8px; border-radius: 20px; font-family: "DM Mono", monospace; }
    .lp-stats { display: grid; grid-template-columns: repeat(4,1fr); background: #0f2340; }
    .lp-stat { padding: 32px 20px; text-align: center; border-right: 1px solid rgba(255,255,255,0.1); }
    .lp-stat:last-child { border-right: none; }
    .lp-stat-num { font-family: "Instrument Serif", serif; font-size: 40px; color: #fff; }
    .lp-stat-label { font-size: 11px; color: rgba(255,255,255,0.45); font-family: "DM Mono", monospace; margin-top: 6px; }
    .lp-section { padding: 90px 60px; max-width: 1200px; margin: 0 auto; }
    .lp-label { font-family: "DM Mono", monospace; font-size: 11px; color: #4a90d9; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 14px; }
    .lp-h2 { font-family: "Instrument Serif", serif; font-size: clamp(30px,3vw,44px); color: #0f2340; margin-bottom: 14px; line-height: 1.2; }
    .lp-section-sub { font-size: 16px; color: #64748b; max-width: 520px; line-height: 1.7; margin-bottom: 56px; font-weight: 300; }
    .lp-features-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; }
    .lp-feature { padding: 28px; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; transition: all .2s; }
    .lp-feature:hover { border-color: #4a90d9; box-shadow: 0 8px 32px rgba(74,144,217,0.1); transform: translateY(-2px); }
    .lp-feature-icon { width: 44px; height: 44px; background: #f0f4f8; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 16px; }
    .lp-feature-title { font-size: 15px; font-weight: 600; color: #0f2340; margin-bottom: 8px; }
    .lp-feature-desc { font-size: 13px; color: #64748b; line-height: 1.7; font-weight: 300; }
    .lp-video-section { padding: 80px 60px; background: #f0f4f8; }
    .lp-video-inner { max-width: 860px; margin: 0 auto; text-align: center; }
    .lp-video-box { background: #0f2340; border-radius: 18px; aspect-ratio: 16/9; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; margin-top: 44px; cursor: pointer; position: relative; overflow: hidden; }
    .lp-play { width: 68px; height: 68px; background: rgba(255,255,255,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.2); transition: all .2s; }
    .lp-video-box:hover .lp-play { background: rgba(255,255,255,0.25); transform: scale(1.05); }
    .lp-play::after { content: ""; border-left: 22px solid #fff; border-top: 13px solid transparent; border-bottom: 13px solid transparent; margin-left: 4px; }
    .lp-video-label { color: rgba(255,255,255,0.5); font-size: 12px; font-family: "DM Mono", monospace; }
    .lp-pricing-section { padding: 90px 60px; max-width: 1200px; margin: 0 auto; }
    .lp-pricing-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; margin-top: 44px; }
    .lp-plan { border: 1px solid #e2e8f0; border-radius: 18px; padding: 36px 28px; background: #fff; position: relative; transition: all .2s; }
    .lp-plan:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(15,35,64,0.1); }
    .lp-plan.featured { background: #0f2340; border-color: #0f2340; }
    .lp-plan-badge { position: absolute; top: -11px; left: 50%; transform: translateX(-50%); background: #e8b86d; color: #0f2340; padding: 3px 14px; border-radius: 100px; font-size: 11px; font-weight: 700; font-family: "DM Mono", monospace; white-space: nowrap; }
    .lp-plan-name { font-size: 12px; font-family: "DM Mono", monospace; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px; }
    .lp-plan.featured .lp-plan-name { color: rgba(255,255,255,0.45); }
    .lp-plan-price { font-family: "Instrument Serif", serif; font-size: 48px; color: #0f2340; line-height: 1; margin-bottom: 4px; }
    .lp-plan.featured .lp-plan-price { color: #fff; }
    .lp-plan-period { font-size: 12px; color: #64748b; margin-bottom: 24px; }
    .lp-plan.featured .lp-plan-period { color: rgba(255,255,255,0.45); }
    .lp-plan-divider { height: 1px; background: #e2e8f0; margin-bottom: 24px; }
    .lp-plan.featured .lp-plan-divider { background: rgba(255,255,255,0.1); }
    .lp-plan ul { list-style: none; margin-bottom: 28px; }
    .lp-plan ul li { font-size: 13px; color: #64748b; padding: 7px 0; display: flex; align-items: center; gap: 8px; }
    .lp-plan.featured ul li { color: rgba(255,255,255,0.65); }
    .lp-plan ul li::before { content: "✓"; color: #4a90d9; font-weight: 700; flex-shrink: 0; }
    .lp-plan.featured ul li::before { color: #e8b86d; }
    .lp-plan-cta { display: block; text-align: center; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; transition: all .2s; cursor: pointer; border: none; font-family: "DM Sans", sans-serif; width: 100%; }
    .lp-plan-cta-outline { border: 1px solid #e2e8f0; color: #0f2340; background: transparent; }
    .lp-plan-cta-outline:hover { background: #f0f4f8; }
    .lp-plan-cta-filled { background: #fff; color: #0f2340; }
    .lp-plan-cta-filled:hover { background: rgba(255,255,255,0.9); }
    .lp-promo-note { text-align: center; margin-top: 18px; font-size: 12px; color: #94a3b8; font-family: "DM Mono", monospace; }
    .lp-promo-note span { color: #e8b86d; font-weight: 600; }
    .lp-testi-section { padding: 90px 60px; background: #f0f4f8; }
    .lp-testi-inner { max-width: 1100px; margin: 0 auto; }
    .lp-testi-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; margin-top: 44px; }
    .lp-testi { background: #fff; border-radius: 14px; padding: 28px; border: 1px solid #e2e8f0; }
    .lp-stars { color: #e8b86d; font-size: 13px; margin-bottom: 14px; }
    .lp-testi-text { font-size: 15px; color: #0f2340; line-height: 1.7; margin-bottom: 20px; font-style: italic; font-family: "Instrument Serif", serif; }
    .lp-author { display: flex; align-items: center; gap: 10px; }
    .lp-avatar { width: 38px; height: 38px; border-radius: 50%; background: #0f2340; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 14px; }
    .lp-author-name { font-size: 13px; font-weight: 600; color: #0f2340; }
    .lp-author-role { font-size: 11px; color: #94a3b8; }
    .lp-cta-section { padding: 100px 60px; background: #0f2340; text-align: center; position: relative; overflow: hidden; }
    .lp-cta-section::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 60px 60px; }
    .lp-cta-content { position: relative; z-index: 1; }
    .lp-cta-title { font-family: "Instrument Serif", serif; font-size: clamp(32px,4vw,52px); color: #fff; margin-bottom: 18px; line-height: 1.2; }
    .lp-cta-sub { font-size: 16px; color: rgba(255,255,255,0.5); margin-bottom: 36px; font-weight: 300; }
    .lp-footer { padding: 36px 60px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
    .lp-footer-logo { font-family: "Instrument Serif", serif; font-size: 18px; color: #0f2340; }
    .lp-footer-copy { font-size: 11px; color: #94a3b8; font-family: "DM Mono", monospace; }
    .lp-footer-links { display: flex; gap: 20px; }
    .lp-footer-links a { font-size: 12px; color: #94a3b8; text-decoration: none; }
    .lp-footer-links a:hover { color: #0f2340; }
    @media(max-width:1024px){.lp-mockup{display:none;}.lp-features-grid,.lp-pricing-grid,.lp-testi-grid{grid-template-columns:1fr 1fr;}.lp-stats{grid-template-columns:repeat(2,1fr);}}
    @media(max-width:768px){.lp-nav{padding:16px 24px;}.lp-nav-links{display:none;}.lp-hero,.lp-section,.lp-pricing-section,.lp-video-section,.lp-testi-section,.lp-cta-section{padding:70px 24px;}.lp-features-grid,.lp-pricing-grid,.lp-testi-grid{grid-template-columns:1fr;}.lp-stats{grid-template-columns:1fr 1fr;}.lp-footer{flex-direction:column;text-align:center;}}
  `;

  return (
    <div className="lp-body">
      {legalType && <LegalModal type={legalType} onClose={()=>setLegalType(null)} />}
      {showContact && <ContactModal onClose={()=>setShowContact(false)} />}
      <style>{LP_CSS}</style>

      {/* NAV */}
      <nav className="lp-nav">
        <div className="lp-logo">📞 CallRDV</div>
        <div style={{ display:"flex", alignItems:"center", gap:20 }}>
          <div className="lp-nav-links">
            <a href="#lp-features">{t("Fonctionnalités","Features")}</a>
            <a href="#lp-pricing">{t("Tarifs","Pricing")}</a>
            <button className="lp-btn-nav" onClick={onLogin}>{t("Se connecter →","Log in →")}</button>
          </div>
          <button className="lp-login-mobile" onClick={onLogin}>{t("Connexion","Log in")}</button>
          <LangSwitch />
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-hero-grid"></div>
        <div className="lp-hero-content">
          <div className="lp-badge">{t("🟢 Disponible maintenant","🟢 Available now")}</div>
          <h1 className="lp-h1">{t(<>Vos rendez-vous,<br/><em>organisés en secondes</em></>, <>Your appointments,<br/><em>organized in seconds</em></>)}</h1>
          <p className="lp-sub">{t("CallRDV transforme chaque appel téléphonique en rendez-vous structuré. Recherchez votre client, remplissez la fiche, et c'est fait.","CallRDV turns every phone call into a clear, organized appointment. Find your client, fill in the form, and you're done.")}</p>
          <div className="lp-actions">
            <button className="lp-btn-primary" onClick={onSignup}>{t("Commencer gratuitement →","Start for free →")}</button>
          </div>
        </div>
        <div className="lp-mockup">
          <div className="lp-mockup-bar">
            <div className="lp-dot" style={{background:"#ff5f57"}}></div>
            <div className="lp-dot" style={{background:"#febc2e"}}></div>
            <div className="lp-dot" style={{background:"#28c840"}}></div>
            <span className="lp-mockup-title">callrdv.com</span>
          </div>
          <div className="lp-mockup-body">
            <div className="lp-search">{t("🔍 Rechercher un client...","🔍 Search a client...")}</div>
            <div className="lp-rdv">
              <div className="lp-rdv-dot" style={{background:"#22c55e"}}></div>
              <div><div className="lp-rdv-title">{t("Mme Dupont — Coupe + couleur","Mrs Smith — Cut + colour")}</div><div className="lp-rdv-sub">{t("Demain à 10h00","Tomorrow at 10:00 AM")}</div></div>
              <div className="lp-rdv-tag" style={{background:"#22c55e20",color:"#16a34a"}}>{t("confirmé","confirmed")}</div>
            </div>
            <div className="lp-rdv">
              <div className="lp-rdv-dot" style={{background:"#3b82f6"}}></div>
              <div><div className="lp-rdv-title">{t("M. Martin — Brushing","Mr Brown — Blow-dry")}</div><div className="lp-rdv-sub">{t("Vendredi à 14h30","Friday at 2:30 PM")}</div></div>
              <div className="lp-rdv-tag" style={{background:"#3b82f620",color:"#3b82f6"}}>{t("à venir","upcoming")}</div>
            </div>
            <div className="lp-rdv">
              <div className="lp-rdv-dot" style={{background:"#f59e0b"}}></div>
              <div><div className="lp-rdv-title">{t("Mlle Bernard — Coloration","Ms Taylor — Colouring")}</div><div className="lp-rdv-sub">{t("Samedi à 16h00","Saturday at 4:00 PM")}</div></div>
              <div className="lp-rdv-tag" style={{background:"#f59e0b20",color:"#f59e0b"}}>{t("à venir","upcoming")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="lp-stats">
        {(t([["2min","pour créer un RDV"],["📅","agenda intégré"],["J-3","rappels automatiques"],["100%","conforme RGPD"]],[["2min","to create an appointment"],["📅","built-in calendar"],["3 days","automatic reminders"],["100%","GDPR compliant"]])).map(([n,l])=>(
          <div key={l} className="lp-stat"><div className="lp-stat-num">{n}</div><div className="lp-stat-label">{l}</div></div>
        ))}
      </div>

      {/* FEATURES */}
      <section className="lp-section" id="lp-features">
        <div className="lp-label">{t("Fonctionnalités","Features")}</div>
        <h2 className="lp-h2">{t(<>Tout ce qu'il vous faut<br/>pour gérer vos RDV</>, <>Everything you need<br/>to manage your appointments</>)}</h2>
        <p className="lp-section-sub">{t("Une interface pensée pour aller vite. Pas de formation, pas de complexité — juste l'essentiel.","Built for speed. No training, no complexity — just the essentials.")}</p>
        <div className="lp-features-grid">
          {t([
            {icon:"🔍",title:"Recherche client instantanée",desc:"Tapez le nom de votre client et sa fiche apparaît automatiquement avec tout son historique."},
            {icon:"📋",title:"Fiches intelligentes par catégorie",desc:"Médecin, restaurant, garage, juridique — chaque type de RDV a ses propres champs adaptés."},
            {icon:"🔔",title:"Rappels automatiques",desc:"Vous recevez un email de rappel 3 jours et 1 jour avant chaque RDV. Plus aucun oubli."},
            {icon:"📅",title:"Agenda complet",desc:"Vue semaine, mois ou liste. Exportez vers Google Calendar ou Outlook en un clic."},
            {icon:"📊",title:"Tableau de bord",desc:"Suivez votre activité : RDV par semaine, catégories les plus fréquentes, évolution sur 6 mois."},
            {icon:"📄",title:"Export PDF",desc:"Générez un planning PDF propre et professionnel en un clic depuis votre agenda."},
          ],[
            {icon:"🔍",title:"Instant client search",desc:"Type your client's name and their profile appears instantly, with their full history."},
            {icon:"📋",title:"Smart forms by business",desc:"Doctor, restaurant, garage, legal — each type of appointment has its own fields."},
            {icon:"🔔",title:"Automatic reminders",desc:"You get an email reminder 3 days and 1 day before every appointment. Never forget again."},
            {icon:"📅",title:"Full calendar",desc:"Week, month or list view. Export to Google Calendar or Outlook in one click."},
            {icon:"📊",title:"Dashboard",desc:"Track your activity: appointments per week, top categories, 6-month trend."},
            {icon:"📄",title:"PDF export",desc:"Create a clean, professional PDF schedule from your calendar in one click."},
          ]).map(({icon,title,desc})=>(
            <div key={title} className="lp-feature">
              <div className="lp-feature-icon">{icon}</div>
              <div className="lp-feature-title">{title}</div>
              <div className="lp-feature-desc">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="lp-pricing-section" id="lp-pricing">
        <div className="lp-label">{t("Tarifs","Pricing")}</div>
        <h2 className="lp-h2">{t("Simple et transparent","Simple and transparent")}</h2>
        <p className="lp-section-sub">{t("Un seul prix, tout inclus. Essayez gratuitement avant de vous abonner.","One price, everything included. Try it for free before subscribing.")}</p>
        <div className="lp-pricing-grid" style={{ gridTemplateColumns:"1fr", maxWidth:420, marginLeft:"auto", marginRight:"auto" }}>
          <div className="lp-plan featured">
            <div className="lp-plan-name">CallRDV Pro</div>
            <div className="lp-plan-price">20€</div>
            <div className="lp-plan-period">{t("par mois · sans engagement","per month · cancel anytime")}</div>
            <div className="lp-plan-divider"></div>
            <ul>{t(["RDV illimités","Rappels email à vous et à vos clients (J-3 et J-1)","Fiches clients et import de contacts","Agenda semaine / mois / liste","Export PDF et Google Calendar / Outlook"],["Unlimited appointments","Email reminders for you and your clients (3 days and 1 day before)","Client profiles and contact import","Week / month / list calendar","PDF export and Google Calendar / Outlook"]).map(x=><li key={x}>{x}</li>)}</ul>
            <button className="lp-plan-cta lp-plan-cta-filled" onClick={onSignup}>{t("Commencer gratuitement →","Start for free →")}</button>
            <div style={{ fontSize:12, color:"#64748b", textAlign:"center", marginTop:12 }}>{t("10 RDV offerts chaque mois pour essayer, sans carte bancaire.","10 free appointments every month to try it, no credit card.")}</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta-section">
        <div className="lp-cta-content">
          <h2 className="lp-cta-title">{t(<>Prêt à simplifier<br/>votre gestion de RDV ?</>, <>Ready to simplify<br/>your appointments?</>)}</h2>
          <p className="lp-cta-sub">{t("Rejoignez CallRDV — gratuit pour commencer, sans carte bancaire.","Join CallRDV — free to start, no credit card needed.")}</p>
          <button className="lp-btn-primary" style={{fontSize:16,padding:"16px 36px"}} onClick={onSignup}>{t("Créer mon compte gratuitement →","Create my free account →")}</button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-logo">📞 CallRDV</div>
        <div className="lp-footer-links"><a href="#privacy" onClick={(e)=>{e.preventDefault();window.__showLegal("privacy");}}>{t("Confidentialité","Privacy")}</a><a href="#cgu" onClick={(e)=>{e.preventDefault();window.__showLegal("cgu");}}>{t("CGU","Terms")}</a><a href="#contact" onClick={(e)=>{e.preventDefault();setShowContact(true);}}>Contact</a></div>
        <div className="lp-footer-copy">{t("© 2026 CallRDV · Conforme RGPD","© 2026 CallRDV · GDPR compliant")}</div>
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

  const handleDeleteRdv = async (id) => {
    if (!window.confirm(tr("Supprimer ce rendez-vous ?","Delete this appointment?"))) return;
    await sb.deleteAppointment(token, id);
    setAppts(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateStatut = async (id, statut) => {
    await sb.updateAppointment(token, id, { statut });
    setAppts(prev => prev.map(r => r.id === id ? { ...r, statut } : r));
  };

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

  if (!user) {
    if (showLanding) return <LandingPage onLogin={() => { setAuthMode("login"); setShowLanding(false); }} onSignup={() => { setAuthMode("register"); setShowLanding(false); }} />;
    return (<><style>{CSS}</style><AuthPage authHooks={{ signIn, signUp, loading }} initialMode={authMode} /></>);
  }

  return (
    <>
      <style>{CSS}</style>
      {showSettings && <SettingsModal user={user} token={token} sb={sb} onSave={(data)=>updateUser(data)} onClose={()=>setShowSettings(false)} />}
      {showPricing && <PricingModal currentPlan={user.plan} onUpgrade={handleUpgrade} onClose={()=>setPrice(false)} />}
      {calRdv && <CalendarModal rdv={calRdv} onClose={()=>setCalRdv(null)} onEdit={setEditingRdv} onDelete={handleDeleteRdv} onUpdateStatut={handleUpdateStatut} />}

      <div style={{ minHeight:"100vh", background:"var(--bg)", fontFamily:"'Inter',sans-serif", color:"var(--text)", display:"flex", flexDirection:"column", transition:"background .3s,color .3s" }}>

        {/* NAV */}
        <nav className="app-nav" style={{ padding:"14px 24px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, background:"#1e3a5f", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>📞</div>
            <span className="app-nav-name" style={{ fontWeight:800, fontSize:16 }}>CallRDV</span>
          </div>
          <div className="app-nav-right" style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"6px 14px", fontSize:11, color:"#94a3b8", fontFamily:"DM Mono" }}>
              {plan.quota===Infinity ? tr("✨ Illimité","✨ Unlimited") : tr(`${plan.quota-(user.usage||0)} RDV restants`, `${plan.quota-(user.usage||0)} left`)}
            </div>
            <div onClick={()=>setPrice(true)} style={{ background:"#fff", border:`1px solid ${plan.color}40`, borderRadius:10, padding:"6px 14px", fontSize:11, color:plan.color, fontFamily:"DM Mono", cursor:"pointer", fontWeight:700 }}>
              {tr(plan.name, plan.nameEn).toUpperCase()}{user.plan==="free"&&<span style={{ color:"#1e3a5f", marginLeft:6 }}>↑</span>}
            </div>
            <button onClick={()=>setShowSettings(true)} style={{ background:"none", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:14 }} title={tr("Paramètres","Settings")}>⚙️</button>
            <button onClick={signOut} style={{ background:"none", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:14 }} title={tr("Se déconnecter","Log out")}>
              ↪️
            </button>
            <div style={{ width:28, height:28, background:"#1e3a5f", color:"#fff", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700 }}>{user.name?.[0]?.toUpperCase()||"?"}</div>
          </div>
        </nav>

        {/* Onglets */}
        <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", display:"flex", gap:0 }}>
          {[["🏠",tr("Accueil","Home"),"home"],["📅",tr("Mes RDV","Appointments"),"agenda"],["👥",tr("Clients","Clients"),"patients"],...(appointments.length >= 5 ? [["📊",tr("Stats","Stats"),"stats"]] : [])].map(([icon,label,tab]) => (
            <button key={tab} onClick={()=>{ setShowAgenda(tab==="agenda"); setShowPatients(tab==="patients"); setShowStats(tab==="stats"); if(tab==="home"){ setShowAgenda(false); setShowPatients(false); setShowStats(false); } }}
              style={{ padding:"12px 28px", fontSize:14, fontWeight:600, fontFamily:"Inter,sans-serif", border:"none", cursor:"pointer", background:"transparent", borderBottom:(tab==="home"&&!showAgenda&&!showPatients&&!showStats)||(tab==="agenda"&&showAgenda)||(tab==="patients"&&showPatients)||(tab==="stats"&&showStats)?"3px solid #1e3a5f":"3px solid transparent", color:(tab==="home"&&!showAgenda&&!showPatients&&!showStats)||(tab==="agenda"&&showAgenda)||(tab==="patients"&&showPatients)||(tab==="stats"&&showStats)?"#1e3a5f":"#94a3b8", display:"flex", alignItems:"center", gap:8, transition:"all .2s" }}>
              {icon} {label}
            </button>
          ))}
        </div>

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
                      if (v !== "autre" && canAdd) {
                        window.__prefillCategorie = v;
                        setPhase("form");
                      }
                    }} style={{ padding:"16px 12px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:12, cursor:"pointer", textAlign:"left", transition:"all .2s" }}>
                      <div style={{ fontWeight:700, fontSize:14, color:"#1e293b", marginBottom:4 }}>{l}</div>
                      <div style={{ fontSize:11, color:"#94a3b8" }}>{d}</div>
                    </button>
                  ))}
                </div>
                <button onClick={async()=>{
                  await updateUser({ metier: "autre" });
                  setShowMetierSetup(false);
                }} style={{ marginTop:16, width:"100%", background:"none", border:"none", color:"#94a3b8", fontSize:12, cursor:"pointer", textDecoration:"underline" }}>
                  {tr("Passer pour l'instant","Skip for now")}
                </button>
              </div>
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
              onClick={()=>{ if(canAdd) setPhase("form"); }}
              disabled={!canAdd}
              style={{
                position:"fixed",
                bottom:24,
                right:24,
                width:60,
                height:60,
                borderRadius:"50%",
                background: canAdd ? "#1e3a5f" : "#94a3b8",
                color:"#fff",
                border:"none",
                fontSize:28,
                fontWeight:700,
                cursor: canAdd ? "pointer" : "not-allowed",
                boxShadow:"0 8px 24px rgba(30,58,95,0.4)",
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
                <div style={{ fontWeight:800, fontSize:18, marginBottom:20 }}>{tr("✏️ Modifier le rendez-vous","✏️ Edit appointment")}</div>
                {[
                  { key:"titre", label:tr("TITRE","TITLE"), type:"text" },
                  { key:"personne", label:tr("CONTACT / PERSONNE","CONTACT / PERSON"), type:"text" },
                  { key:"date", label:"DATE", type:"date" },
                  { key:"heure", label:tr("HEURE","TIME"), type:"time" },
                  { key:"client_email", label:tr("EMAIL DU CLIENT (RAPPEL)","CLIENT EMAIL (REMINDER)"), type:"email" },
                  { key:"lieu", label:tr("LIEU","PLACE"), type:"text" },
                  { key:"adresse", label:tr("ADRESSE","ADDRESS"), type:"text" },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom:14 }}>
                    <div className="field-label">{f.label}</div>
                    <input type={f.type} defaultValue={editingRdv[f.key]||""} id={`edit-rdv-${f.key}`} />
                  </div>
                ))}
                <div style={{ marginBottom:14 }}>
                  <div className="field-label">{tr("STATUT","STATUS")}</div>
                  <select id="edit-rdv-statut" defaultValue={editingRdv.statut||"en_attente"} style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14 }}>
                    <option value="en_attente">{tr("⏳ En attente","⏳ Pending")}</option>
                    <option value="confirme">{tr("✅ Confirmé","✅ Confirmed")}</option>
                    <option value="reporte">{tr("🔄 Reporté","🔄 Postponed")}</option>
                    <option value="annule">{tr("❌ Annulé","❌ Cancelled")}</option>
                  </select>
                </div>
                <div style={{ marginBottom:20 }}>
                  <div className="field-label">NOTES</div>
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
                    await sb.updateAppointment(token, editingRdv.id, data);
                    setAppts(prev => prev.map(r => r.id === editingRdv.id ? { ...r, ...data } : r));
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
            />
          )}

          {/* AGENDA VIEW */}
          {showAgenda && (
            <CalendarView
              appointments={appointments}
              onNewCall={()=>{ setShowAgenda(false); setPhase("form"); }}
              onCalRdv={setCalRdv}
              onEditRdv={setEditingRdv}
              onDeleteRdv={handleDeleteRdv}
              onUpdateStatut={handleUpdateStatut}
            />
          )}

          {/* MAIN */}
          {!showAgenda && !showPatients && !showStats && <div className="app-main" style={{ flex:1, padding:"28px", overflowY:"auto", borderRight:"1px solid #e2e8f0" }}>

            {/* IDLE */}
            {phase==="idle" && (
              <div className="fade-up">

                {/* Welcome screen pour nouveau utilisateur */}
                {showOnboarding && (
                  <div style={{ marginBottom:28 }}>
                    <div style={{ background:"linear-gradient(135deg, #1e3a5f, #2d5a8e)", borderRadius:20, padding:32, color:"#fff", marginBottom:20, position:"relative", overflow:"hidden" }}>
                      <div style={{ position:"absolute", right:-20, top:-20, fontSize:120, opacity:0.08 }}>📞</div>
                      <div style={{ fontSize:13, opacity:0.7, marginBottom:8, fontFamily:"DM Mono" }}>{tr("BIENVENUE 👋","WELCOME 👋")}</div>
                      <div style={{ fontSize:24, fontWeight:800, marginBottom:8 }}>{tr("Bonjour","Hello")} {user.name?.split(" ")[0] || "!"} </div>
                      <div style={{ fontSize:14, opacity:0.8, lineHeight:1.7 }}>
                        {tr(<>Votre espace CallRDV est prêt.<br/>Créez votre premier rendez-vous en quelques secondes.</>, <>Your CallRDV space is ready.<br/>Create your first appointment in seconds.</>)}
                      </div>
                      <button
                        onClick={()=>{ if(canAdd) setPhase("form"); setDismissOnboarding(true); }}
                        style={{ marginTop:20, background:"#fff", color:"#1e3a5f", border:"none", borderRadius:10, padding:"12px 24px", fontWeight:700, fontSize:14, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8 }}>
                        {tr("➕ Créer mon premier RDV","➕ Create my first appointment")}
                      </button>
                    </div>

                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:8 }}>
                      {[
                        { step:"1️⃣", title:tr("Cherchez votre client","Find your client"), desc:tr("Tapez son nom dans la barre de recherche","Type their name in the search bar") },
                        { step:"2️⃣", title:tr("Remplissez la fiche","Fill in the form"), desc:tr("Date, heure, lieu et infos spécifiques","Date, time, place and specific details") },
                        { step:"3️⃣", title:tr("C'est confirmé !","It's confirmed!"), desc:tr("Rappels automatiques envoyés par email","Automatic email reminders") },
                      ].map(({step,title,desc}) => (
                        <div key={step} className="card" style={{ padding:16, textAlign:"center" }}>
                          <div style={{ fontSize:28, marginBottom:8 }}>{step}</div>
                          <div style={{ fontWeight:700, fontSize:13, marginBottom:6 }}>{title}</div>
                          <div style={{ fontSize:12, color:"var(--text2)", lineHeight:1.5 }}>{desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {saved && (
                  <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:12, padding:"14px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:12, animation:"slideIn .4s ease" }}>
                    <span style={{ fontSize:20 }}>✅</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:"#16a34a", marginBottom:2 }}>{tr("RDV enregistré avec succès !","Appointment saved!")}</div>
                      <div style={{ fontSize:11, color:"#0369a1", fontFamily:"DM Mono" }}>{tr("Retrouvez-le dans votre agenda.","You'll find it in your calendar.")}</div>
                    </div>
                  </div>
                )}

                <h1 style={{ fontSize:24, fontWeight:800, letterSpacing:"-0.03em", lineHeight:1.2, marginBottom:8 }}>
                  {tr("Bonjour","Hello")} {user.name||""} 👋
                </h1>
                <p style={{ color:"#94a3b8", fontSize:13, marginBottom:24, lineHeight:1.6 }}>
                  {tr("Tapez le nom d'un client ci-dessous pour créer un RDV.","Type a client's name below to create an appointment.")}
                </p>

                {!canAdd && (
                  <div style={{ background:"#fff5f5", border:"1px solid #ff6b6b30", borderRadius:14, padding:18, marginBottom:18 }}>
                    <div style={{ fontWeight:700, color:"#ff6b6b", marginBottom:6 }}>{tr("Quota mensuel atteint","Monthly limit reached")}</div>
                    <div style={{ fontSize:13, color:"#7a4a4a", marginBottom:12 }}>{tr(`Vous avez utilisé vos ${plan.quota} RDV gratuits ce mois.`, `You have used your ${plan.quota} free appointments this month.`)}</div>
                    <button className="btn btn-primary btn-sm" onClick={()=>setPrice(true)}>{tr("Passer en Pro — 20€/mois","Go Pro — €20/month")}</button>
                  </div>
                )}

                {/* Recherche client */}
                <div style={{ marginTop:8 }}>
                  <div className="field-label" style={{ marginBottom:8 }}>{tr("NOUVEAU RDV — RECHERCHER LE CLIENT","NEW APPOINTMENT — FIND THE CLIENT")}</div>
                  <div style={{ position:"relative" }}>
                    <input
                      placeholder={tr("Tapez le nom du client...","Type the client's name...")}
                      id="search-client"
                      autoComplete="off"
                      onChange={e => {
                        const val = e.target.value;
                        const box = document.getElementById("search-suggestions");
                        if (!val.trim()) { box.style.display="none"; return; }
                        const matches = window.__patients?.filter(p => p.nom.toLowerCase().includes(val.toLowerCase())) || [];
                        if (matches.length > 0) {
                          const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
                          box.innerHTML = matches.map(p => `<div onclick="window.__selectPatient('${esc(p.id)}')" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background='#fff'">${esc(p.nom)}${p.telephone ? ` · ${esc(p.telephone)}` : ""}</div>`).join("");
                          box.style.display = "block";
                        } else {
                          box.innerHTML = `<div style="padding:10px 14px;font-size:13px;color:#94a3b8;">${tr("Nouveau client — fiche vierge","New client — blank form")}</div>`;
                          box.style.display = "block";
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter" && canAdd) {
                          const val = e.target.value.trim();
                          if (val) { window.__startWithName(val); }
                        }
                      }}
                      style={{ paddingRight:50, fontSize:15, padding:"15px 50px 15px 16px" }}
                    />
                    <button
                      onClick={() => {
                        const val = document.getElementById("search-client").value.trim();
                        if (val && canAdd) window.__startWithName(val);
                      }}
                      disabled={!canAdd}
                      style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"#1e3a5f", border:"none", borderRadius:8, padding:"8px 14px", cursor:"pointer", color:"#fff", fontSize:13, fontWeight:600 }}>
                      ➜
                    </button>
                    <div id="search-suggestions" style={{ display:"none", position:"absolute", top:"100%", left:0, right:0, background:"#fff", border:"1px solid #e2e8f0", borderRadius:"0 0 10px 10px", zIndex:100, boxShadow:"0 4px 16px #00000010" }}></div>
                  </div>
                  <div style={{ fontSize:11, color:"#94a3b8", marginTop:8, fontFamily:"DM Mono" }}>
                    {tr("Appuyez sur Entrée ou → pour ouvrir la fiche RDV","Press Enter or → to open the appointment form")}
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
                  <div style={{ fontFamily:"DM Mono", fontSize:32, color:"#ff4444", fontWeight:"bold", marginBottom:4 }}>{fmt(recordTime)}</div>
                  <div style={{ fontSize:14, color:"#94a3b8" }}>{tr("Appel en cours","Call in progress")} <span style={{ animation:"blink 1s infinite", display:"inline-block" }}>●</span></div>
                </div>

                <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:16, padding:20, marginBottom:28, textAlign:"left" }}>
                  <div style={{ fontSize:12, color:"#94a3b8", fontFamily:"DM Mono", lineHeight:1.7 }}>
                    {tr(<>Passez votre appel normalement.<br/>Quand vous raccrochez, <span style={{ color:"#1e3a5f", fontWeight:700 }}>la fiche RDV s'ouvre</span> pour que vous puissiez saisir les détails immédiatement.</>, <>Make your call as usual.<br/>When you hang up, <span style={{ color:"#1e3a5f", fontWeight:700 }}>the appointment form opens</span> so you can fill in the details right away.</>)}
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

          {/* SIDEBAR AGENDA */}
          {showPatients || showAgenda || showStats ? null : (
          <div className="app-side" style={{ width:290, padding:"24px 18px", overflowY:"auto" }}>
            <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"DM Mono", letterSpacing:"0.1em", marginBottom:18 }}>
              {tr("MON AGENDA","MY CALENDAR")} ({appointments.length})
            </div>

            {appointments.length===0 ? (
              <div style={{ textAlign:"center", padding:"40px 0" }}>
                <div style={{ fontSize:36, marginBottom:10 }}>📅</div>
                <div style={{ color:"#cbd5e1", fontSize:12, fontFamily:"DM Mono" }}>{tr("Aucun RDV enregistré","No appointments yet")}</div>
              </div>
            ) : appointments.map((rdv,i)=>(
              <div key={i} style={{ background:"#f0fdf4", border:"1px solid #bae6fd", borderRadius:14, padding:14, marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ fontWeight:700, fontSize:13, lineHeight:1.3 }}>{rdv.titre||tr("Rendez-vous","Appointment")}</div>
                  <button onClick={()=>setCalRdv(rdv)} title={tr("Ajouter au calendrier","Add to calendar")}
                    style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, opacity:.7, flexShrink:0 }}>📅</button>
                </div>
                <div style={{ fontSize:12, color:"#0284c7", marginBottom:4 }}>{rdv.personne}</div>
                <div style={{ fontSize:12, color:"#0369a1", marginBottom:4 }}>
                  {fmtRdv(rdv.date, rdv.heure)}
                </div>
                {rdv.lieu && <div style={{ fontSize:11, color:"#0284c7", fontFamily:"DM Mono", marginBottom:2 }}>{rdv.lieu}</div>}
                {rdv.adresse && <div style={{ fontSize:11, color:"#1a4a1a", fontFamily:"DM Mono" }}>{rdv.adresse}</div>}
                {rdv.notes && <div style={{ fontSize:11, color:"#3a5a3a", marginTop:6, borderTop:"1px solid #bae6fd", paddingTop:6 }}>{rdv.notes}</div>}
                <div style={{ fontSize:10, color:"#bae6fd", fontFamily:"DM Mono", marginTop:8 }}>{tr("Ajouté à","Added at")} {rdv.confirmedAt}</div>
              </div>
            ))}

            {/* Stats */}
            <div style={{ marginTop:16, borderTop:"1px solid #e2e8f0", paddingTop:16 }}>
              <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"DM Mono", letterSpacing:"0.1em", marginBottom:10 }}>{tr("STATISTIQUES","STATISTICS")}</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
                {[{ label:tr("RDV au total","Total appointments"), value:appointments.length },{ label:tr("RDV créés ce mois","Created this month"), value:user.usage||0 }].map(({label,value})=>(
                  <div key={label} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"12px" }}>
                    <div style={{ fontWeight:800, fontSize:22, color:"#1e3a5f" }}>{value}</div>
                    <div style={{ fontSize:10, color:"#94a3b8", fontFamily:"DM Mono", marginTop:2 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div className="privacy-badge">
                <span style={{ fontSize:14 }}>🔒</span>
                <div style={{ fontSize:10, color:"#0369a1", fontFamily:"DM Mono", lineHeight:1.5 }}>
                  {tr("Données hébergées en Europe. Aucun enregistrement vocal. Conforme RGPD.","Data hosted in Europe. No voice recording. GDPR compliant.")}
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </>
  );
}
