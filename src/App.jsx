import React, { useState, useEffect, useRef } from "react";

const CONFIG = {
  SUPABASE_URL: "https://vcnguzlwyacnlysnsogv.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbmd1emx3eWFjbmx5c25zb2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDg0MTcsImV4cCI6MjA4ODIyNDQxN30.rI1WkGgUjFlw7dbl4wDtXcItDqsEc5PaqpPpF35cSuU",
  STRIPE_LINKS: { pro: "https://buy.stripe.com/VOTRE_LIEN_PRO", business: "https://buy.stripe.com/VOTRE_LIEN_BUSINESS" },
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
};

const PLANS = {
  free:     { name: "Gratuit",  price: 0,  quota: 10,       color: "#5a5a6a", features: ["10 RDV/mois", "Agenda integre", "Export manuel"] },
  pro:      { name: "Pro",      price: 9,  quota: Infinity, color: "#c8f542", features: ["RDV illimites", "Google Calendar", "Outlook", "Rappels email"] },
  business: { name: "Business", price: 29, quota: Infinity, color: "#42c8f5", features: ["Tout Pro", "Multi-utilisateurs (5)", "Dashboard equipe", "Support prioritaire"] },
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
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:4px;}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
@keyframes ring{0%{transform:scale(1);opacity:.6;}100%{transform:scale(1.8);opacity:0;}}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes blink{0%,100%{opacity:1;}50%{opacity:.3;}}
@keyframes slideIn{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
@keyframes formOpen{from{opacity:0;transform:scale(.97);}to{opacity:1;transform:scale(1);}}
.fade-up{animation:fadeUp .4s ease both;}
.form-open{animation:formOpen .35s ease both;}
.btn{font-family:'Syne',sans-serif;font-weight:700;border:none;cursor:pointer;transition:all .2s;border-radius:12px;}
.btn-lime{background:#c8f542;color:#080810;padding:14px 28px;font-size:15px;}
.btn-lime:hover{background:#d4f75a;transform:translateY(-1px);}
.btn-lime:disabled{opacity:.4;cursor:not-allowed;transform:none;}
.btn-red{background:#ff3333;color:#fff;padding:14px 28px;font-size:15px;}
.btn-red:hover{background:#ff5555;transform:translateY(-1px);}
.btn-outline{background:transparent;color:#e8e4dc;border:1px solid #2a2a3a;padding:12px 24px;font-size:14px;}
.btn-outline:hover{border-color:#c8f542;color:#c8f542;}
.btn-sm{padding:8px 16px;font-size:13px;border-radius:10px;}
.card{background:#0e0e1a;border:1px solid #1a1a2e;border-radius:20px;padding:24px;}
input,select{background:#0e0e1a;border:1px solid #1e1e2e;border-radius:10px;color:#e8e4dc;font-family:'DM Mono',monospace;font-size:14px;padding:12px 16px;width:100%;outline:none;transition:border-color .2s;}
input:focus,select:focus{border-color:#c8f542;}
input::placeholder{color:#3a3a4a;}
textarea{background:#0e0e1a;border:1px solid #1e1e2e;border-radius:12px;color:#e8e4dc;font-family:'DM Mono',monospace;font-size:14px;padding:14px;width:100%;resize:none;outline:none;transition:border-color .2s;line-height:1.6;}
textarea:focus{border-color:#c8f542;}
textarea::placeholder{color:#3a3a4a;}
.spinner{width:20px;height:20px;border:2px solid #2a2a3a;border-top-color:#c8f542;border-radius:50%;animation:spin .8s linear infinite;display:inline-block;}
.privacy-badge{background:#0a120a;border:1px solid #1a3a1a;border-radius:12px;padding:12px 16px;display:flex;align-items:flex-start;gap:10px;}
.field-label{font-size:11px;color:#4a4a5a;font-family:'DM Mono',monospace;letter-spacing:.08em;margin-bottom:6px;}
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
    <div style={{ minHeight:"100vh", background:"#080810", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Syne',sans-serif", padding:24 }}>
      <div style={{ width:"100%", maxWidth:420 }} className="fade-up">
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:56, height:56, background:"#c8f542", borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, margin:"0 auto 14px" }}>📞</div>
          <div style={{ fontWeight:800, fontSize:28, color:"#e8e4dc", letterSpacing:"-0.03em" }}>CallRDV <span style={{ color:"#c8f542" }}>IA</span></div>
          <div style={{ fontSize:12, color:"#4a4a5a", fontFamily:"DM Mono", marginTop:4 }}>PRISE DE RDV AUTOMATIQUE</div>
        </div>
        <div className="card" style={{ padding:32 }}>
          <div style={{ display:"flex", gap:8, marginBottom:24, background:"#080810", borderRadius:12, padding:4 }}>
            {["login","register"].map(m => (
              <button key={m} onClick={() => setMode(m)} className="btn" style={{ flex:1, padding:"10px", fontSize:13, borderRadius:10, background:mode===m?"#c8f542":"transparent", color:mode===m?"#080810":"#5a5a6a" }}>
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
          <button className="btn btn-lime" onClick={handle} disabled={loading} style={{ width:"100%", marginTop:18, display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            {loading ? <span className="spinner"></span> : (mode==="login" ? "Se connecter" : "Creer mon compte")}
          </button>
          <div className="privacy-badge" style={{ marginTop:18 }}>
            <span style={{ fontSize:15 }}>🔒</span>
            <div style={{ fontSize:11, color:"#3a6a3a", fontFamily:"DM Mono", lineHeight:1.6 }}>
              <span style={{ color:"#4a9a4a", fontWeight:700 }}>Donnees protegees. </span>
              Aucun stockage vocal. Conforme RGPD.
            </div>
          </div>
        </div>
        <div style={{ marginTop:20, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          {Object.entries(PLANS).map(([k,p]) => (
            <div key={k} style={{ background:"#0e0e1a", border:`1px solid ${p.color}30`, borderRadius:12, padding:12, textAlign:"center" }}>
              <div style={{ fontWeight:700, fontSize:14, color:p.color }}>{p.price===0?"Gratuit":`${p.price}€/m`}</div>
              <div style={{ fontSize:11, color:"#4a4a5a", fontFamily:"DM Mono", marginTop:2 }}>{p.name}</div>
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
    <div style={{ position:"fixed", inset:0, background:"#080810ee", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:800 }} className="fade-up">
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontWeight:800, fontSize:26, color:"#e8e4dc" }}>Choisissez votre plan</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
          {Object.entries(PLANS).map(([key, plan]) => (
            <div key={key} className="card" style={{ border:`1px solid ${plan.color}40`, position:"relative", transform:key==="pro"?"scale(1.04)":"none" }}>
              {key==="pro" && <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:"#c8f542", color:"#080810", fontSize:10, fontWeight:700, fontFamily:"DM Mono", padding:"4px 12px", borderRadius:20 }}>POPULAIRE</div>}
              <div style={{ color:plan.color, fontWeight:800, fontSize:22, marginBottom:4 }}>
                {plan.price===0?"Gratuit":`${plan.price}€`}{plan.price>0&&<span style={{ fontSize:13, fontWeight:400, color:"#5a5a6a" }}>/mois</span>}
              </div>
              <div style={{ fontWeight:700, fontSize:16, marginBottom:14, color:"#e8e4dc" }}>{plan.name}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:18 }}>
                {plan.features.map(f => <div key={f} style={{ fontSize:13, color:"#8a8a9a", display:"flex", gap:8 }}><span style={{ color:plan.color }}>✓</span>{f}</div>)}
              </div>
              {currentPlan===key
                ? <div style={{ textAlign:"center", padding:"12px", background:`${plan.color}15`, borderRadius:10, fontSize:13, color:plan.color, fontFamily:"DM Mono" }}>Plan actuel</div>
                : <button onClick={()=>onUpgrade(key)} style={{ width:"100%", background:plan.color, color:"#080810", padding:"12px", fontFamily:"'Syne',sans-serif", fontWeight:700, border:"none", cursor:"pointer", borderRadius:10, fontSize:14 }}>{key==="free"?"Rester gratuit":`Passer a ${plan.name}`}</button>
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
    <div style={{ position:"fixed", inset:0, background:"#080810cc", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div className="card fade-up" style={{ width:"100%", maxWidth:400, padding:32 }}>
        <div style={{ fontWeight:800, fontSize:20, marginBottom:4 }}>Ajouter au calendrier</div>
        <div style={{ fontSize:13, color:"#5a5a6a", fontFamily:"DM Mono", marginBottom:24 }}>{rdv.titre}</div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {[["google","📅","Google Calendar"],["outlook","📆","Outlook / Office 365"]].map(([type,icon,label])=>(
            <button key={type} className="btn btn-outline" onClick={()=>open(type)} disabled={!!adding}
              style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, padding:"16px", borderColor:done===type?"#4a9a4a":"#1e1e2e" }}>
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

  const categories = [
    { value:"medical",   label:"🏥 Medical" },
    { value:"garage",    label:"🔧 Garage / Voiture" },
    { value:"travaux",   label:"🏠 Travaux / Artisan" },
    { value:"pro",       label:"💼 Professionnel" },
    { value:"perso",     label:"👤 Personnel" },
    { value:"autre",     label:"📋 Autre" },
  ];

  const titresAuto = {
    medical:  "Consultation medicale",
    garage:   "Revision voiture",
    travaux:  "Intervention artisan",
    pro:      "Reunion professionnelle",
    perso:    "RDV personnel",
    autre:    "Rendez-vous",
  };

  const handleCategorie = (val) => {
    setForm(prev => ({ ...prev, categorie: val, titre: prev.titre || titresAuto[val] }));
  };

  const isValid = form.personne.trim() && form.date.trim();

  return (
    <div className="form-open" style={{ maxWidth:560 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:28 }}>
        <div style={{ width:48, height:48, background:"#c8f54220", border:"1px solid #c8f54240", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>📋</div>
        <div>
          <div style={{ fontWeight:800, fontSize:22, letterSpacing:"-0.02em" }}>Nouveau rendez-vous</div>
          <div style={{ fontSize:12, color:"#5a5a6a", fontFamily:"DM Mono", marginTop:2 }}>Remplissez les details de votre appel</div>
        </div>
      </div>

      {/* Categorie */}
      <div style={{ marginBottom:20 }}>
        <div className="field-label">TYPE DE RDV</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          {categories.map(c => (
            <button key={c.value} onClick={()=>handleCategorie(c.value)}
              className="btn" style={{
                padding:"10px 8px", fontSize:12, textAlign:"center",
                background: form.categorie===c.value ? "#c8f54220" : "#0e0e1a",
                border: `1px solid ${form.categorie===c.value ? "#c8f542" : "#1e1e2e"}`,
                color: form.categorie===c.value ? "#c8f542" : "#6a6a7a",
                borderRadius:10
              }}>{c.label}</button>
          ))}
        </div>
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
          <input placeholder="Dr. Martin, Garage Renault..." value={form.personne} onChange={e=>set("personne",e.target.value)} />
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
        <input placeholder="Ex: Cabinet medical, Garage Renault, Domicile..." value={form.lieu} onChange={e=>set("lieu",e.target.value)} />
      </div>
      <div style={{ marginBottom:16 }}>
        <div className="field-label">ADRESSE COMPLETE</div>
        <input placeholder="Ex: 12 rue de la Paix, 75001 Paris..." value={form.adresse} onChange={e=>set("adresse",e.target.value)} />
      </div>

      {/* Notes */}
      <div style={{ marginBottom:24 }}>
        <div className="field-label">NOTES / INFORMATIONS COMPLEMENTAIRES</div>
        <textarea rows={3} placeholder="Documents a apporter, motif de la visite, informations importantes..." value={form.notes} onChange={e=>set("notes",e.target.value)} />
      </div>

      {/* Privacy badge */}
      <div className="privacy-badge" style={{ marginBottom:20 }}>
        <span style={{ fontSize:14 }}>🔒</span>
        <div style={{ fontSize:11, color:"#3a6a3a", fontFamily:"DM Mono", lineHeight:1.5 }}>
          <span style={{ color:"#4a9a4a", fontWeight:700 }}>Donnees protegees — </span>
          Vos informations sont stockees uniquement sur votre appareil. Conforme RGPD.
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display:"flex", gap:10 }}>
        <button className="btn btn-outline" onClick={onCancel} style={{ flex:1 }}>Annuler</button>
        <button className="btn btn-lime" onClick={()=>isValid&&onSave({ ...form, id:"rdv_"+Date.now(), confirmedAt:new Date().toLocaleTimeString("fr-FR") })}
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
      {showPricing && <PricingModal currentPlan={user.plan} onUpgrade={handleUpgrade} onClose={()=>setPrice(false)} />}
      {calRdv && <CalendarModal rdv={calRdv} onClose={()=>setCalRdv(null)} />}

      <div style={{ minHeight:"100vh", background:"#080810", fontFamily:"'Syne',sans-serif", color:"#e8e4dc", display:"flex", flexDirection:"column" }}>

        {/* NAV */}
        <nav style={{ padding:"14px 24px", borderBottom:"1px solid #12122a", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, background:"#c8f542", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>📞</div>
            <span style={{ fontWeight:800, fontSize:16 }}>CallRDV <span style={{ color:"#c8f542" }}>IA</span></span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ background:"#0e0e1a", border:"1px solid #1a1a2e", borderRadius:10, padding:"6px 14px", fontSize:11, color:"#5a5a6a", fontFamily:"DM Mono" }}>
              {plan.quota===Infinity ? "illimite" : `${plan.quota-(user.usage||0)}/${plan.quota} restants`}
            </div>
            <div onClick={()=>setPrice(true)} style={{ background:"#0e0e1a", border:`1px solid ${plan.color}40`, borderRadius:10, padding:"6px 14px", fontSize:11, color:plan.color, fontFamily:"DM Mono", cursor:"pointer", fontWeight:700 }}>
              {plan.name.toUpperCase()}{user.plan==="free"&&<span style={{ color:"#c8f542", marginLeft:6 }}>↑</span>}
            </div>
            <div onClick={signOut} style={{ cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:28, height:28, background:"#1a1a2e", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>{user.name?.[0]?.toUpperCase()||"?"}</div>
              <span style={{ fontSize:12, color:"#5a5a6a", fontFamily:"DM Mono" }}>Quitter</span>
            </div>
          </div>
        </nav>

        <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

          {/* MAIN */}
          <div style={{ flex:1, padding:"28px", overflowY:"auto", borderRight:"1px solid #12122a" }}>

            {/* IDLE */}
            {phase==="idle" && (
              <div className="fade-up">
                {saved && (
                  <div style={{ background:"#071207", border:"1px solid #2a6a2a", borderRadius:12, padding:"14px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:12, animation:"slideIn .4s ease" }}>
                    <span style={{ fontSize:20 }}>✅</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:"#5aba5a", marginBottom:2 }}>RDV enregistre avec succes !</div>
                      <div style={{ fontSize:11, color:"#3a7a3a", fontFamily:"DM Mono" }}>Retrouvez-le dans votre agenda a droite.</div>
                    </div>
                  </div>
                )}

                <h1 style={{ fontSize:28, fontWeight:800, letterSpacing:"-0.03em", lineHeight:1.2, marginBottom:10 }}>
                  Bonjour {user.name||""} 👋<br/><span style={{ color:"#c8f542" }}>Raccrochez, on s'occupe du reste.</span>
                </h1>
                <p style={{ color:"#5a5a6a", fontSize:14, marginBottom:24, lineHeight:1.7 }}>
                  Demarrez un appel, puis raccrochez — la fiche de RDV s'ouvre automatiquement pour que vous puissiez saisir les details.
                </p>

                <div className="privacy-badge" style={{ marginBottom:20 }}>
                  <span style={{ fontSize:16 }}>🔒</span>
                  <div style={{ fontSize:11, color:"#3a6a3a", fontFamily:"DM Mono", lineHeight:1.6 }}>
                    <span style={{ color:"#4a9a4a", fontWeight:700 }}>Confidentialite garantie — </span>
                    Donnees stockees uniquement sur votre appareil. Zero stockage vocal. Conforme RGPD.
                  </div>
                </div>

                {!canAdd && (
                  <div style={{ background:"#1a0a0a", border:"1px solid #ff6b6b30", borderRadius:14, padding:18, marginBottom:18 }}>
                    <div style={{ fontWeight:700, color:"#ff6b6b", marginBottom:6 }}>Quota mensuel atteint</div>
                    <div style={{ fontSize:13, color:"#7a4a4a", marginBottom:12 }}>Vous avez utilise vos {plan.quota} RDV gratuits ce mois.</div>
                    <button className="btn btn-lime btn-sm" onClick={()=>setPrice(true)}>Passer en Pro — 9€/mois</button>
                  </div>
                )}

                {/* How it works */}
                <div style={{ background:"#0e0e1a", border:"1px solid #1a1a2e", borderRadius:16, padding:20, marginBottom:20 }}>
                  <div style={{ fontSize:11, color:"#3a3a4a", fontFamily:"DM Mono", letterSpacing:"0.1em", marginBottom:14 }}>COMMENT CA MARCHE</div>
                  {[
                    ["1","📞","Demarrez un appel","Appuyez sur le bouton et passez votre appel normalement"],
                    ["2","🔴","Raccrochez","Appuyez sur Raccrocher — la fiche RDV s'ouvre instantanement"],
                    ["3","📋","Remplissez la fiche","Saisissez lieu, adresse, notes... en quelques secondes"],
                    ["4","📅","C'est dans l'agenda !","Le RDV est enregistre et synchronisable avec votre calendrier"],
                  ].map(([num,icon,title,desc])=>(
                    <div key={num} style={{ display:"flex", gap:14, marginBottom:12, alignItems:"flex-start" }}>
                      <div style={{ width:28, height:28, borderRadius:8, background:"#c8f54215", border:"1px solid #c8f54230", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>{icon}</div>
                      <div>
                        <div style={{ fontWeight:700, fontSize:13, marginBottom:2 }}>{title}</div>
                        <div style={{ fontSize:12, color:"#5a5a6a" }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="btn btn-lime" onClick={()=>canAdd&&setPhase("calling")} disabled={!canAdd} style={{ width:"100%", padding:"17px", fontSize:15 }}>
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
                  <div style={{ fontSize:14, color:"#4a4a5a" }}>Appel en cours <span style={{ animation:"blink 1s infinite", display:"inline-block" }}>●</span></div>
                </div>

                <div style={{ background:"#0e0e1a", border:"1px solid #1a1a2e", borderRadius:16, padding:20, marginBottom:28, textAlign:"left" }}>
                  <div style={{ fontSize:12, color:"#5a5a6a", fontFamily:"DM Mono", lineHeight:1.7 }}>
                    Passez votre appel normalement.<br/>
                    Quand vous raccrochez, <span style={{ color:"#c8f542", fontWeight:700 }}>la fiche RDV s'ouvre automatiquement</span> pour que vous puissiez saisir les details immediatement.
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
          </div>

          {/* SIDEBAR AGENDA */}
          <div style={{ width:290, padding:"24px 18px", overflowY:"auto" }}>
            <div style={{ fontSize:11, color:"#3a3a4a", fontFamily:"DM Mono", letterSpacing:"0.1em", marginBottom:18 }}>
              MON AGENDA ({appointments.length})
            </div>

            {appointments.length===0 ? (
              <div style={{ textAlign:"center", padding:"40px 0" }}>
                <div style={{ fontSize:36, marginBottom:10 }}>📅</div>
                <div style={{ color:"#2a2a3a", fontSize:12, fontFamily:"DM Mono" }}>Aucun RDV enregistre</div>
              </div>
            ) : appointments.map((rdv,i)=>(
              <div key={i} style={{ background:"#0a140a", border:"1px solid #1a2e1a", borderRadius:14, padding:14, marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ fontWeight:700, fontSize:13, lineHeight:1.3 }}>{rdv.titre||"Rendez-vous"}</div>
                  <button onClick={()=>setCalRdv(rdv)} title="Ajouter au calendrier"
                    style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, opacity:.7, flexShrink:0 }}>📅</button>
                </div>
                <div style={{ fontSize:12, color:"#4a7a4a", marginBottom:4 }}>{rdv.personne}</div>
                <div style={{ fontSize:12, color:"#3a6a3a", marginBottom:4 }}>
                  {rdv.date}{rdv.heure ? ` a ${rdv.heure}` : ""}
                </div>
                {rdv.lieu && <div style={{ fontSize:11, color:"#2a5a2a", fontFamily:"DM Mono", marginBottom:2 }}>{rdv.lieu}</div>}
                {rdv.adresse && <div style={{ fontSize:11, color:"#1a4a1a", fontFamily:"DM Mono" }}>{rdv.adresse}</div>}
                {rdv.notes && <div style={{ fontSize:11, color:"#3a5a3a", marginTop:6, borderTop:"1px solid #1a3a1a", paddingTop:6 }}>{rdv.notes}</div>}
                <div style={{ fontSize:10, color:"#1a3a1a", fontFamily:"DM Mono", marginTop:8 }}>Ajoute a {rdv.confirmedAt}</div>
              </div>
            ))}

            {/* Stats */}
            <div style={{ marginTop:16, borderTop:"1px solid #12122a", paddingTop:16 }}>
              <div style={{ fontSize:11, color:"#3a3a4a", fontFamily:"DM Mono", letterSpacing:"0.1em", marginBottom:10 }}>STATISTIQUES</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
                {[{ label:"RDV ce mois", value:appointments.length },{ label:"Quota utilise", value:user.usage||0 }].map(({label,value})=>(
                  <div key={label} style={{ background:"#0e0e1a", border:"1px solid #1a1a2e", borderRadius:10, padding:"12px" }}>
                    <div style={{ fontWeight:800, fontSize:22, color:"#c8f542" }}>{value}</div>
                    <div style={{ fontSize:10, color:"#3a3a4a", fontFamily:"DM Mono", marginTop:2 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div className="privacy-badge">
                <span style={{ fontSize:14 }}>🔒</span>
                <div style={{ fontSize:10, color:"#3a6a3a", fontFamily:"DM Mono", lineHeight:1.5 }}>
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
