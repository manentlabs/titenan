"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadMsg, setLoadMsg] = useState("Memverifikasi kredensial...");
  const [view, setView] = useState<"login" | "loading" | "dashboard">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  /* ── Canvas particle network ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    type Pt = { x: number; y: number; vx: number; vy: number; r: number; c: string };
    const pts: Pt[] = Array.from({ length: 55 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.03,
      vy: (Math.random() - 0.5) * 0.03,
      r: Math.random() * 1.5 + 0.5,
      c: Math.random() < 0.5 ? "rgba(99,102,241," : "rgba(168,85,247,",
    }));

    function resize() {
      canvas!.width = canvas!.offsetWidth;
      canvas!.height = canvas!.offsetHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      const W = canvas!.width, H = canvas!.height;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > 100) p.vx *= -1;
        if (p.y < 0 || p.y > 100) p.vy *= -1;
        const px = (p.x / 100) * W, py = (p.y / 100) * H;
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c + "0.4)";
        ctx.fill();
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j];
          const qx = (q.x / 100) * W, qy = (q.y / 100) * H;
          const d = Math.hypot(px - qx, py - qy);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(qx, qy);
            ctx.strokeStyle = p.c + (1 - d / 120) * 0.12 + ")";
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  /* ── Sync session → view ── */
  useEffect(() => {
    if (status === "loading") return;
    if (session) setView("dashboard");
    else setView("login");
  }, [session, status]);

  /* ── Handlers ── */
  async function handleLogin() {
	  setView("loading");
	  const result = await signIn("credentials", { email, password, redirect: false });
	  if (result?.error) {
		setView("login");
		alert("Login gagal: " + result.error);
	  } else {
		router.push("/"); // redirect ke halaman utama yang akan memuat ulang session
	  }
	}

  function handleGoogleLogin() {
    setView("loading");
    setLoadMsg("Menghubungkan ke Google...");
    signIn("google");
  }

  async function handleLogout() {
    setView("loading");
    setLoadMsg("Keluar dari platform...");
    await signOut({ redirect: false });
    setView("login");
  }

  const userName      = session?.user?.name  ?? "Analyst";
  const userEmail     = session?.user?.email ?? "";
  const avatarInitial = userName.charAt(0).toUpperCase();

  const modules = [
    { key: "statistik",     icon: "📊", label: "Analisis Statistika",  desc: "Deskriptif, distribusi, korelasi, uji statistik", color: "#14b8a6", bg: "rgba(20,184,166,0.08)" },
    { key: "clustering",    icon: "🔵", label: "Clustering",            desc: "K-Means, DBSCAN, Hierarchical",                   color: "#6366f1", bg: "rgba(99,102,241,0.08)"  },
    { key: "classification",icon: "🟣", label: "Classification",        desc: "Decision Tree, Random Forest, SVM",               color: "#a855f7", bg: "rgba(168,85,247,0.08)"  },
    { key: "association",   icon: "🟡", label: "Association Rules",     desc: "Apriori, FP-Growth, Eclat",                      color: "#f59e0b", bg: "rgba(245,158,11,0.08)"  },
    { key: "prediction",    icon: "🔴", label: "Prediction",            desc: "Regresi, LSTM, Time Series",                     color: "#ef4444", bg: "rgba(239,68,68,0.08)"   },
  ];

  if (status === "loading") {
    return (
      <div style={s.loadingFull}>
        <div style={s.spinnerRing} />
        <p style={s.loadingText}>Memuat sesi...</p>
      </div>
    );
  }

  return (
    <>
      <style>{globalCSS}</style>
      <div style={s.body}>

        {/* ── LEFT PANEL (hidden on mobile) ── */}
        <div className="left-panel" style={s.left}>
          <canvas ref={canvasRef} style={s.canvas} />
          <div style={s.vizArea}>
            <p style={s.brandTag}>// DATALYTICS PLATFORM v2.4</p>
            <h1 style={s.heroTitle}>Analisis Data<br />Berbasis AI</h1>
            <p style={s.heroSub}>Platform analitik terpadu untuk eksplorasi data — dari clustering hingga prediksi machine learning.</p>

            <div style={s.moduleGrid}>
              {/* Clustering */}
              <div className="mod-card" style={{ ...s.modCard, animationDelay: "0.2s" }}>
                <div className="mod-top-bar" style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
                <div style={s.modIcon}>🔵</div>
                <div style={s.modName}>Clustering</div>
                <div style={s.modStat}>K-Means</div>
                <div style={s.modLabel}>Segmentasi otomatis</div>
                <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginTop:10 }}>
                  {["#6366f1","#6366f1","#8b5cf6","#6366f1","#a855f7","#a855f7","#f59e0b","#6366f1","#a855f7","#f59e0b","#f59e0b","#8b5cf6"].map(
                    (c,i) => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:c, opacity:0.7 }} />
                  )}
                </div>
              </div>

              {/* Classification */}
              <div className="mod-card" style={{ ...s.modCard, animationDelay: "0.35s" }}>
                <div className="mod-top-bar" style={{ background: "linear-gradient(90deg,#a855f7,#6366f1)" }} />
                <div style={s.modIcon}>🟣</div>
                <div style={s.modName}>Classification</div>
                <div style={s.modStat}>98.3%</div>
                <div style={s.modLabel}>Akurasi model</div>
                <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:28, marginTop:10 }}>
                  {[55,80,65,95,72,88,60].map((h,i) => (
                    <div key={i} className="grow-bar" style={{ flex:1, height:`${h}%`, background: i%2===0?"#a855f7":"#6366f1", borderRadius:"2px 2px 0 0", opacity:0.65, animationDelay:`${i*0.05}s` }} />
                  ))}
                </div>
              </div>

              {/* Association */}
              <div className="mod-card" style={{ ...s.modCard, animationDelay: "0.5s" }}>
                <div className="mod-top-bar" style={{ background: "linear-gradient(90deg,#f59e0b,#ef4444)" }} />
                <div style={s.modIcon}>🟡</div>
                <div style={s.modName}>Association</div>
                <div style={s.modStat}>Apriori</div>
                <div style={s.modLabel}>Rule mining</div>
                <svg style={{ marginTop:10, opacity:0.8 }} width="100%" height="32" viewBox="0 0 120 32">
                  <circle cx="20" cy="16" r="5" fill="#f59e0b" opacity="0.8"/>
                  <circle cx="55" cy="8"  r="4" fill="#ef4444" opacity="0.7"/>
                  <circle cx="55" cy="24" r="4" fill="#f59e0b" opacity="0.7"/>
                  <circle cx="95" cy="16" r="5" fill="#ef4444" opacity="0.8"/>
                  <line x1="25" y1="14" x2="51" y2="9"  stroke="#f59e0b" strokeWidth="1" opacity="0.4"/>
                  <line x1="25" y1="18" x2="51" y2="23" stroke="#f59e0b" strokeWidth="1" opacity="0.4"/>
                  <line x1="59" y1="9"  x2="90" y2="14" stroke="#ef4444" strokeWidth="1" opacity="0.4"/>
                  <line x1="59" y1="23" x2="90" y2="18" stroke="#ef4444" strokeWidth="1" opacity="0.4"/>
                </svg>
              </div>

              {/* Prediction */}
              <div className="mod-card" style={{ ...s.modCard, animationDelay: "0.65s" }}>
                <div className="mod-top-bar" style={{ background: "linear-gradient(90deg,#ef4444,#a855f7)" }} />
                <div style={s.modIcon}>🔴</div>
                <div style={s.modName}>Prediction</div>
                <div style={s.modStat}>+12.4%</div>
                <div style={s.modLabel}>Akurasi forecast</div>
                <svg style={{ marginTop:10 }} width="100%" height="32" viewBox="0 0 120 32">
                  <polyline points="0,28 15,22 30,20 45,18 60,14 75,12 90,8" fill="none" stroke="#a855f7" strokeWidth="1.5" opacity="0.5"/>
                  <polyline points="90,8 105,5 120,2" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.85"/>
                  <circle cx="90" cy="8" r="3" fill="#ef4444"/>
                </svg>
              </div>
            </div>

            <div style={s.tagRow}>
              {[
                { text:"K-Means · DBSCAN",   c:"#6366f1", bc:"rgba(99,102,241,0.35)",  bg:"rgba(99,102,241,0.07)"  },
                { text:"Random Forest · SVM", c:"#a855f7", bc:"rgba(168,85,247,0.35)",  bg:"rgba(168,85,247,0.07)"  },
                { text:"Apriori · FP-Growth", c:"#d97706", bc:"rgba(217,119,6,0.35)",   bg:"rgba(245,158,11,0.07)"  },
                { text:"Regresi · LSTM",      c:"#dc2626", bc:"rgba(220,38,38,0.35)",   bg:"rgba(239,68,68,0.07)"   },
              ].map(t => (
                <span key={t.text} style={{ ...s.tag, color:t.c, borderColor:t.bc, background:t.bg }}>{t.text}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="right-panel" style={s.right}>

          {/* Mobile header — only visible on mobile */}
          <div className="mobile-header">
            <canvas ref={undefined} style={{ display:"none" }} />
            <div className="mobile-brand">
              <div className="mobile-brand-dot" />
              <span className="mobile-brand-text">DATALYTICS v2.4</span>
            </div>
            <h2 className="mobile-hero">Analisis Data Berbasis AI</h2>
            <div className="mobile-tags">
              {["Clustering","Classification","Association","Prediction"].map(t => (
                <span key={t} className="mobile-tag">{t}</span>
              ))}
            </div>
          </div>

          {/* LOGIN */}
          {view === "login" && (
            <div className="fade-up">
              <div style={{ marginBottom:28 }}>
                <h2 style={s.loginH2}>Masuk ke Dashboard</h2>
                <p style={s.loginSub}>Akses modul analitik clustering, klasifikasi, asosiasi, dan prediksi data Anda.</p>
              </div>

              <div style={s.field}>
                <label style={s.fieldLabel}>Email</label>
                <input style={s.input} type="email" placeholder="analyst@example.com" value={email}
                  onChange={e => setEmail(e.target.value)} className="custom-input" />
              </div>
              <div style={s.field}>
                <label style={s.fieldLabel}>Password</label>
                <input style={s.input} type="password" placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()} className="custom-input" />
              </div>

              <button style={s.btnLogin} className="btn-login-hover" onClick={handleLogin}>
                Masuk ke Platform →
              </button>

              <div style={s.orRow}>
                <div style={s.orLine}/><span style={s.orText}>atau</span><div style={s.orLine}/>
              </div>

              <button style={s.btnGoogle} className="btn-google-hover" onClick={handleGoogleLogin}>
                <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.015 17.64 11.707 17.64 9.2z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Masuk dengan Google
              </button>

              <p style={s.loginFooter}>
                Belum punya akun?{" "}
                <a href="/register" style={{ color:"#6366f1", textDecoration:"none", fontWeight:600 }}>Daftar sekarang</a>
              </p>
            </div>
          )}

          {/* LOADING */}
          {view === "loading" && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:40 }}>
              <div style={s.spinnerRing} />
              <p style={s.loadingText}>{loadMsg}</p>
            </div>
          )}

          {/* DASHBOARD */}
          {view === "dashboard" && (
            <div className="fade-up">
              <div style={s.dashHeader}>
                <div style={s.dashAvatar}>{avatarInitial}</div>
                <div>
                  <h3 style={{ fontSize:15, fontWeight:600, marginBottom:2, color:"#1a1a2e" }}>{userName}</h3>
                  <span style={{ fontSize:12, color:"#6b7280", fontFamily:"DM Mono, monospace" }}>{userEmail}</span>
                </div>
                <div style={s.dashBadge}>Online</div>
              </div>

              <div style={{ fontSize:12, fontWeight:600, letterSpacing:"0.07em", color:"#9ca3af", textTransform:"uppercase", marginBottom:12 }}>
                Modul Analitik
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
                {modules.map((m, idx) => (
                  <div key={m.key} className="module-item-hover"
                    style={{ ...s.moduleItem, animationDelay:`${idx * 0.08}s` }}
                    onClick={() => window.location.href = `/${m.key}`}>
                    <div style={{ ...s.modItemBar, background:m.color }} />
                    <div style={{ ...s.modItemIcon, background:m.bg }}>{m.icon}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, marginBottom:2, color:"#1a1a2e" }}>{m.label}</div>
                      <div style={{ fontSize:11, color:"#6b7280" }}>{m.desc}</div>
                    </div>
                    <span style={{ marginLeft:"auto", color:"#9ca3af", fontSize:18, lineHeight:1 }}>›</span>
                  </div>
                ))}
              </div>

			  <button style={s.btnProfile} onClick={() => router.push("/profile")} className="btn-profile-hover">
			  ✏️ Edit Profil
			  </button>
              <button style={s.btnLogout} className="btn-logout-hover" onClick={handleLogout}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
                Keluar dari Platform
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Styles ─── */
const s: Record<string, React.CSSProperties> = {
  body:        { display:"flex", minHeight:"100vh", background:"#f8f8f6", color:"#1a1a2e", fontFamily:"'Outfit',sans-serif", overflow:"hidden" },
  left:        { width:"55%", position:"relative", display:"flex", flexDirection:"column", justifyContent:"center", padding:"48px 56px", overflow:"hidden", borderRight:"1px solid rgba(0,0,0,0.07)", background:"#f0f0ed" },
  canvas:      { position:"absolute", inset:0, width:"100%", height:"100%", zIndex:0 },
  vizArea:     { position:"relative", zIndex:1, pointerEvents:"none" },
  brandTag:    { fontSize:11, fontFamily:"'DM Mono',monospace", color:"#9ca3af", letterSpacing:"0.05em", marginBottom:6 },
  heroTitle:   { fontSize:"clamp(28px,3.5vw,42px)", fontWeight:800, lineHeight:1.15, marginBottom:12, background:"linear-gradient(135deg,#1a1a2e 30%,#6366f1)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" },
  heroSub:     { fontSize:14, color:"#6b7280", lineHeight:1.7, maxWidth:340, marginBottom:28 },
  moduleGrid:  { display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:32 },
  modCard:     { background:"rgba(248,248,246,0.9)", border:"1px solid rgba(0,0,0,0.07)", borderRadius:14, padding:"18px 20px", backdropFilter:"blur(12px)", position:"relative", overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" },
  modIcon:     { fontSize:20, marginBottom:10 },
  modName:     { fontSize:12, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" as const, color:"#9ca3af", marginBottom:4 },
  modStat:     { fontFamily:"'DM Mono',monospace", fontSize:22, fontWeight:500, lineHeight:1, color:"#1a1a2e" },
  modLabel:    { fontSize:11, color:"#9ca3af", marginTop:4 },
  tagRow:      { display:"flex", flexWrap:"wrap" as const, gap:8 },
  tag:         { fontSize:11, fontWeight:500, fontFamily:"'DM Mono',monospace", padding:"5px 12px", borderRadius:20, border:"1px solid", letterSpacing:"0.04em" },
  right:       { width:"45%", display:"flex", flexDirection:"column", justifyContent:"center", padding:"56px 52px", position:"relative", overflowY:"auto" as const, background:"#f8f8f6" },
  loginH2:     { fontSize:24, fontWeight:700, marginBottom:6, color:"#1a1a2e" },
  loginSub:    { fontSize:13, color:"#6b7280", lineHeight:1.6 },
  field:       { marginBottom:18 },
  fieldLabel:  { display:"block", fontSize:11.5, fontWeight:600, letterSpacing:"0.06em", color:"#6b7280", marginBottom:8, textTransform:"uppercase" as const },
  input:       { width:"100%", padding:"13px 16px", background:"#ffffff", border:"1px solid rgba(0,0,0,0.12)", borderRadius:10, color:"#1a1a2e", fontFamily:"'Outfit',sans-serif", fontSize:14, outline:"none", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" },
  btnLogin:    { width:"100%", padding:14, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", border:"none", borderRadius:10, color:"#ffffff", fontFamily:"'Outfit',sans-serif", fontSize:14, fontWeight:700, cursor:"pointer", letterSpacing:"0.02em", marginTop:8, boxShadow:"0 4px 14px rgba(99,102,241,0.3)" },
  orRow:       { display:"flex", alignItems:"center", gap:12, margin:"20px 0" },
  orLine:      { flex:1, height:1, background:"rgba(0,0,0,0.08)" },
  orText:      { fontSize:11, color:"#9ca3af", fontFamily:"'DM Mono',monospace" },
  btnGoogle:   { width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:10, padding:13, background:"#ffffff", border:"1px solid rgba(0,0,0,0.1)", borderRadius:10, color:"#1a1a2e", fontFamily:"'Outfit',sans-serif", fontSize:13.5, fontWeight:500, cursor:"pointer", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" },
  loginFooter: { textAlign:"center" as const, fontSize:11.5, color:"#9ca3af", marginTop:24 },
  spinnerRing: { width:40, height:40, border:"2px solid rgba(0,0,0,0.08)", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.75s linear infinite" },
  loadingText: { fontSize:13, color:"#9ca3af", fontFamily:"'DM Mono',monospace" },
  loadingFull: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#f8f8f6", gap:16 },
  dashHeader:  { display:"flex", alignItems:"center", gap:14, marginBottom:28, paddingBottom:20, borderBottom:"1px solid rgba(0,0,0,0.07)" },
  dashAvatar:  { width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, color:"#ffffff", boxShadow:"0 0 0 3px rgba(99,102,241,0.2)", flexShrink:0 },
  dashBadge:   { marginLeft:"auto", fontSize:10, fontFamily:"'DM Mono',monospace", fontWeight:500, padding:"3px 10px", borderRadius:20, background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.3)", color:"#059669", display:"flex", alignItems:"center", gap:5 },
  moduleItem:  { display:"flex", alignItems:"center", gap:14, padding:"14px 16px", background:"#ffffff", border:"1px solid rgba(0,0,0,0.07)", borderRadius:12, cursor:"pointer", position:"relative", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" },
  modItemBar:  { position:"absolute", left:0, top:0, bottom:0, width:3, borderRadius:"3px 0 0 3px" },
  modItemIcon: { width:36, height:36, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:18 },
  btnLogout:   { width:"100%", padding:12, background:"transparent", border:"1px solid rgba(239,68,68,0.25)", borderRadius:10, color:"#ef4444", fontFamily:"'Outfit',sans-serif", fontSize:13, fontWeight:500, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
  btnProfile:  { width: "100%", padding: 12, background: "transparent", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 10, color: "#6366f1", fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom:12 },
};

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700;800&display=swap');

  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes cardIn  { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes growBar { from { transform:scaleY(0); transform-origin:bottom; } to { transform:scaleY(1); } }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.3} }

  .fade-up     { animation: fadeUp 0.45s ease both; }
  .mod-card    { animation: cardIn 0.6s ease both; }
  .mod-top-bar { position:absolute; top:0; left:0; right:0; height:2px; border-radius:14px 14px 0 0; }
  .grow-bar    { animation: growBar 1s ease both; }

  .custom-input:focus {
    border-color: rgba(99,102,241,0.45) !important;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.1) !important;
  }
  .btn-login-hover:hover {
    filter:brightness(1.06);
    transform:translateY(-1px);
    box-shadow:0 10px 24px rgba(99,102,241,0.35) !important;
    transition:all 0.2s;
  }
  .btn-google-hover:hover {
    background:#ececea !important;
    border-color:rgba(0,0,0,0.15) !important;
    transform:translateY(-1px);
    transition:all 0.2s;
  }
  .module-item-hover {
    animation: fadeUp 0.45s ease both;
    transition: all 0.2s;
  }
  .module-item-hover:hover {
    background:#ececea !important;
    border-color:rgba(0,0,0,0.1) !important;
    transform:translateX(3px);
    box-shadow:0 4px 12px rgba(0,0,0,0.08) !important;
  }
  .btn-logout-hover:hover {
    background:rgba(239,68,68,0.06) !important;
    border-color:rgba(239,68,68,0.45) !important;
    transition:all 0.2s;
  }
  .dash-badge::before {
    content:'';
    width:6px;
    height:6px;
    border-radius:50%;
    background:#059669;
    animation:pulse 2s infinite;
    display:inline-block;
  }

  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:#f8f8f6; }

  /* ─── Mobile header (hidden on desktop) ─── */
  .mobile-header { display: none; }

  /* ─── RESPONSIVE ─── */
  @media (max-width: 768px) {

    /* Body stacks vertically, allows scroll */
    body { overflow-y: auto !important; }

    /* Hide left decorative panel */
    .left-panel { display: none !important; }

    /* Right panel fills full screen */
    .right-panel {
      width: 100% !important;
      padding: 0 !important;
      justify-content: flex-start !important;
      overflow-y: auto !important;
      min-height: 100vh;
    }

    /* Show mobile header */
    .mobile-header {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 28px 24px 24px;
      background: linear-gradient(160deg, #f0f0ed 0%, #f8f8f6 100%);
      border-bottom: 1px solid rgba(0,0,0,0.07);
      margin-bottom: 0;
      position: relative;
      overflow: hidden;
    }

    /* Subtle gradient orb behind mobile header */
    .mobile-header::before {
      content: '';
      position: absolute;
      top: -40px;
      right: -40px;
      width: 160px;
      height: 160px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%);
      pointer-events: none;
    }

    .mobile-brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .mobile-brand-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      animation: pulse 2s infinite;
    }
    .mobile-brand-text {
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      color: #9ca3af;
      letter-spacing: 0.08em;
    }

    .mobile-hero {
      font-family: 'Outfit', sans-serif;
      font-size: 22px;
      font-weight: 800;
      line-height: 1.2;
      background: linear-gradient(135deg, #1a1a2e 30%, #6366f1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .mobile-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .mobile-tag {
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 20px;
      background: rgba(99,102,241,0.08);
      border: 1px solid rgba(99,102,241,0.2);
      color: #6366f1;
      letter-spacing: 0.03em;
    }

    /* Login / dashboard form area */
    .fade-up {
      padding: 28px 24px 40px !important;
    }
  }

  /* ─── Extra-small phones ─── */
  @media (max-width: 400px) {
    .mobile-hero { font-size: 19px; }
    .fade-up { padding: 22px 18px 36px !important; }
  }
`;