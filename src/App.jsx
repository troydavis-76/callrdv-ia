import React, { useState, useEffect, useRef } from "react";

const CONFIG = {
  SUPABASE_URL: "https://vcnguzlwyacnlysnsogv.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbmd1emx3eWFjbmx5c25zb2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDg0MTcsImV4cCI6MjA4ODIyNDQxN30.rI1WkGgUjFlw7dbl4wDtXcItDqsEc5PaqpPpF35cSuU",
  STRIPE_LINKS: { pro: "https://buy.stripe.com/00w8wPf3R8fkd0meNgcMM00?success_url=https://callrdv.com?success=1", business: "https://buy.stripe.com/eVqdR93l9ans2lIgVocMM01?success_url=https://callrdv.com?success=1" },
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
    const r = await fetch(`${this.url}/rest/v1/appointments`, {
      method: "POST",
      headers: { ...this.headers(token), "Prefer": "return=representation" },
      body: JSON.stringify({ user_id: userId, ...rdv }),
    });
    return r.json();
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
    if (!hash) return null;
    const params = new URLSearchParams(hash.replace("#", ""));
    const token = params.get("access_token");
    if (!token) return null;
    window.location.hash = "";
    return token;
  },
};

const PLANS = {
  free:     { name: "Gratuit",  price: 0,  quota: 10,       color: "#94a3b8", features: ["10 RDV/mois", "Agenda integre", "Export manuel"] },
  pro:      { name: "Pro",      price: 9,  quota: Infinity, color: "#1e3a5f", features: ["RDV illimites", "Google Calendar", "Outlook", "Rappels email"] },
  business: { name: "Business", price: 29, quota: Infinity, color: "#3b82f6", features: ["Tout Pro", "Multi-utilisateurs (5)", "Dashboard equipe", "Support prioritaire"] },
};

const delay = ms => new Promise(r => setTimeout(r, ms));

function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const signUp = async (email, password, name) => {
    setLoading(true);
    const res = await sb.signUp(email, password, name);
    if (res.error) { setLoading(false); return { error: res.error.message || "Erreur inscription" }; }
    return await signIn(email, password);
  };

  const signIn = async (email, password) => {
    setLoading(true);
    const res = await sb.signIn(email, password);
    if (res.error || !res.access_token) {
      setLoading(false);
      return { error: res.error?.message || res.error_description || "Email ou mot de passe incorrect" };
    }
    const tk = res.access_token;
    await delay(600);
    const profile = await sb.getProfile(tk, res.user.id);
    setUser({ id: res.user.id, email: res.user.email, name: profile?.name || res.user.user_metadata?.name || "", plan: profile?.plan || "free", usage: profile?.usage || 0, token: tk, rappels: profile?.rappels || ["j-1","j-3"], push_enabled: profile?.push_enabled || false, push_j1: profile?.push_j1 !== false, push_j3: profile?.push_j3 !== false, push_confirm: profile?.push_confirm !== false });
    setLoading(false);
    return { error: null };
  };

  const signOut = () => setUser(null);

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

  return { user, loading, signUp, signIn, signOut, updateUser };
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Mono:wght@300;400&display=swap');
:root{--bg:#f0f4f8;--bg2:#fff;--card:#fff;--border:#e2e8f0;--text:#1e293b;--text2:#64748b;--input-bg:#fff;--nav-bg:rgba(255,255,255,0.95);}
*{box-sizing:border-box;margin:0;padding:0;}
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
function AuthPage({ authHooks }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const { signIn, signUp, loading } = authHooks;
  const handle = async () => {
    setError("");
    const res = mode === "login" ? await signIn(email, password) : await signUp(email, password, name);
    if (res.error) setError(res.error);
  };
  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',sans-serif", padding:24 }}>
      <div style={{ width:"100%", maxWidth:420 }} className="fade-up">
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:56, height:56, background:"#1e3a5f", borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, margin:"0 auto 14px" }}>📞</div>
          <div style={{ fontWeight:800, fontSize:28, color:"#1e293b", letterSpacing:"-0.03em" }}>CallRDV <span style={{ color:"#1e3a5f" }}>IA</span></div>
          <div style={{ fontSize:12, color:"#94a3b8", fontFamily:"DM Mono", marginTop:4 }}>PRISE DE RDV AUTOMATIQUE</div>
        </div>
        <div className="card" style={{ padding:32 }}>
          <div style={{ display:"flex", gap:8, marginBottom:24, background:"#f0f4f8", borderRadius:12, padding:4 }}>
            {["login","register"].map(m => (
              <button key={m} onClick={() => setMode(m)} className="btn" style={{ flex:1, padding:"10px", fontSize:13, borderRadius:10, background:mode===m?"#1e3a5f":"transparent", color:mode===m?"#f0f4f8":"#94a3b8" }}>
                {m==="login" ? "Connexion" : "Inscription"}
              </button>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {mode === "register" && <input placeholder="Votre prenom" value={name} onChange={e=>setName(e.target.value)} />}
            <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
            <input type="password" placeholder="Mot de passe" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} />
          </div>
          {error && <div style={{ color:"#ff6b6b", fontSize:13, marginTop:10, fontFamily:"DM Mono" }}>⚠ {error}</div>}
          <button className="btn btn-primary" onClick={handle} disabled={loading} style={{ width:"100%", marginTop:18, display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            {loading ? <span className="spinner"></span> : (mode==="login" ? "Se connecter" : "Créer mon compte")}
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:10, margin:"16px 0" }}>
            <div style={{ flex:1, height:1, background:"#e2e8f0" }}></div>
            <span style={{ fontSize:11, color:"#94a3b8", fontFamily:"DM Mono" }}>OU</span>
            <div style={{ flex:1, height:1, background:"#e2e8f0" }}></div>
          </div>

          <button onClick={()=>sb.signInWithGoogle()} className="btn btn-outline" style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:12, padding:"14px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuer avec Google
          </button>

          <button onClick={()=>sb.signInWithLinkedIn()} className="btn btn-outline" style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:12, padding:"14px", marginTop:10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            Continuer avec LinkedIn
          </button>
          <div className="privacy-badge" style={{ marginTop:18 }}>
            <span style={{ fontSize:15 }}>🔒</span>
            <div style={{ fontSize:11, color:"#0369a1", fontFamily:"DM Mono", lineHeight:1.6 }}>
              <span style={{ color:"#0284c7", fontWeight:700 }}>Donnees protegees. </span>
              Aucun stockage vocal. Conforme RGPD.
            </div>
          </div>
        </div>
        <div style={{ marginTop:20, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          {Object.entries(PLANS).map(([k,p]) => (
            <div key={k} style={{ background:"#fff", border:`1px solid ${p.color}30`, borderRadius:12, padding:12, textAlign:"center" }}>
              <div style={{ fontWeight:700, fontSize:14, color:p.color }}>{p.price===0?"Gratuit":`${p.price}€/m`}</div>
              <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"DM Mono", marginTop:2 }}>{p.name}</div>
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
      <div style={{ width:"100%", maxWidth:800 }} className="fade-up">
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontWeight:800, fontSize:26, color:"#1e293b" }}>Choisissez votre plan</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
          {Object.entries(PLANS).map(([key, plan]) => (
            <div key={key} className="card" style={{ border:`1px solid ${plan.color}40`, position:"relative", transform:key==="pro"?"scale(1.04)":"none" }}>
              {key==="pro" && <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:"#1e3a5f", color:"#f0f4f8", fontSize:10, fontWeight:700, fontFamily:"DM Mono", padding:"4px 12px", borderRadius:20 }}>POPULAIRE</div>}
              <div style={{ color:plan.color, fontWeight:800, fontSize:22, marginBottom:4 }}>
                {plan.price===0?"Gratuit":`${plan.price}€`}{plan.price>0&&<span style={{ fontSize:13, fontWeight:400, color:"#94a3b8" }}>/mois</span>}
              </div>
              <div style={{ fontWeight:700, fontSize:16, marginBottom:14, color:"#1e293b" }}>{plan.name}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:18 }}>
                {plan.features.map(f => <div key={f} style={{ fontSize:13, color:"#64748b", display:"flex", gap:8 }}><span style={{ color:plan.color }}>✓</span>{f}</div>)}
              </div>
              {currentPlan===key
                ? <div style={{ textAlign:"center", padding:"12px", background:`${plan.color}15`, borderRadius:10, fontSize:13, color:plan.color, fontFamily:"DM Mono" }}>Plan actuel</div>
                : <button onClick={()=>onUpgrade(key)} style={{ width:"100%", background:plan.color, color:"#f0f4f8", padding:"12px", fontFamily:"'Inter',sans-serif", fontWeight:700, border:"none", cursor:"pointer", borderRadius:10, fontSize:14 }}>{key==="free"?"Rester gratuit":`Passer a ${plan.name}`}</button>
              }
            </div>
          ))}
        </div>
        <div style={{ textAlign:"center", marginTop:20 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Retour</button>
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
    const details = encodeURIComponent(`Avec: ${rdv.personne}\nLieu: ${rdv.lieu||""}\n${rdv.notes||""}`);
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
            <div style={{ fontWeight:800, fontSize:18, color:"#1e293b", marginBottom:4 }}>{rdv.titre||"Rendez-vous"}</div>
            <div style={{ display:"inline-block", background:(catColors[rdv.categorie]||"#94a3b8")+"20", color:catColors[rdv.categorie]||"#94a3b8", padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:600 }}>{rdv.categorie||"autre"}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#94a3b8", padding:4 }}>✕</button>
        </div>

        {/* Infos */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
          {[
            { icon:"👤", label:"Contact", value:rdv.personne },
            { icon:"📅", label:"Date", value:rdv.date },
            { icon:"🕐", label:"Heure", value:rdv.heure||"Non définie" },
            { icon:"📍", label:"Lieu", value:rdv.lieu||"Non défini" },
          ].map(({icon,label,value}) => (
            <div key={label} style={{ background:"#f8fafc", borderRadius:10, padding:"10px 14px" }}>
              <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4 }}>{icon} {label}</div>
              <div style={{ fontSize:13, fontWeight:600, color:"#1e293b" }}>{value||"—"}</div>
            </div>
          ))}
        </div>

        {/* Statut */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, color:"#94a3b8", marginBottom:6, fontFamily:"DM Mono" }}>STATUT</div>
          <select
            value={rdv.statut||"en_attente"}
            onChange={e => onUpdateStatut && onUpdateStatut(rdv.id, e.target.value)}
            style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14, background:"#fff" }}>
            <option value="en_attente">⏳ En attente</option>
            <option value="confirme">✅ Confirmé</option>
            <option value="reporte">🔄 Reporté</option>
            <option value="annule">❌ Annulé</option>
          </select>
        </div>

        {rdv.notes && (
          <div style={{ background:"#f8fafc", borderRadius:10, padding:"12px 14px", marginBottom:20, fontSize:13, color:"#475569", lineHeight:1.6 }}>
            📝 {rdv.notes}
          </div>
        )}

        {/* Actions */}
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <button onClick={()=>{ onEdit && onEdit(rdv); onClose(); }} style={{ flex:1, background:"#f0f4ff", border:"1px solid #1e3a5f30", borderRadius:8, padding:"10px", cursor:"pointer", fontSize:13, fontWeight:600, color:"#1e3a5f" }}>✏️ Modifier</button>
          <button onClick={()=>{ onDelete && onDelete(rdv.id); onClose(); }} style={{ flex:1, background:"#fff5f5", border:"1px solid #fecaca", borderRadius:8, padding:"10px", cursor:"pointer", fontSize:13, fontWeight:600, color:"#ef4444" }}>🗑️ Supprimer</button>
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <button onClick={()=>{
            const msg = `📅 Rappel RDV\n${rdv.titre||"Rendez-vous"}\n👤 ${rdv.personne||""}\n📆 ${rdv.date||""}${rdv.heure?" à "+rdv.heure:""}\n📍 ${rdv.lieu||""}\n\nCallRDV IA — callrdv.com`;
            if (navigator.share) { navigator.share({ title:"RDV", text:msg }); }
            else { navigator.clipboard.writeText(msg); alert("Copié dans le presse-papier !"); }
          }} style={{ flex:1, background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:"10px", cursor:"pointer", fontSize:13, fontWeight:600, color:"#16a34a" }}>
            📤 Partager
          </button>
          <button onClick={()=>{
            const sms = `sms:${rdv.telephone||""}?body=${encodeURIComponent(`Rappel RDV : ${rdv.titre||"RDV"} le ${rdv.date}${rdv.heure?" à "+rdv.heure:""}. Lieu: ${rdv.lieu||""}. CallRDV IA`)}`;
            window.open(sms);
          }} style={{ flex:1, background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:8, padding:"10px", cursor:"pointer", fontSize:13, fontWeight:600, color:"#0284c7" }}>
            💬 SMS
          </button>
        </div>

        {/* Export */}
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>exportTo("google")} style={{ flex:1, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"10px", cursor:"pointer", fontSize:12, color:"#64748b" }}>📅 Google Calendar</button>
          <button onClick={()=>exportTo("outlook")} style={{ flex:1, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"10px", cursor:"pointer", fontSize:12, color:"#64748b" }}>📆 Outlook</button>
        </div>

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

  const catLabels = {
    medical:"🏥 Médical", dentiste:"🦷 Dentiste", kine:"💪 Kiné", veterinaire:"🐾 Vétérinaire",
    garage:"🔧 Garage", travaux:"🏠 Travaux", juridique:"⚖️ Juridique", banque:"🏦 Banque",
    beaute:"💈 Beauté", formation:"🎓 Formation", pro:"💼 Pro", perso:"👤 Perso", autre:"📋 Autre"
  };

  const statutColors = {
    confirme: "#22c55e",
    annule: "#ef4444",
    reporte: "#f59e0b",
    en_attente: "#94a3b8"
  };
  const statutLabels = {
    confirme: "✅ Confirmé",
    annule: "❌ Annulé",
    reporte: "🔄 Reporté",
    en_attente: "⏳ En attente"
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
    const mois = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
    return { label: mois[d.getMonth()], count: appointments.filter(r => r.date?.startsWith(key)).length };
  });

  const maxCount = Math.max(...last6.map(m => m.count), 1);

  const planInfo = { free:{name:"Gratuit",color:"#64748b"}, pro:{name:"Pro",color:"#3b82f6"}, business:{name:"Business",color:"#7c3aed"} };
  const plan = planInfo[user.plan] || planInfo.free;

  return (
    <div style={{ flex:1, overflowY:"auto", padding:28, background:"#f0f4f8" }}>
      <div style={{ maxWidth:900, margin:"0 auto" }}>
        <div style={{ fontWeight:800, fontSize:22, color:"#1e293b", marginBottom:4 }}>📊 Tableau de bord</div>
        <div style={{ fontSize:13, color:"#94a3b8", marginBottom:24 }}>Vue d'ensemble de votre activité</div>

        {/* KPI Cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
          {[
            { label:"RDV ce mois", value:rdvCeMois.length, icon:"📅", color:"#3b82f6" },
            { label:"RDV cette semaine", value:rdvSemaine.length, icon:"📆", color:"#8b5cf6" },
            { label:"Total patients", value:patients.length, icon:"👥", color:"#10b981" },
            { label:"Total RDV", value:appointments.length, icon:"📋", color:"#f59e0b" },
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
            <div style={{ fontWeight:700, fontSize:15, marginBottom:20 }}>📈 RDV sur 6 mois</div>
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
            <div style={{ fontWeight:700, fontSize:15, marginBottom:20 }}>🏆 Top catégories</div>
            {topCats.length === 0 ? (
              <div style={{ color:"#94a3b8", fontSize:13 }}>Aucun RDV encore</div>
            ) : topCats.map(([cat, count]) => (
              <div key={cat} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{catLabels[cat]||cat}</span>
                  <span style={{ fontSize:13, color:"#94a3b8" }}>{count} RDV</span>
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
            <div style={{ fontWeight:700, fontSize:15, marginBottom:16 }}>💳 Mon plan</div>
            <div style={{ background:`${plan.color}15`, border:`1px solid ${plan.color}30`, borderRadius:12, padding:16, textAlign:"center", marginBottom:16 }}>
              <div style={{ fontSize:24, fontWeight:800, color:plan.color }}>{plan.name}</div>
              <div style={{ fontSize:12, color:"#94a3b8", marginTop:4 }}>{user.plan==="free"?`${user.usage||0}/10 RDV utilisés`:"RDV illimités"}</div>
            </div>
            {user.plan==="free" && (
              <div style={{ background:"#f0f4ff", borderRadius:10, padding:14, fontSize:12, color:"#1e3a5f", lineHeight:1.6 }}>
                💡 Passez en <b>Pro à 9€/mois</b> pour des RDV illimités !
              </div>
            )}
          </div>

          <div className="card" style={{ padding:24 }}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:16 }}>🕐 Derniers RDV</div>
            {appointments.slice(0,5).map((rdv,i) => (
              <div key={i} style={{ display:"flex", gap:12, alignItems:"center", padding:"8px 0", borderBottom:i<4?"1px solid #f1f5f9":"none" }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:catColors[rdv.categorie]||"#94a3b8", flexShrink:0 }}></div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{rdv.titre||"RDV"}</div>
                  <div style={{ fontSize:11, color:"#94a3b8" }}>{rdv.personne} · {rdv.date}</div>
                </div>
              </div>
            ))}
            {appointments.length === 0 && <div style={{ color:"#94a3b8", fontSize:13 }}>Aucun RDV encore</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Export PDF ───────────────────────────────────────────────
function exportPDF(appointments, viewMode) {
  const today = new Date();
  const moisNoms = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

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

  const title = viewMode === "semaine" ? "Planning de la semaine" : viewMode === "mois" ? `Planning de ${moisNoms[today.getMonth()]} ${today.getFullYear()}` : "Tous les rendez-vous";

  const rows = rdvs.map(r => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;">
        <span style="background:${catColors[r.categorie]||"#94a3b8"};color:#fff;padding:2px 8px;border-radius:20px;font-size:11px;">${r.categorie||"autre"}</span>
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#1e293b;">${r.titre||"Rendez-vous"}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">${r.personne||"—"}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">${r.date||"—"}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">${r.heure||"—"}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;">${r.lieu||"—"}</td>
    </tr>
  `).join("");

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8"/>
      <title>CallRDV IA — ${title}</title>
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
          <div class="logo">📞 CallRDV IA</div>
          <div class="subtitle">Prise de rendez-vous automatique</div>
        </div>
        <div style="text-align:right">
          <div class="badge">${rdvs.length} RDV</div>
          <div class="date" style="margin-top:6px">Généré le ${today.toLocaleDateString("fr-FR")} à ${today.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</div>
        </div>
      </div>
      <div class="title">${title}</div>
      ${rdvs.length === 0 ? '<p style="color:#94a3b8;text-align:center;padding:40px">Aucun rendez-vous pour cette période</p>' : `
      <table>
        <thead>
          <tr>
            <th>Catégorie</th>
            <th>Titre</th>
            <th>Contact</th>
            <th>Date</th>
            <th>Heure</th>
            <th>Lieu</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`}
      <div class="footer">CallRDV IA — Conforme RGPD · callrdv.com</div>
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
  const [viewMode, setViewMode] = React.useState("semaine"); // semaine | mois | liste
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
    const dateStr = date.toISOString().split("T")[0];
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
  const jours = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const moisNoms = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

  const catColors = {
    medical:"#3b82f6", dentiste:"#06b6d4", kine:"#8b5cf6", veterinaire:"#f59e0b",
    garage:"#6b7280", travaux:"#f97316", juridique:"#7c3aed", banque:"#0891b2",
    beaute:"#ec4899", formation:"#10b981", pro:"#1e3a5f", perso:"#64748b", autre:"#94a3b8"
  };

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"#f0f4f8" }}>
      {/* Calendar Header */}
      <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={()=>navigate(-1)} style={{ background:"#f0f4f8", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:16 }}>‹</button>
          <div style={{ fontWeight:700, fontSize:18, color:"#1e293b", minWidth:200, textAlign:"center" }}>
            {viewMode==="semaine"
              ? `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${moisNoms[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`
              : `${moisNoms[currentDate.getMonth()]} ${currentDate.getFullYear()}`
            }
          </div>
          <button onClick={()=>navigate(1)} style={{ background:"#f0f4f8", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:16 }}>›</button>
          <button onClick={()=>setCurrentDate(new Date())} style={{ background:"#1e3a5f", color:"#fff", border:"none", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:12, fontWeight:600, marginLeft:8 }}>Aujourd'hui</button>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {["semaine","mois","liste"].map(m => (
            <button key={m} onClick={()=>setViewMode(m)}
              style={{ background:viewMode===m?"#1e3a5f":"#f0f4f8", color:viewMode===m?"#fff":"#64748b", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:12, fontWeight:600, textTransform:"capitalize" }}>
              {m.charAt(0).toUpperCase()+m.slice(1)}
            </button>
          ))}
          <button onClick={onNewCall} style={{ background:"#1e3a5f", color:"#fff", border:"none", borderRadius:8, padding:"6px 16px", cursor:"pointer", fontSize:12, fontWeight:600, marginLeft:8 }}>
            📞 Nouvel appel
          </button>
          <button onClick={()=>exportPDF(appointments, viewMode)} style={{ background:"#f0f4f8", color:"#1e3a5f", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 16px", cursor:"pointer", fontSize:12, fontWeight:600 }}>
            📄 PDF
          </button>
          <input
            placeholder="🔍 Rechercher un RDV..."
            value={agendaSearch}
            onChange={e => { setAgendaSearch(e.target.value); if(e.target.value) setViewMode("liste"); }}
            style={{ fontSize:13, padding:"6px 14px", borderRadius:8, border:"1px solid #e2e8f0", width:200, background:"#fff" }}
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
        <div id="patients-right-panel" style={{ flex:1, overflowY:"auto", padding:24 }}>
          {appointments.length===0 ? (
            <div style={{ textAlign:"center", padding:"60px 0" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📅</div>
              <div style={{ color:"#94a3b8", fontSize:14 }}>Aucun RDV enregistré</div>
            </div>
          ) : appointments.filter(r => !agendaSearch || (r.titre||"").toLowerCase().includes(agendaSearch.toLowerCase()) || (r.personne||"").toLowerCase().includes(agendaSearch.toLowerCase()) || (r.lieu||"").toLowerCase().includes(agendaSearch.toLowerCase())).sort((a,b) => a.date > b.date ? 1 : -1).map((rdv, i) => (
            <div key={i} className="card" style={{ marginBottom:12, display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ width:4, height:50, borderRadius:4, background:catColors[rdv.categorie]||"#1e3a5f", flexShrink:0 }}></div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>{rdv.titre||"Rendez-vous"}</div>
                <div style={{ fontSize:12, color:"#64748b" }}>{rdv.personne} · {rdv.date}{rdv.heure ? ` à ${rdv.heure}` : ""}</div>
                {rdv.lieu && <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>📍 {rdv.lieu}</div>}
                <div style={{ marginTop:6 }}>
                  <select
                    value={rdv.statut||"en_attente"}
                    onChange={e => onUpdateStatut(rdv.id, e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize:11, padding:"2px 8px", borderRadius:20, border:"1px solid #e2e8f0", background: rdv.statut==="confirme"?"#f0fdf4":rdv.statut==="annule"?"#fff5f5":rdv.statut==="reporte"?"#fffbeb":"#f8fafc", color: rdv.statut==="confirme"?"#16a34a":rdv.statut==="annule"?"#ef4444":rdv.statut==="reporte"?"#d97706":"#64748b", cursor:"pointer" }}>
                    <option value="en_attente">⏳ En attente</option>
                    <option value="confirme">✅ Confirmé</option>
                    <option value="reporte">🔄 Reporté</option>
                    <option value="annule">❌ Annulé</option>
                  </select>
                </div>
              </div>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <button onClick={(e)=>{e.stopPropagation();onEditRdv(rdv);}} style={{ background:"#f0f4ff", border:"1px solid #1e3a5f30", borderRadius:8, padding:"6px 10px", cursor:"pointer", fontSize:12, color:"#1e3a5f" }}>✏️</button>
                <button onClick={(e)=>{e.stopPropagation();onDeleteRdv(rdv.id);}} style={{ background:"#fff5f5", border:"1px solid #fecaca", borderRadius:8, padding:"6px 10px", cursor:"pointer", fontSize:12, color:"#ef4444" }}>🗑️</button>
              </div>
              <button onClick={()=>onCalRdv(rdv)} style={{ background:"none", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:12, color:"#64748b" }}>📅 Exporter</button>
            </div>
          ))}
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
    if (nom.includes("depuis l'appareil") || nom.includes("Importé le") || nom.includes("myContacts") || nom.includes("Restaurés")) return true;
    if (/^[,;]+/.test(nom)) return true;
    if ((nom.match(/,/g)||[]).length > 3) return true;
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

        const email = row["E-mail Address"] || row["E-mail 2 Address"] || row["email"] || row["Email"] || row["mail"] || "";
        const telephone = row["Mobile Phone"] || row["Home Phone"] || row["Primary Phone"] || row["Business Phone"] || row["telephone"] || row["Téléphone"] || row["phone"] || "";

        const exists = patients.find(p => p.nom.toLowerCase() === nom.toLowerCase());
        if (!exists) {
          const res = await sb.addPatient(token, user.id, { nom, email, telephone, notes: row.notes||row.Notes||"", categorie:"autre" });
          if (Array.isArray(res) && res[0]) { setPatients(prev => [...prev, res[0]]); added++; }
        }
      }
      setImporting(false);
      alert(`${added} patient(s) importé(s) avec succès !`);
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
    <div style={{ flex:1, display:"flex", overflow:"hidden", position:"relative", height:"100%" }}>
      {/* Modal nettoyage contacts sales */}
      {confirmClean && (
        <div style={{ position:"fixed", inset:0, background:"#00000050", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div className="card fade-up" style={{ maxWidth:440, width:"100%", padding:32 }}>
            <div style={{ fontSize:40, marginBottom:12, textAlign:"center" }}>🧹</div>
            <div style={{ fontWeight:800, fontSize:18, color:"#1e293b", marginBottom:8, textAlign:"center" }}>Nettoyer les contacts</div>
            <div style={{ fontSize:14, color:"#64748b", marginBottom:16, lineHeight:1.6, textAlign:"center" }}>
              <strong>{dirtyContacts.length} contacts invalides</strong> détectés — sans nom ou mal formatés.
            </div>
            <div style={{ background:"#fff8f0", border:"1px solid #fed7aa", borderRadius:10, padding:14, marginBottom:20, maxHeight:160, overflowY:"auto" }}>
              {dirtyContacts.slice(0,10).map(p => (
                <div key={p.id} style={{ fontSize:12, color:"#92400e", padding:"3px 0", borderBottom:"1px solid #fed7aa30" }}>
                  ⚠️ {p.nom?.substring(0,60) || "(vide)"}
                </div>
              ))}
              {dirtyContacts.length > 10 && <div style={{ fontSize:11, color:"#f97316", marginTop:6 }}>...et {dirtyContacts.length - 10} autres</div>}
            </div>
            <div style={{ display:"flex", gap:12 }}>
              <button className="btn btn-outline" onClick={()=>setConfirmClean(false)} style={{ flex:1 }}>Annuler</button>
              <button onClick={handleCleanContacts} style={{ flex:2, background:"#f97316", color:"#fff", border:"none", borderRadius:8, padding:"12px", cursor:"pointer", fontWeight:700, fontSize:14 }}>
                🧹 Supprimer ces {dirtyContacts.length} contacts
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
            <div style={{ fontWeight:800, fontSize:18, color:"#1e293b", marginBottom:10 }}>Supprimer tous les contacts ?</div>
            <div style={{ fontSize:14, color:"#64748b", marginBottom:28, lineHeight:1.6 }}>
              Cette action supprimera <strong>{patients.length} contacts</strong> définitivement. Les RDV existants ne seront pas supprimés.
            </div>
            <div style={{ display:"flex", gap:12 }}>
              <button className="btn btn-outline" onClick={()=>setConfirmDeleteAll(false)} style={{ flex:1 }}>Annuler</button>
              <button onClick={handleDeleteAll} style={{ flex:1, background:"#ef4444", color:"#fff", border:"none", borderRadius:8, padding:"12px", cursor:"pointer", fontWeight:700, fontSize:14 }}>
                Tout supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal édition patient */}
      {editingPatient && (
        <div style={{ position:"fixed", inset:0, background:"#00000040", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div className="card fade-up" style={{ width:"100%", maxWidth:480, padding:32, maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ fontWeight:800, fontSize:18, marginBottom:20 }}>✏️ Modifier la fiche client</div>
            {[
              { key:"nom", label:"NOM COMPLET *", placeholder:"Nom complet", type:"text" },
              { key:"email", label:"EMAIL", placeholder:"email@...", type:"email" },
              { key:"telephone", label:"TÉLÉPHONE", placeholder:"06...", type:"text" },
              { key:"date_naissance", label:"DATE DE NAISSANCE", placeholder:"JJ/MM/AAAA", type:"text" },
              { key:"adresse", label:"ADRESSE COMPLÈTE", placeholder:"12 rue de la Paix, 75001 Paris", type:"text" },
            ].map(field => (
              <div key={field.key} style={{ marginBottom:14 }}>
                <div className="field-label">{field.label}</div>
                <input type={field.type} placeholder={field.placeholder} defaultValue={editingPatient[field.key]||""} id={`edit-${field.key}`} />
              </div>
            ))}
            <div style={{ marginBottom:20 }}>
              <div className="field-label">NOTES</div>
              <textarea rows={3} placeholder="Informations importantes..." defaultValue={editingPatient.notes||""} id="edit-notes" />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="btn btn-outline" onClick={()=>setEditingPatient(null)} style={{ flex:1 }}>Annuler</button>
              <button className="btn btn-primary" onClick={()=>{
                const data = {};
                ["nom","email","telephone","date_naissance","adresse"].forEach(k => {
                  data[k] = document.getElementById(`edit-${k}`).value;
                });
                data.notes = document.getElementById("edit-notes").value;
                handleUpdatePatient(data);
              }} style={{ flex:2 }}>💾 Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
      {/* Liste patients */}
      <div style={{ width:320, borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
        <div style={{ padding:"16px", borderBottom:"1px solid #e2e8f0", background:"#fff" }}>
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            <input placeholder="🔍 Rechercher un patient..." value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:1, fontSize:13 }} />
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ fontSize:12, padding:"6px 8px", borderRadius:8, border:"1px solid var(--border)", background:"var(--input-bg)", color:"var(--text)", cursor:"pointer" }}>
              <option value="nom">A→Z</option>
              <option value="rdv">RDV ↓</option>
              <option value="date">Récent</option>
            </select>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn btn-primary btn-sm" onClick={()=>setShowAdd(true)} style={{ flex:1 }}>+ Ajouter</button>
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
            <button className="btn btn-sm" onClick={()=>setConfirmDeleteAll(true)} style={{ background:"#fff5f5", border:"1px solid #fecaca", color:"#ef4444", borderRadius:8, padding:"6px 10px", cursor:"pointer", fontSize:12 }}>🗑️ Tout</button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 20px" }}>
              <div style={{ fontSize:36, marginBottom:8 }}>👥</div>
              <div style={{ color:"#94a3b8", fontSize:13 }}>Aucun patient trouvé</div>
              <div style={{ color:"#cbd5e1", fontSize:11, marginTop:4 }}>Ils s'ajoutent automatiquement à chaque RDV</div>
            </div>
          ) : filtered.map(p => (
            <div key={p.id} onClick={()=>{ setSelected(p); setTimeout(()=>{ document.getElementById("patients-right-panel")?.scrollTo({top:0,behavior:"smooth"}); window.scrollTo({top:0,behavior:"smooth"}); }, 50); }}
              style={{ padding:"14px 16px", borderBottom:"1px solid #f1f5f9", cursor:"pointer", background:selected?.id===p.id?"#f0f4ff":"#fff", display:"flex", alignItems:"center", gap:12, transition:"background .15s" }}>
              <div style={{ width:38, height:38, borderRadius:"50%", background:catColors[p.categorie]||"#94a3b8", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:15, flexShrink:0 }}>
                {p.nom[0]?.toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13, color:"#1e293b", marginBottom:2 }}>{p.nom}</div>
                <div style={{ fontSize:11, color:"#94a3b8" }}>{getPatientRdvs(p.nom).length} RDV</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:"12px 16px", borderTop:"1px solid #e2e8f0", background:"#f8fafc" }}>
          <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"DM Mono" }}>{patients.length} patient(s) au total</div>
        </div>
      </div>

      {/* Fiche patient */}
      <div id="patients-right-panel" style={{ flex:1, overflowY:"auto", padding:24 }}>
        {showAdd ? (
          <div className="card fade-up" style={{ maxWidth:480 }}>
            <div style={{ fontWeight:800, fontSize:18, marginBottom:20 }}>➕ Nouveau patient</div>
            <div style={{ marginBottom:14 }}><div className="field-label">NOM *</div><input placeholder="Nom complet" value={form.nom} onChange={e=>setForm(p=>({...p,nom:e.target.value}))} /></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
              <div><div className="field-label">EMAIL</div><input type="email" placeholder="email@..." value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} /></div>
              <div><div className="field-label">TÉLÉPHONE</div><input placeholder="06..." value={form.telephone} onChange={e=>setForm(p=>({...p,telephone:e.target.value}))} /></div>
            </div>
            <div style={{ marginBottom:14 }}><div className="field-label">NOTES</div><textarea rows={3} placeholder="Informations importantes..." value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} /></div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="btn btn-outline" onClick={()=>setShowAdd(false)} style={{ flex:1 }}>Annuler</button>
              <button className="btn btn-primary" onClick={handleAdd} style={{ flex:2 }}>Ajouter le patient</button>
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
                <div style={{ fontSize:12, color:"#94a3b8" }}>Client depuis {new Date(selected.created_at).toLocaleDateString("fr-FR")} · {getPatientRdvs(selected.nom).length} RDV</div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setEditingPatient(selected)} style={{ background:"#f0f4ff", border:"1px solid #1e3a5f30", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontSize:12, color:"#1e3a5f", fontWeight:600 }}>✏️ Modifier</button>
                <button onClick={()=>handleDelete(selected.id)} style={{ background:"#fff5f5", border:"1px solid #fecaca", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontSize:12, color:"#ef4444", fontWeight:600 }}>🗑️</button>
              </div>
            </div>

            {/* Coordonnées */}
            <div className="card" style={{ marginBottom:16 }}>
              <div className="field-label" style={{ marginBottom:14 }}>COORDONNÉES</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                {[
                  { icon:"📧", label:"Email", value:selected.email },
                  { icon:"📞", label:"Téléphone", value:selected.telephone },
                  { icon:"🎂", label:"Date de naissance", value:selected.date_naissance },
                  { icon:"📍", label:"Adresse", value:selected.adresse },
                ].map(({icon,label,value}) => (
                  <div key={label} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                    <span style={{ fontSize:18, marginTop:1 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"DM Mono", marginBottom:2 }}>{label}</div>
                      <div style={{ fontSize:13, fontWeight:600, color: value ? "#1e293b" : "#cbd5e1" }}>{value || "Non renseigné"}</div>
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
              <div className="field-label" style={{ marginBottom:12 }}>📅 HISTORIQUE DES RDV</div>
              {getPatientRdvs(selected.nom).length === 0 ? (
                <div style={{ color:"#94a3b8", fontSize:13, padding:"20px 0", textAlign:"center" }}>Aucun RDV enregistré pour ce client</div>
              ) : getPatientRdvs(selected.nom).sort((a,b) => b.date > a.date ? 1 : -1).map((rdv,i) => (
                <div key={i} style={{ display:"flex", gap:12, alignItems:"center", padding:"12px 0", borderBottom:"1px solid #f1f5f9" }}>
                  <div style={{ width:4, height:48, borderRadius:4, background:catColors[rdv.categorie]||"#94a3b8", flexShrink:0 }}></div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:13, marginBottom:2 }}>{rdv.titre||"Rendez-vous"}</div>
                    <div style={{ fontSize:11, color:"#94a3b8" }}>📅 {rdv.date}{rdv.heure?` à ${rdv.heure}`:""}</div>
                    {rdv.lieu && <div style={{ fontSize:11, color:"#94a3b8" }}>📍 {rdv.lieu}</div>}
                  </div>
                  <div style={{ fontSize:11, background:(catColors[rdv.categorie]||"#94a3b8")+"20", color:catColors[rdv.categorie]||"#94a3b8", padding:"3px 10px", borderRadius:20, fontWeight:600 }}>
                    {rdv.categorie||"autre"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign:"center", padding:"80px 40px" }}>
            <div style={{ fontSize:56, marginBottom:16 }}>👥</div>
            <div style={{ fontWeight:700, fontSize:18, color:"#1e293b", marginBottom:8 }}>Vos patients & clients</div>
            <div style={{ color:"#94a3b8", fontSize:14, lineHeight:1.7 }}>Sélectionnez un patient pour voir sa fiche,<br/>ou ajoutez-en un manuellement.<br/><br/>💡 Ils s'ajoutent automatiquement à chaque nouveau RDV !</div>
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
      new Notification("CallRDV IA 📞", {
        body: "Notifications activées ! Vous recevrez vos rappels directement ici.",
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
    await sb.updateProfile(token, user.id, { rappels, email });
    onSave({ rappels, email });
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1500);
  };

  const options = [
    { value:"j-3", label:"3 jours avant", icon:"📅" },
    { value:"j-1", label:"La veille", icon:"🔔" },
    { value:"j-0", label:"Le matin même", icon:"☀️" },
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000040", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div className="card fade-up" style={{ width:"100%", maxWidth:420, padding:32 }}>
        <div style={{ fontWeight:800, fontSize:20, marginBottom:4, color:"#1e293b" }}>⚙️ Paramètres</div>
        <div style={{ fontSize:13, color:"#94a3b8", marginBottom:24 }}>Configurez vos rappels de rendez-vous</div>

        <div style={{ marginBottom:20 }}>
          <div className="field-label">EMAIL POUR LES RAPPELS</div>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="votre@email.com" />
          <div style={{ fontSize:11, color:"#94a3b8", marginTop:6 }}>Les rappels seront envoyés à cette adresse</div>
        </div>

        <div style={{ marginBottom:24 }}>
          <div className="field-label">QUAND RECEVOIR LES RAPPELS</div>
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

        {saved && <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:13, color:"#16a34a", fontWeight:600 }}>✅ Paramètres sauvegardés !</div>}

        <div style={{ display:"flex", gap:10 }}>
          {/* Notifications Push */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
            📲 Notifications push
          </div>

          {notifPermission === "denied" && (
            <div style={{ background:"#fff5f5", border:"1px solid #fecaca", borderRadius:10, padding:12, marginBottom:14, fontSize:12, color:"#ef4444" }}>
              ⚠️ Notifications bloquées dans votre navigateur. Modifiez les paramètres de votre navigateur pour les autoriser.
            </div>
          )}

          {notifPermission !== "granted" && notifPermission !== "denied" && (
            <button onClick={requestPushPermission} style={{ width:"100%", background:"#f0f4ff", border:"1px solid #1e3a5f30", borderRadius:10, padding:"12px 16px", cursor:"pointer", fontSize:13, fontWeight:600, color:"#1e3a5f", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              🔔 Activer les notifications push
            </button>
          )}

          {notifPermission === "granted" && (
            <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:12, marginBottom:14, fontSize:12, color:"#16a34a", display:"flex", alignItems:"center", gap:8 }}>
              ✅ Notifications autorisées
            </div>
          )}

          {notifPermission === "granted" && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {[
                { label:"Activer les notifications push", value:pushEnabled, set:setPushEnabled },
                { label:"Rappel J-3 par notification", value:pushJ3, set:setPushJ3 },
                { label:"Rappel J-1 par notification", value:pushJ1, set:setPushJ1 },
                { label:"Confirmation de création RDV", value:pushConfirm, set:setPushConfirm },
              ].map(({label, value, set}) => (
                <div key={label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", background:"#f8fafc", borderRadius:8 }}>
                  <span style={{ fontSize:13, color:"#475569" }}>{label}</span>
                  <div
                    onClick={()=>set(!value)}
                    style={{ width:44, height:24, borderRadius:12, background:value?"#1e3a5f":"#e2e8f0", cursor:"pointer", position:"relative", transition:"background .2s" }}>
                    <div style={{ position:"absolute", top:3, left:value?20:3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left .2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="btn btn-outline" onClick={onClose} style={{ flex:1 }}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex:2, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            {saving ? <span className="spinner"></span> : "💾 Sauvegarder"}
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
    if (!SR) { alert("Reconnaissance vocale non supportée sur ce navigateur. Utilisez Chrome."); return; }
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

function RdvForm({ onSave, onCancel }) {
  const prefillNom = window.__prefillNom || "";
  const prefillPatient = window.__prefillPatient || null;
  window.__prefillNom = null;
  window.__prefillPatient = null;

  const [form, setForm] = useState({
    titre: "",
    personne: prefillNom,
    date: "",
    heure: "",
    lieu: "",
    adresse: "",
    notes: "",
    categorie: "autre",
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

  const categories = [
    { value:"medical",   label:"🏥 Médical",              titre:"Consultation médicale" },
    { value:"dentiste",  label:"🦷 Dentiste",             titre:"Chez le dentiste" },
    { value:"kine",      label:"💪 Kiné / Ostéo",         titre:"Séance kiné" },
    { value:"veterinaire",label:"🐾 Vétérinaire",         titre:"Chez le vétérinaire" },
    { value:"garage",    label:"🔧 Garage / Voiture",     titre:"Révision voiture" },
    { value:"travaux",   label:"🏠 Travaux / Artisan",    titre:"Intervention artisan" },
    { value:"juridique", label:"⚖️ Notaire / Avocat",     titre:"RDV juridique" },
    { value:"banque",    label:"🏦 Banque / Assurance",   titre:"RDV banque" },
    { value:"beaute",    label:"💈 Coiffeur / Beauté",    titre:"Chez le coiffeur" },
    { value:"restaurant", label:"🍽️ Restaurant / Traiteur",  titre:"Réservation restaurant" },
    { value:"formation", label:"🎓 Formation / Scolaire", titre:"Réunion scolaire" },
    { value:"pro",       label:"💼 Professionnel",        titre:"Réunion professionnelle" },
    { value:"perso",     label:"👤 Personnel",            titre:"RDV personnel" },
    { value:"autre",     label:"📋 Autre",                titre:"Rendez-vous" },
  ];

  const handleCategorie = (val) => {
    const cat = categories.find(c => c.value === val);
    setForm(prev => ({ ...prev, categorie: val, titre: prev.titre || (cat ? cat.titre : "Rendez-vous") }));
  };

  const isValid = form.personne.trim() && form.date.trim();

  // Champs dynamiques par catégorie
  const champsSpecifiques = {
    medical: [
      { key:"telephone", label:"TÉLÉPHONE", placeholder:"06...", type:"text" },
      { key:"motif", label:"MOTIF DE CONSULTATION", placeholder:"Douleur, contrôle, renouvellement...", type:"text" },
      { key:"medecin", label:"MÉDECIN / SPÉCIALISTE", placeholder:"Dr. Martin, Cardiologue...", type:"text" },
    ],
    restaurant: [
      { key:"nb_personnes", label:"NOMBRE DE PERSONNES", placeholder:"2", type:"number" },
      { key:"heure_arrivee", label:"HEURE D'ARRIVÉE", placeholder:"20h00", type:"text" },
      { key:"demandes", label:"DEMANDES SPÉCIALES", placeholder:"Table en terrasse, anniversaire, allergie...", type:"text" },
    ],
    garage: [
      { key:"vehicule", label:"MARQUE / MODÈLE", placeholder:"Renault Clio, Peugeot 308...", type:"text" },
      { key:"immat", label:"IMMATRICULATION", placeholder:"AB-123-CD", type:"text" },
      { key:"intervention", label:"TYPE D'INTERVENTION", placeholder:"Révision, freins, courroie...", type:"text" },
    ],
    juridique: [
      { key:"type_dossier", label:"TYPE DE DOSSIER", placeholder:"Succession, divorce, immobilier...", type:"text" },
      { key:"documents", label:"DOCUMENTS À APPORTER", placeholder:"CNI, contrat, acte...", type:"text" },
    ],
    travaux: [
      { key:"type_travaux", label:"TYPE DE TRAVAUX", placeholder:"Plomberie, électricité, peinture...", type:"text" },
      { key:"acces", label:"ACCÈS / DIGICODE", placeholder:"Code d'accès, étage, interphone...", type:"text" },
    ],
    beaute: [
      { key:"prestation", label:"PRESTATION", placeholder:"Coupe, couleur, brushing...", type:"text" },
      { key:"coiffeur", label:"PRÉFÉRENCE COIFFEUR", placeholder:"Nom du coiffeur souhaité", type:"text" },
    ],
    banque: [
      { key:"type_rdv", label:"TYPE DE RDV", placeholder:"Crédit, investissement, compte...", type:"text" },
      { key:"documents", label:"DOCUMENTS À APPORTER", placeholder:"Bulletins de salaire, avis d'imposition...", type:"text" },
    ],
    veterinaire: [
      { key:"animal", label:"NOM DE L'ANIMAL", placeholder:"Rex, Mimi...", type:"text" },
      { key:"espece", label:"ESPÈCE / RACE", placeholder:"Chien Labrador, Chat Siamois...", type:"text" },
      { key:"motif_veto", label:"MOTIF", placeholder:"Vaccination, contrôle, urgence...", type:"text" },
    ],
  };

  const champs = champsSpecifiques[form.categorie] || [];

  return (
    <div className="form-open" style={{ maxWidth:560 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:28 }}>
        <div style={{ width:48, height:48, background:"#1e3a5f20", border:"1px solid #1e3a5f40", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>📋</div>
        <div>
          <div style={{ fontWeight:800, fontSize:22, letterSpacing:"-0.02em" }}>Nouveau rendez-vous</div>
          <div style={{ fontSize:12, color:"#94a3b8", fontFamily:"DM Mono", marginTop:2 }}>Remplissez les details de votre appel</div>
        </div>
      </div>

      {/* Categorie */}
      <div style={{ marginBottom:20 }}>
        <div className="field-label">TYPE DE RDV</div>
        <select value={form.categorie} onChange={e=>handleCategorie(e.target.value)}
          style={{ appearance:"none", WebkitAppearance:"none", backgroundImage:"url('data:image/svg+xml;utf8,<svg fill=\"%23c8f542\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path d=\"M7 10l5 5 5-5z\"/></svg>')", backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center", backgroundSize:20, paddingRight:40 }}>
          {categories.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Titre */}
      <div style={{ marginBottom:16 }}>
        <div className="field-label">TITRE DU RDV</div>
        <input placeholder="Ex: Consultation Dr. Martin, Revision Renault..." value={form.titre} onChange={e=>set("titre",e.target.value)} />
      </div>

      {/* Personne + Date */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
        <div>
          <div className="field-label">PERSONNE / CONTACT *</div>
          <div style={{ position:"relative" }}>
            <input placeholder="Dr. Martin, Garage Renault..." value={form.personne} onChange={e=>set("personne",e.target.value)} style={{ paddingRight:42 }} />
            <button onClick={speechPersonne.listening ? speechPersonne.stop : speechPersonne.start}
              style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:18, color: speechPersonne.listening ? "#ff4444" : "#1e3a5f" }}>
              {speechPersonne.listening ? "⏹" : "🎤"}
            </button>
          </div>
        </div>
        <div>
          <div className="field-label">DATE *</div>
          <input type="date" value={form.date} onChange={e=>set("date",e.target.value)}
            style={{ colorScheme:"dark" }} />
        </div>
      </div>

      {/* Heure */}
      <div style={{ marginBottom:16 }}>
        <div className="field-label">HEURE</div>
        <input type="time" value={form.heure} onChange={e=>set("heure",e.target.value)}
          style={{ colorScheme:"dark" }} />
      </div>

      {/* Lieu + Adresse */}
      <div style={{ marginBottom:16 }}>
        <div className="field-label">LIEU</div>
        <div style={{ position:"relative" }}>
          <input placeholder="Ex: Cabinet médical, Garage Renault, Domicile..." value={form.lieu} onChange={e=>set("lieu",e.target.value)} style={{ paddingRight:42 }} />
          <button onClick={speechLieu.listening ? speechLieu.stop : speechLieu.start}
            style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:18, color: speechLieu.listening ? "#ff4444" : "#1e3a5f" }}>
            {speechLieu.listening ? "⏹" : "🎤"}
          </button>
        </div>
      </div>
      <div style={{ marginBottom:16 }}>
        <div className="field-label">ADRESSE COMPLETE</div>
        <input placeholder="Ex: 12 rue de la Paix, 75001 Paris..." value={form.adresse} onChange={e=>set("adresse",e.target.value)} />
      </div>

      {/* Champs dynamiques par catégorie */}
      {champs.length > 0 && (
        <div style={{ background:"#f8faff", border:"1px solid #e2e8f0", borderRadius:12, padding:16, marginBottom:20 }}>
          <div style={{ fontSize:11, color:"#1e3a5f", fontFamily:"DM Mono", fontWeight:700, marginBottom:14 }}>
            ✨ INFORMATIONS SPÉCIFIQUES
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
        <div className="field-label">NOTES / INFORMATIONS COMPLEMENTAIRES</div>
        <div style={{ position:"relative" }}>
          <textarea rows={3} placeholder="Documents à apporter, motif de la visite, informations importantes..." value={form.notes} onChange={e=>set("notes",e.target.value)} style={{ paddingRight:48 }} />
          <button onClick={speechNotes.listening ? speechNotes.stop : speechNotes.start}
            style={{ position:"absolute", right:10, top:12, background:"none", border:"none", cursor:"pointer", fontSize:20, color: speechNotes.listening ? "#ff4444" : "#1e3a5f" }}>
            {speechNotes.listening ? "⏹" : "🎤"}
          </button>
        </div>
        {speechNotes.listening && (
          <div style={{ fontSize:11, color:"#ff4444", fontFamily:"DM Mono", marginTop:6, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ animation:"blink 1s infinite", display:"inline-block" }}>●</span> Parlez maintenant...
          </div>
        )}
      </div>

      {/* Privacy badge */}
      <div className="privacy-badge" style={{ marginBottom:20 }}>
        <span style={{ fontSize:14 }}>🔒</span>
        <div style={{ fontSize:11, color:"#0369a1", fontFamily:"DM Mono", lineHeight:1.5 }}>
          <span style={{ color:"#0284c7", fontWeight:700 }}>Donnees protegees — </span>
          Vos informations sont stockees uniquement sur votre appareil. Conforme RGPD.
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display:"flex", gap:10 }}>
        <button className="btn btn-outline" onClick={onCancel} style={{ flex:1 }}>Annuler</button>
        <button className="btn btn-primary" onClick={()=>isValid&&onSave({ ...form, id:"rdv_"+Date.now(), confirmedAt:new Date().toLocaleTimeString("fr-FR") })}
          disabled={!isValid} style={{ flex:2, padding:"15px" }}>
          ✓ Enregistrer le RDV
        </button>
      </div>
      {!isValid && <div style={{ fontSize:11, color:"#ff9a3c", fontFamily:"DM Mono", marginTop:10, textAlign:"center" }}>⚠ Personne et date sont obligatoires</div>}
    </div>
  );
}

// ── Landing Page ─────────────────────────────────────────────
function LandingPage({ onLogin }) {
  const LP_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
    .lp-body { font-family: "DM Sans", sans-serif; background: #fafaf8; color: #0f2340; overflow-x: hidden; }
    .lp-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 20px 60px; background: rgba(250,250,248,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid #e2e8f0; }
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
      <style>{LP_CSS}</style>

      {/* NAV */}
      <nav className="lp-nav">
        <div className="lp-logo">📞 CallRDV IA <span>BETA</span></div>
        <div className="lp-nav-links">
          <a href="#lp-features">Fonctionnalités</a>
          <a href="#lp-demo">Démo</a>
          <a href="#lp-pricing">Tarifs</a>
          <button className="lp-btn-nav" onClick={onLogin}>Se connecter →</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-hero-grid"></div>
        <div className="lp-hero-content">
          <div className="lp-badge">🟢 Disponible maintenant — offre de lancement</div>
          <h1 className="lp-h1">Vos rendez-vous,<br/><em>organisés en secondes</em></h1>
          <p className="lp-sub">CallRDV IA transforme chaque appel téléphonique en rendez-vous structuré. Recherchez votre client, remplissez la fiche, et c'est fait.</p>
          <div className="lp-actions">
            <button className="lp-btn-primary" onClick={onLogin}>Commencer gratuitement →</button>
            <a href="#lp-demo" className="lp-btn-secondary">Voir la démo</a>
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
            <div className="lp-search">🔍 Rechercher un client...</div>
            <div className="lp-rdv">
              <div className="lp-rdv-dot" style={{background:"#3b82f6"}}></div>
              <div><div className="lp-rdv-title">Dr. Martin — Consultation</div><div className="lp-rdv-sub">Demain à 14h00 · Cabinet</div></div>
              <div className="lp-rdv-tag" style={{background:"#3b82f620",color:"#3b82f6"}}>médical</div>
            </div>
            <div className="lp-rdv">
              <div className="lp-rdv-dot" style={{background:"#f59e0b"}}></div>
              <div><div className="lp-rdv-title">Garage Dupont — Révision</div><div className="lp-rdv-sub">15 mars · Renault Clio</div></div>
              <div className="lp-rdv-tag" style={{background:"#f59e0b20",color:"#f59e0b"}}>garage</div>
            </div>
            <div className="lp-rdv">
              <div className="lp-rdv-dot" style={{background:"#8b5cf6"}}></div>
              <div><div className="lp-rdv-title">Maître Leblanc — Dossier</div><div className="lp-rdv-sub">18 mars à 16h00 · Cabinet</div></div>
              <div className="lp-rdv-tag" style={{background:"#8b5cf620",color:"#8b5cf6"}}>juridique</div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="lp-stats">
        {[["2min","pour créer un RDV"],["13","catégories disponibles"],["J-3","rappels automatiques"],["100%","conforme RGPD"]].map(([n,l])=>(
          <div key={l} className="lp-stat"><div className="lp-stat-num">{n}</div><div className="lp-stat-label">{l}</div></div>
        ))}
      </div>

      {/* FEATURES */}
      <section className="lp-section" id="lp-features">
        <div className="lp-label">Fonctionnalités</div>
        <h2 className="lp-h2">Tout ce qu'il vous faut<br/>pour gérer vos RDV</h2>
        <p className="lp-section-sub">Une interface pensée pour aller vite. Pas de formation, pas de complexité — juste l'essentiel.</p>
        <div className="lp-features-grid">
          {[
            {icon:"🔍",title:"Recherche client instantanée",desc:"Tapez le nom de votre client et sa fiche apparaît automatiquement avec tout son historique."},
            {icon:"📋",title:"Fiches intelligentes par catégorie",desc:"Médecin, restaurant, garage, juridique — chaque type de RDV a ses propres champs adaptés."},
            {icon:"🔔",title:"Rappels automatiques",desc:"Vos clients reçoivent un email de rappel 3 jours et 1 jour avant leur RDV. Automatiquement."},
            {icon:"📅",title:"Agenda complet",desc:"Vue semaine, mois ou liste. Exportez vers Google Calendar ou Outlook en un clic."},
            {icon:"📊",title:"Tableau de bord",desc:"Suivez votre activité : RDV par semaine, catégories les plus fréquentes, évolution sur 6 mois."},
            {icon:"📄",title:"Export PDF",desc:"Générez un planning PDF propre et professionnel en un clic depuis votre agenda."},
          ].map(({icon,title,desc})=>(
            <div key={title} className="lp-feature">
              <div className="lp-feature-icon">{icon}</div>
              <div className="lp-feature-title">{title}</div>
              <div className="lp-feature-desc">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* VIDEO */}
      <section className="lp-video-section" id="lp-demo">
        <div className="lp-video-inner">
          <div className="lp-label">Démo</div>
          <h2 className="lp-h2">Voyez CallRDV IA en action</h2>
          <p style={{fontSize:15,color:"#64748b",fontWeight:300}}>De la recherche client à la confirmation du RDV — en moins de 2 minutes.</p>
          <div className="lp-video-box">
            <div className="lp-play"></div>
            <div className="lp-video-label">Démo disponible bientôt</div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="lp-pricing-section" id="lp-pricing">
        <div className="lp-label">Tarifs</div>
        <h2 className="lp-h2">Simple et transparent</h2>
        <p className="lp-section-sub">Commencez gratuitement. Passez au Pro quand vous êtes prêt.</p>
        <div className="lp-pricing-grid">
          <div className="lp-plan">
            <div className="lp-plan-name">Gratuit</div>
            <div className="lp-plan-price">0€</div>
            <div className="lp-plan-period">pour toujours</div>
            <div className="lp-plan-divider"></div>
            <ul><li>10 RDV par mois</li><li>Fiches clients de base</li><li>Agenda semaine / mois</li><li>Export Google Calendar</li></ul>
            <button className="lp-plan-cta lp-plan-cta-outline" onClick={onLogin}>Commencer →</button>
          </div>
          <div className="lp-plan featured">
            <div className="lp-plan-badge">🎁 1er mois offert</div>
            <div className="lp-plan-name">Pro</div>
            <div className="lp-plan-price">9€</div>
            <div className="lp-plan-period">par mois · sans engagement</div>
            <div className="lp-plan-divider"></div>
            <ul><li>RDV illimités</li><li>Fiches clients complètes</li><li>Rappels email automatiques</li><li>Export PDF</li><li>Tableau de bord stats</li></ul>
            <a href="https://buy.stripe.com/00w8wPf3R8fkd0meNgcMM00?success_url=https://callrdv.com?success=1" className="lp-plan-cta lp-plan-cta-filled">Essayer 1 mois gratuit →</a>
          </div>
          <div className="lp-plan">
            <div className="lp-plan-badge" style={{background:"#1e3a5f",color:"#fff"}}>🚀 Offre lancement</div>
            <div className="lp-plan-name">Business</div>
            <div className="lp-plan-price">29€</div>
            <div className="lp-plan-period">par mois · sans engagement</div>
            <div className="lp-plan-divider"></div>
            <ul><li>Tout le plan Pro</li><li>Multi-utilisateurs</li><li>Import CSV patients</li><li>Support prioritaire</li><li>1er mois offert</li></ul>
            <a href="https://buy.stripe.com/eVqdR93l9ans2lIgVocMM01?success_url=https://callrdv.com?success=1" className="lp-plan-cta lp-plan-cta-outline">Démarrer →</a>
          </div>
        </div>
        <div className="lp-promo-note">⏳ Offres de lancement valables jusqu'au <span>30 avril 2026</span></div>
      </section>

      {/* TESTIMONIALS */}
      <section className="lp-testi-section">
        <div className="lp-testi-inner">
          <div className="lp-label">Témoignages</div>
          <h2 className="lp-h2">Ils nous font confiance</h2>
          <div className="lp-testi-grid">
            {[
              {init:"S",name:"Sophie M.",role:"Assistante médicale",text:"Enfin une app simple pour noter mes RDV après chaque appel. Plus aucun oubli !"},
              {init:"K",name:"Karim B.",role:"Gérant de garage",text:"Les rappels automatiques ont changé ma vie. Mes clients arrivent toujours à l'heure maintenant."},
              {init:"A",name:"Amina L.",role:"Avocate",text:"Interface claire, rapide à prendre en main. Exactement ce qu'il me fallait pour mon cabinet."},
            ].map(({init,name,role,text})=>(
              <div key={name} className="lp-testi">
                <div className="lp-stars">★★★★★</div>
                <div className="lp-testi-text">"{text}"</div>
                <div className="lp-author">
                  <div className="lp-avatar">{init}</div>
                  <div><div className="lp-author-name">{name}</div><div className="lp-author-role">{role}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta-section">
        <div className="lp-cta-content">
          <h2 className="lp-cta-title">Prêt à simplifier<br/>votre gestion de RDV ?</h2>
          <p className="lp-cta-sub">Rejoignez CallRDV IA — gratuit pour commencer, sans carte bancaire.</p>
          <button className="lp-btn-primary" style={{fontSize:16,padding:"16px 36px"}} onClick={onLogin}>Créer mon compte gratuitement →</button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-logo">📞 CallRDV IA</div>
        <div className="lp-footer-links"><a href="#">Confidentialité</a><a href="#">CGU</a><a href="#">Contact</a></div>
        <div className="lp-footer-copy">© 2026 CallRDV IA · Conforme RGPD</div>
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
  const { user, loading, signIn, signUp, signOut, updateUser } = auth;
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

  // Récupérer session Google après redirect OAuth
  useEffect(() => {
    sb.getSessionFromUrl().then(async (tk) => {
      if (!tk) return;
      const r = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": CONFIG.SUPABASE_ANON_KEY, "Authorization": `Bearer ${tk}` }
      });
      const u = await r.json();
      if (u.id) {
        await delay(600);
        const profile = await sb.getProfile(tk, u.id);
        updateUser({ id: u.id, email: u.email, name: profile?.name || u.user_metadata?.full_name || "", plan: profile?.plan || "free", usage: profile?.usage || 0, token: tk });
      }
    });
  }, []);

  const handleDeleteRdv = async (id) => {
    if (!window.confirm("Supprimer ce rendez-vous ?")) return;
    await sb.deleteAppointment(token, id);
    setAppts(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateStatut = async (id, statut) => {
    await sb.updateAppointment(token, id, { statut });
    setAppts(prev => prev.map(r => r.id === id ? { ...r, statut } : r));
  };

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
        sendPushNotif("📅 RDV dans 3 jours", `${rdv.titre||"RDV"} avec ${rdv.personne} le ${rdv.date}${rdv.heure?" à "+rdv.heure:""}`);
      }
      if (diff === 1 && user.push_j1) {
        sendPushNotif("⏰ RDV demain !", `${rdv.titre||"RDV"} avec ${rdv.personne} demain${rdv.heure?" à "+rdv.heure:""}`);
      }
    });
  }, [appointments, user]);

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
      window.__prefillPatient = patient || null;
      setPhase("form");
    };
  }, [patients, canAdd]);

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
          setAppts(data.map(r => ({ ...r, confirmedAt: new Date(r.confirmed_at).toLocaleTimeString("fr-FR") })));
        }
      });
    }
  }, [user?.id]);

  const handleSave = async (rdv) => {
    // Sauvegarder dans Supabase
    const saved_res = await sb.addAppointment(token, user.id, {
      titre: rdv.titre, personne: rdv.personne, date: rdv.date,
      heure: rdv.heure, lieu: rdv.lieu, notes: rdv.notes || "", statut: rdv.statut
    });
    await sb.addAnalyse(token, user.id, true);

    // Notification push si activée
    if (user.push_confirm && user.push_enabled) {
      sendPushNotif("✅ RDV créé !", `${rdv.titre||"Rendez-vous"} avec ${rdv.personne} le ${rdv.date}${rdv.heure ? " à "+rdv.heure : ""}`);
    }

    // Ajout automatique du patient si nouveau
    if (rdv.personne) {
      const exists = patients.find(p => p.nom.toLowerCase() === rdv.personne.toLowerCase());
      if (!exists) {
        const newPatient = await sb.addPatient(token, user.id, {
          nom: rdv.personne,
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
    if (key==="free") { updateUser({ plan:"free" }); setPrice(false); return; }
    window.open(CONFIG.STRIPE_LINKS[key]||"#","_blank");
    updateUser({ plan:key }); setPrice(false);
  };

  if (!user) {
    if (showLanding) return <LandingPage onLogin={() => setShowLanding(false)} />;
    return (<><style>{CSS}</style><AuthPage authHooks={{ signIn, signUp, loading }} /></>);
  }

  return (
    <>
      <style>{CSS}</style>
      {showSettings && <SettingsModal user={user} token={token} sb={sb} onSave={(data)=>updateUser(data)} onClose={()=>setShowSettings(false)} />}
      {showPricing && <PricingModal currentPlan={user.plan} onUpgrade={handleUpgrade} onClose={()=>setPrice(false)} />}
      {calRdv && <CalendarModal rdv={calRdv} onClose={()=>setCalRdv(null)} onEdit={setEditingRdv} onDelete={handleDeleteRdv} onUpdateStatut={handleUpdateStatut} />}

      <div style={{ minHeight:"100vh", background:"var(--bg)", fontFamily:"'Inter',sans-serif", color:"var(--text)", display:"flex", flexDirection:"column", transition:"background .3s,color .3s" }}>

        {/* NAV */}
        <nav style={{ padding:"14px 24px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, background:"#1e3a5f", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>📞</div>
            <span style={{ fontWeight:800, fontSize:16 }}>CallRDV <span style={{ color:"#1e3a5f" }}>IA</span></span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"6px 14px", fontSize:11, color:"#94a3b8", fontFamily:"DM Mono" }}>
              {plan.quota===Infinity ? "illimite" : `${plan.quota-(user.usage||0)}/${plan.quota} restants`}
            </div>
            <div onClick={()=>setPrice(true)} style={{ background:"#fff", border:`1px solid ${plan.color}40`, borderRadius:10, padding:"6px 14px", fontSize:11, color:plan.color, fontFamily:"DM Mono", cursor:"pointer", fontWeight:700 }}>
              {plan.name.toUpperCase()}{user.plan==="free"&&<span style={{ color:"#1e3a5f", marginLeft:6 }}>↑</span>}
            </div>
            <button onClick={()=>setDarkMode(d=>!d)} style={{ background:"none", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:14 }} title={darkMode?"Mode clair":"Mode sombre"}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            <button onClick={()=>setShowSettings(true)} style={{ background:"none", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:14 }} title="Paramètres">⚙️</button>
            <div onClick={signOut} style={{ cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:28, height:28, background:"#e2e8f0", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>{user.name?.[0]?.toUpperCase()||"?"}</div>
              <span style={{ fontSize:12, color:"#94a3b8", fontFamily:"DM Mono" }}>Quitter</span>
            </div>
          </div>
        </nav>

        {/* Onglets */}
        <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", display:"flex", gap:0 }}>
          {[["📞","Appels","appels"],["📅","Agenda","agenda"],["👥","Patients/Clients","patients"],["📊","Stats","stats"]].map(([icon,label,tab]) => (
            <button key={label} onClick={()=>{ setShowAgenda(tab==="agenda"); setShowPatients(tab==="patients"); setShowStats(tab==="stats"); }}
              style={{ padding:"12px 28px", fontSize:14, fontWeight:600, fontFamily:"Inter,sans-serif", border:"none", cursor:"pointer", background:"transparent", borderBottom:(tab==="agenda"&&showAgenda)||(tab==="patients"&&showPatients)||(tab==="stats"&&showStats)||(tab==="appels"&&!showAgenda&&!showPatients&&!showStats)?"3px solid #1e3a5f":"3px solid transparent", color:(tab==="agenda"&&showAgenda)||(tab==="patients"&&showPatients)||(tab==="stats"&&showStats)||(tab==="appels"&&!showAgenda&&!showPatients&&!showStats)?"#1e3a5f":"#94a3b8", display:"flex", alignItems:"center", gap:8, transition:"all .2s" }}>
              {icon} {label}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

          {/* STATS VIEW */}
          {/* Stripe Success Modal */}
          {stripeSuccess && (
            <div style={{ position:"fixed", inset:0, background:"#00000060", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
              <div className="card fade-up" style={{ maxWidth:420, width:"100%", padding:40, textAlign:"center" }}>
                <div style={{ fontSize:64, marginBottom:16 }}>🎉</div>
                <div style={{ fontWeight:800, fontSize:22, color:"#1e293b", marginBottom:10 }}>Paiement réussi !</div>
                <div style={{ fontSize:15, color:"#64748b", lineHeight:1.7, marginBottom:28 }}>
                  Bienvenue dans le plan <strong>{user?.plan === "business" ? "Business" : "Pro"}</strong> !<br/>
                  Votre compte a été mis à jour. Profitez de toutes les fonctionnalités sans limite.
                </div>
                <button className="btn btn-primary" onClick={()=>{ setStripeSuccess(false); window.history.replaceState({}, "", window.location.pathname); }} style={{ width:"100%", padding:14 }}>
                  🚀 Commencer à utiliser CallRDV IA
                </button>
              </div>
            </div>
          )}

          {/* Onboarding nouveau utilisateur */}
          {showOnboarding && !showAgenda && !showPatients && !showStats && (
            <div style={{ position:"fixed", bottom:24, right:24, zIndex:150, maxWidth:320 }}>
              <div className="card fade-up" style={{ padding:24, boxShadow:"0 8px 32px rgba(30,58,95,0.2)", border:"2px solid #1e3a5f20" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                  <div style={{ fontWeight:700, fontSize:15, color:"#1e293b" }}>👋 Bienvenue sur CallRDV IA !</div>
                  <button onClick={()=>setDismissOnboarding(true)} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:16 }}>✕</button>
                </div>
                <div style={{ fontSize:13, color:"#64748b", lineHeight:1.7, marginBottom:16 }}>
                  Pour créer votre premier RDV :<br/>
                  1️⃣ Tapez le nom d'un client<br/>
                  2️⃣ Remplissez la fiche RDV<br/>
                  3️⃣ Confirmez !
                </div>
                <button className="btn btn-primary btn-sm" onClick={()=>setDismissOnboarding(true)} style={{ width:"100%" }}>
                  C'est compris ! ✓
                </button>
              </div>
            </div>
          )}

          {/* Modal modification RDV */}
          {editingRdv && (
            <div style={{ position:"fixed", inset:0, background:"#00000050", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24, overflowY:"auto" }}>
              <div className="card fade-up" style={{ width:"100%", maxWidth:500, padding:32, maxHeight:"90vh", overflowY:"auto" }}>
                <div style={{ fontWeight:800, fontSize:18, marginBottom:20 }}>✏️ Modifier le rendez-vous</div>
                {[
                  { key:"titre", label:"TITRE", type:"text" },
                  { key:"personne", label:"CONTACT / PERSONNE", type:"text" },
                  { key:"date", label:"DATE", type:"date" },
                  { key:"heure", label:"HEURE", type:"time" },
                  { key:"lieu", label:"LIEU", type:"text" },
                  { key:"adresse", label:"ADRESSE", type:"text" },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom:14 }}>
                    <div className="field-label">{f.label}</div>
                    <input type={f.type} defaultValue={editingRdv[f.key]||""} id={`edit-rdv-${f.key}`} />
                  </div>
                ))}
                <div style={{ marginBottom:14 }}>
                  <div className="field-label">STATUT</div>
                  <select id="edit-rdv-statut" defaultValue={editingRdv.statut||"en_attente"} style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14 }}>
                    <option value="en_attente">⏳ En attente</option>
                    <option value="confirme">✅ Confirmé</option>
                    <option value="reporte">🔄 Reporté</option>
                    <option value="annule">❌ Annulé</option>
                  </select>
                </div>
                <div style={{ marginBottom:20 }}>
                  <div className="field-label">NOTES</div>
                  <textarea rows={3} defaultValue={editingRdv.notes||""} id="edit-rdv-notes" />
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <button className="btn btn-outline" onClick={()=>setEditingRdv(null)} style={{ flex:1 }}>Annuler</button>
                  <button className="btn btn-primary" onClick={async ()=>{
                    const data = {};
                    ["titre","personne","date","heure","lieu","adresse"].forEach(k => { data[k] = document.getElementById(`edit-rdv-${k}`).value; });
                    data.statut = document.getElementById("edit-rdv-statut").value;
                    data.notes = document.getElementById("edit-rdv-notes").value;
                    await sb.updateAppointment(token, editingRdv.id, data);
                    setAppts(prev => prev.map(r => r.id === editingRdv.id ? { ...r, ...data } : r));
                    setEditingRdv(null);
                  }} style={{ flex:2 }}>💾 Sauvegarder</button>
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
              onNewCall={()=>{ setShowAgenda(false); setPhase("calling"); }}
              onCalRdv={setCalRdv}
              onEditRdv={setEditingRdv}
              onDeleteRdv={handleDeleteRdv}
              onUpdateStatut={handleUpdateStatut}
            />
          )}

          {/* MAIN */}
          {!showAgenda && !showPatients && !showStats && <div style={{ flex:1, padding:"28px", overflowY:"auto", borderRight:"1px solid #e2e8f0" }}>

            {/* IDLE */}
            {phase==="idle" && (
              <div className="fade-up">
                {saved && (
                  <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:12, padding:"14px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:12, animation:"slideIn .4s ease" }}>
                    <span style={{ fontSize:20 }}>✅</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:"#16a34a", marginBottom:2 }}>RDV enregistre avec succes !</div>
                      <div style={{ fontSize:11, color:"#0369a1", fontFamily:"DM Mono" }}>Retrouvez-le dans votre agenda a droite.</div>
                    </div>
                  </div>
                )}

                <h1 style={{ fontSize:28, fontWeight:800, letterSpacing:"-0.03em", lineHeight:1.2, marginBottom:10 }}>
                  Bonjour {user.name||""} 👋<br/><span style={{ color:"#1e3a5f" }}>Raccrochez, on s'occupe du reste.</span>
                </h1>
                <p style={{ color:"#94a3b8", fontSize:14, marginBottom:24, lineHeight:1.7 }}>
                  Demarrez un appel, puis raccrochez — la fiche de RDV s'ouvre automatiquement pour que vous puissiez saisir les details.
                </p>

                <div className="privacy-badge" style={{ marginBottom:20 }}>
                  <span style={{ fontSize:16 }}>🔒</span>
                  <div style={{ fontSize:11, color:"#0369a1", fontFamily:"DM Mono", lineHeight:1.6 }}>
                    <span style={{ color:"#0284c7", fontWeight:700 }}>Confidentialite garantie — </span>
                    Donnees stockees uniquement sur votre appareil. Zero stockage vocal. Conforme RGPD.
                  </div>
                </div>

                {!canAdd && (
                  <div style={{ background:"#fff5f5", border:"1px solid #ff6b6b30", borderRadius:14, padding:18, marginBottom:18 }}>
                    <div style={{ fontWeight:700, color:"#ff6b6b", marginBottom:6 }}>Quota mensuel atteint</div>
                    <div style={{ fontSize:13, color:"#7a4a4a", marginBottom:12 }}>Vous avez utilise vos {plan.quota} RDV gratuits ce mois.</div>
                    <button className="btn btn-primary btn-sm" onClick={()=>setPrice(true)}>Passer en Pro — 9€/mois</button>
                  </div>
                )}

                {/* How it works */}
                <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:16, padding:20, marginBottom:20 }}>
                  <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"DM Mono", letterSpacing:"0.1em", marginBottom:14 }}>COMMENT CA MARCHE</div>
                  {[
                    ["1","📞","Demarrez un appel","Appuyez sur le bouton et passez votre appel normalement"],
                    ["2","🔴","Raccrochez","Appuyez sur Raccrocher — la fiche RDV s'ouvre instantanement"],
                    ["3","📋","Remplissez la fiche","Saisissez lieu, adresse, notes... en quelques secondes"],
                    ["4","📅","C'est dans l'agenda !","Le RDV est enregistre et synchronisable avec votre calendrier"],
                  ].map(([num,icon,title,desc])=>(
                    <div key={num} style={{ display:"flex", gap:14, marginBottom:12, alignItems:"flex-start" }}>
                      <div style={{ width:28, height:28, borderRadius:8, background:"#1e3a5f15", border:"1px solid #1e3a5f30", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>{icon}</div>
                      <div>
                        <div style={{ fontWeight:700, fontSize:13, marginBottom:2 }}>{title}</div>
                        <div style={{ fontSize:12, color:"#94a3b8" }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recherche client */}
                <div style={{ marginTop:8 }}>
                  <div className="field-label" style={{ marginBottom:8 }}>NOUVEAU RDV — RECHERCHER LE CLIENT</div>
                  <div style={{ position:"relative" }}>
                    <input
                      placeholder="Tapez le nom du client..."
                      id="search-client"
                      autoComplete="off"
                      onChange={e => {
                        const val = e.target.value;
                        const box = document.getElementById("search-suggestions");
                        if (!val.trim()) { box.style.display="none"; return; }
                        const matches = window.__patients?.filter(p => p.nom.toLowerCase().includes(val.toLowerCase())) || [];
                        if (matches.length > 0) {
                          box.innerHTML = matches.map(p => `<div onclick="window.__selectPatient('${p.id}')" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background='#fff'">${p.nom}${p.telephone ? ` · ${p.telephone}` : ""}</div>`).join("");
                          box.style.display = "block";
                        } else {
                          box.innerHTML = `<div style="padding:10px 14px;font-size:13px;color:#94a3b8;">Nouveau client — fiche vierge</div>`;
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
                    Appuyez sur Entrée ou → pour ouvrir la fiche RDV
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
                  <div style={{ fontSize:14, color:"#94a3b8" }}>Appel en cours <span style={{ animation:"blink 1s infinite", display:"inline-block" }}>●</span></div>
                </div>

                <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:16, padding:20, marginBottom:28, textAlign:"left" }}>
                  <div style={{ fontSize:12, color:"#94a3b8", fontFamily:"DM Mono", lineHeight:1.7 }}>
                    Passez votre appel normalement.<br/>
                    Quand vous raccrochez, <span style={{ color:"#1e3a5f", fontWeight:700 }}>la fiche RDV s'ouvre automatiquement</span> pour que vous puissiez saisir les details immediatement.
                  </div>
                </div>

                <button className="btn btn-red" onClick={()=>setPhase("form")} style={{ width:"100%", padding:"18px", fontSize:16, letterSpacing:"0.02em" }}>
                  🔴 Raccrocher
                </button>
                <button className="btn btn-outline btn-sm" onClick={()=>setPhase("idle")} style={{ marginTop:10, width:"100%" }}>
                  Annuler l'appel
                </button>
              </div>
            )}

            {/* FORM — opens right after hanging up */}
            {phase==="form" && (
              <RdvForm
                onSave={handleSave}
                onCancel={()=>setPhase("idle")}
              />
            )}
          </div>}

          {/* SIDEBAR AGENDA */}
          {showPatients || showAgenda || showStats ? null : (
          <div style={{ width:290, padding:"24px 18px", overflowY:"auto" }}>
            <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"DM Mono", letterSpacing:"0.1em", marginBottom:18 }}>
              MON AGENDA ({appointments.length})
            </div>

            {appointments.length===0 ? (
              <div style={{ textAlign:"center", padding:"40px 0" }}>
                <div style={{ fontSize:36, marginBottom:10 }}>📅</div>
                <div style={{ color:"#cbd5e1", fontSize:12, fontFamily:"DM Mono" }}>Aucun RDV enregistre</div>
              </div>
            ) : appointments.map((rdv,i)=>(
              <div key={i} style={{ background:"#f0fdf4", border:"1px solid #bae6fd", borderRadius:14, padding:14, marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ fontWeight:700, fontSize:13, lineHeight:1.3 }}>{rdv.titre||"Rendez-vous"}</div>
                  <button onClick={()=>setCalRdv(rdv)} title="Ajouter au calendrier"
                    style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, opacity:.7, flexShrink:0 }}>📅</button>
                </div>
                <div style={{ fontSize:12, color:"#0284c7", marginBottom:4 }}>{rdv.personne}</div>
                <div style={{ fontSize:12, color:"#0369a1", marginBottom:4 }}>
                  {rdv.date}{rdv.heure ? ` a ${rdv.heure}` : ""}
                </div>
                {rdv.lieu && <div style={{ fontSize:11, color:"#0284c7", fontFamily:"DM Mono", marginBottom:2 }}>{rdv.lieu}</div>}
                {rdv.adresse && <div style={{ fontSize:11, color:"#1a4a1a", fontFamily:"DM Mono" }}>{rdv.adresse}</div>}
                {rdv.notes && <div style={{ fontSize:11, color:"#3a5a3a", marginTop:6, borderTop:"1px solid #bae6fd", paddingTop:6 }}>{rdv.notes}</div>}
                <div style={{ fontSize:10, color:"#bae6fd", fontFamily:"DM Mono", marginTop:8 }}>Ajoute a {rdv.confirmedAt}</div>
              </div>
            ))}

            {/* Stats */}
            <div style={{ marginTop:16, borderTop:"1px solid #e2e8f0", paddingTop:16 }}>
              <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"DM Mono", letterSpacing:"0.1em", marginBottom:10 }}>STATISTIQUES</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
                {[{ label:"RDV ce mois", value:appointments.length },{ label:"Quota utilise", value:user.usage||0 }].map(({label,value})=>(
                  <div key={label} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"12px" }}>
                    <div style={{ fontWeight:800, fontSize:22, color:"#1e3a5f" }}>{value}</div>
                    <div style={{ fontSize:10, color:"#94a3b8", fontFamily:"DM Mono", marginTop:2 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div className="privacy-badge">
                <span style={{ fontSize:14 }}>🔒</span>
                <div style={{ fontSize:10, color:"#0369a1", fontFamily:"DM Mono", lineHeight:1.5 }}>
                  Donnees stockees localement. Aucun stockage vocal. Conforme RGPD.
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
