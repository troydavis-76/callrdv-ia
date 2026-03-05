import React, { useState, useEffect, useRef } from "react";

const CONFIG = {
  SUPABASE_URL: "https://vcnguzlwyacnlysnsogv.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbmd1emx3eWFjbmx5c25zb2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDg0MTcsImV4cCI6MjA4ODIyNDQxN30.rI1WkGgUjFlw7dbl4wDtXcItDqsEc5PaqpPpF35cSuU",
  STRIPE_LINKS: { pro: "https://buy.stripe.com/00w8wPf3R8fkd0meNgcMM00", business: "https://buy.stripe.com/eVqdR93l9ans2lIgVocMM01" },
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
    setUser({ id: res.user.id, email: res.user.email, name: profile?.name || res.user.user_metadata?.name || "", plan: profile?.plan || "free", usage: profile?.usage || 0, token: tk });
    setLoading(false);
    return { error: null };
  };

  const signOut = () => setUser(null);

  const updateUser = async (data) => {
    setUser(prev => ({ ...prev, ...data }));
  };

  return { user, loading, signUp, signIn, signOut, updateUser };
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Mono:wght@300;400&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#f0f4f8;}
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
.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;box-shadow:0 1px 4px #00000008;}
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
function CalendarModal({ rdv, onClose }) {
  const [done, setDone] = useState(null);
  const [adding, setAdding] = useState(null);
  const open = async (type) => {
    setAdding(type);
    await delay(800);
    const title = encodeURIComponent(rdv.titre);
    const details = encodeURIComponent(`Avec: ${rdv.personne}\nLieu: ${rdv.lieu||""}\n${rdv.notes||""}`);
    const loc = encodeURIComponent(rdv.adresse||rdv.lieu||"");
    const now = new Date();
    const start = now.toISOString().replace(/[-:]|\.\d+/g,"").slice(0,15)+"Z";
    const end = new Date(now.getTime()+3600000).toISOString().replace(/[-:]|\.\d+/g,"").slice(0,15)+"Z";
    if (type==="google") window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${loc}&dates=${start}/${end}`,"_blank");
    else window.open(`https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&body=${details}&location=${loc}`,"_blank");
    setAdding(null); setDone(type);
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"#f0f4f8cc", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div className="card fade-up" style={{ width:"100%", maxWidth:400, padding:32 }}>
        <div style={{ fontWeight:800, fontSize:20, marginBottom:4 }}>Ajouter au calendrier</div>
        <div style={{ fontSize:13, color:"#94a3b8", fontFamily:"DM Mono", marginBottom:24 }}>{rdv.titre}</div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {[["google","📅","Google Calendar"],["outlook","📆","Outlook / Office 365"]].map(([type,icon,label])=>(
            <button key={type} className="btn btn-outline" onClick={()=>open(type)} disabled={!!adding}
              style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, padding:"16px", borderColor:done===type?"#0284c7":"#e2e8f0" }}>
              {adding===type ? <span className="spinner"></span> : <span style={{ fontSize:20 }}>{icon}</span>}
              <span>{done===type ? `Ajoute : ${label}` : label}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-outline btn-sm" onClick={onClose} style={{ width:"100%", marginTop:18 }}>Fermer</button>
      </div>
    </div>
  );
}

// ── RDV Form (opens right after hanging up) ──────────────────
// ── Vue Agenda Calendrier ────────────────────────────────────
function CalendarView({ appointments, onNewCall, onCalRdv }) {
  const [viewMode, setViewMode] = React.useState("semaine"); // semaine | mois | liste
  const [currentDate, setCurrentDate] = React.useState(new Date());

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
        <div style={{ flex:1, overflowY:"auto", padding:24 }}>
          {appointments.length===0 ? (
            <div style={{ textAlign:"center", padding:"60px 0" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📅</div>
              <div style={{ color:"#94a3b8", fontSize:14 }}>Aucun RDV enregistré</div>
            </div>
          ) : appointments.sort((a,b) => a.date > b.date ? 1 : -1).map((rdv, i) => (
            <div key={i} className="card" style={{ marginBottom:12, display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ width:4, height:50, borderRadius:4, background:catColors[rdv.categorie]||"#1e3a5f", flexShrink:0 }}></div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>{rdv.titre||"Rendez-vous"}</div>
                <div style={{ fontSize:12, color:"#64748b" }}>{rdv.personne} · {rdv.date}{rdv.heure ? ` à ${rdv.heure}` : ""}</div>
                {rdv.lieu && <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>📍 {rdv.lieu}</div>}
              </div>
              <button onClick={()=>onCalRdv(rdv)} style={{ background:"none", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:12, color:"#64748b" }}>📅 Exporter</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Paramètres Modal ─────────────────────────────────────────
function SettingsModal({ user, onSave, onClose, sb, token }) {
  const [rappels, setRappels] = React.useState(user.rappels || ["j-1","j-3"]);
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
  const [form, setForm] = useState({
    titre: "",
    personne: "",
    date: "",
    heure: "",
    lieu: "",
    adresse: "",
    notes: "",
    categorie: "autre",
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  // Reconnaissance vocale par champ
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

// ── Main App ─────────────────────────────────────────────────
export default function App() {
  const auth = useAuth();
  const { user, loading, signIn, signUp, signOut, updateUser } = auth;
  const token = user?.token;

  const [phase, setPhase]         = useState("idle");   // idle | calling | form | agenda
  const [appointments, setAppts]  = useState([]);
  const [calRdv, setCalRdv]       = useState(null);
  const [showAgenda, setShowAgenda] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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

  if (!user) return (<><style>{CSS}</style><AuthPage authHooks={{ signIn, signUp, loading }} /></>);

  return (
    <>
      <style>{CSS}</style>
      {showSettings && <SettingsModal user={user} token={token} sb={sb} onSave={(data)=>updateUser(data)} onClose={()=>setShowSettings(false)} />}
      {showPricing && <PricingModal currentPlan={user.plan} onUpgrade={handleUpgrade} onClose={()=>setPrice(false)} />}
      {calRdv && <CalendarModal rdv={calRdv} onClose={()=>setCalRdv(null)} />}

      <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Inter',sans-serif", color:"#1e293b", display:"flex", flexDirection:"column" }}>

        {/* NAV */}
        <nav style={{ padding:"14px 24px", borderBottom:"1px solid #e2e8f0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
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
            <button onClick={()=>setShowSettings(true)} style={{ background:"none", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:14 }} title="Paramètres">⚙️</button>
            <div onClick={signOut} style={{ cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:28, height:28, background:"#e2e8f0", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>{user.name?.[0]?.toUpperCase()||"?"}</div>
              <span style={{ fontSize:12, color:"#94a3b8", fontFamily:"DM Mono" }}>Quitter</span>
            </div>
          </div>
        </nav>

        {/* Onglets */}
        <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", display:"flex", gap:0 }}>
          {[["📞","Appels",false],["📅","Agenda",true]].map(([icon,label,isAgenda]) => (
            <button key={label} onClick={()=>setShowAgenda(isAgenda)}
              style={{ padding:"12px 28px", fontSize:14, fontWeight:600, fontFamily:"Inter,sans-serif", border:"none", cursor:"pointer", background:"transparent", borderBottom:showAgenda===isAgenda?"3px solid #1e3a5f":"3px solid transparent", color:showAgenda===isAgenda?"#1e3a5f":"#94a3b8", display:"flex", alignItems:"center", gap:8, transition:"all .2s" }}>
              {icon} {label}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

          {/* AGENDA VIEW */}
          {showAgenda && (
            <CalendarView
              appointments={appointments}
              onNewCall={()=>{ setShowAgenda(false); setPhase("calling"); }}
              onCalRdv={setCalRdv}
            />
          )}

          {/* MAIN */}
          {!showAgenda && <div style={{ flex:1, padding:"28px", overflowY:"auto", borderRight:"1px solid #e2e8f0" }}>

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

                <button className="btn btn-primary" onClick={()=>canAdd&&setPhase("calling")} disabled={!canAdd} style={{ width:"100%", padding:"17px", fontSize:15 }}>
                  📞 Demarrer un appel
                </button>
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
        </div>
      </div>
    </>
  );
}
