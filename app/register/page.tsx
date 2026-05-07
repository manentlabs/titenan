"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type FieldError = { name?: string; email?: string; password?: string; confirm?: string };

export default function Register() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [form, setForm]       = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors]   = useState<FieldError>({});
  const [view, setView]       = useState<"form" | "loading" | "success">("form");
  const [loadMsg, setLoadMsg] = useState("");
  const [serverErr, setServerErr] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  /* ── Canvas particle network ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    type Pt = { x: number; y: number; vx: number; vy: number; r: number; c: string };
    const pts: Pt[] = Array.from({ length: 55 }, () => ({
      x: Math.random() * 100, y: Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.03, vy: (Math.random() - 0.5) * 0.03,
      r: Math.random() * 1.5 + 0.5,
      c: Math.random() < 0.5 ? "rgba(99,102,241," : "rgba(168,85,247,",
    }));
    function resize() { canvas!.width = canvas!.offsetWidth; canvas!.height = canvas!.offsetHeight; }
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
        ctx.beginPath(); ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c + "0.4)"; ctx.fill();
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j];
          const qx = (q.x / 100) * W, qy = (q.y / 100) * H;
          const d = Math.hypot(px - qx, py - qy);
          if (d < 120) {
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, qy);
            ctx.strokeStyle = p.c + (1 - d / 120) * 0.12 + ")";
            ctx.lineWidth = 0.6; ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  /* ── Validation ── */
  function validate() {
    const e: FieldError = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Nama minimal 2 karakter";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Format email tidak valid";
    if (form.password.length < 8) e.password = "Password minimal 8 karakter";
    else if (!/[A-Z]/.test(form.password)) e.password = "Harus mengandung huruf kapital";
    else if (!/[0-9]/.test(form.password)) e.password = "Harus mengandung angka";
    if (form.password !== form.confirm) e.confirm = "Password tidak cocok";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /* ── Strength indicator ── */
  function passwordStrength(pw: string): { level: number; label: string; color: string } {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (pw.length >= 12) score++;
    if (score <= 1) return { level: score, label: "Lemah", color: "#ef4444" };
    if (score <= 2) return { level: score, label: "Cukup", color: "#f59e0b" };
    if (score <= 3) return { level: score, label: "Baik", color: "#6366f1" };
    return { level: score, label: "Kuat", color: "#10b981" };
  }

  const strength = passwordStrength(form.password);

  /* ── Submit ── */
  async function handleSubmit() {
    setServerErr("");
    if (!validate()) return;
    setView("loading");
    const msgs = ["Memvalidasi data...", "Mengenkripsi password...", "Membuat akun..."];
    let i = 0;
    setLoadMsg(msgs[0]);
    const t = setInterval(() => { setLoadMsg(msgs[++i] ?? msgs[2]); if (i >= msgs.length - 1) clearInterval(t); }, 600);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      clearInterval(t);
      const data = await res.json();
      if (!res.ok) { setServerErr(data.error ?? "Terjadi kesalahan"); setView("form"); return; }
      setView("success");
      setTimeout(async () => {
        await signIn("credentials", { email: form.email, password: form.password, redirect: false });
        router.push("/");
      }, 2000);
    } catch {
      clearInterval(t);
      setServerErr("Tidak dapat terhubung ke server. Coba lagi.");
      setView("form");
    }
  }

  function handleGoogle() {
    setView("loading"); setLoadMsg("Menghubungkan ke Google...");
    signIn("google", { callbackUrl: "/" });
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(f => ({ ...f, [key]: e.target.value }));
      setErrors(er => ({ ...er, [key]: undefined }));
    },
  });

  const EyeIcon = ({ open }: { open: boolean }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      )}
    </svg>
  );

  return (
    <>
      <style>{globalCSS}</style>
      <div style={s.body}>

        {/* ── LEFT (desktop) / MOBILE HEADER ── */}
        <div style={s.left} className="left-panel">
          <canvas ref={canvasRef} style={s.canvas} />
          <div style={s.vizArea}>
            {/* Mobile: compact header */}
            <div className="mobile-header">
              <p style={s.brandTag}>// DATALYTICS PLATFORM v2.4</p>
              <h1 style={{ ...s.heroTitle, fontSize: "clamp(20px,5vw,28px)", marginBottom: 4 }}>
                Mulai Perjalanan Analisis Data Anda
              </h1>
              {/* Mobile step pills */}
              <div className="mobile-steps">
                {["Buat Akun", "Verifikasi Email", "Akses Dashboard"].map((s, i) => (
                  <div key={i} className="mobile-step-pill">
                    <span className="mobile-step-num">0{i + 1}</span>
                    <span className="mobile-step-label">{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop: full content */}
            <div className="desktop-only">
              <p style={s.brandTag}>// DATALYTICS PLATFORM v2.4</p>
              <h1 style={s.heroTitle}>Mulai Perjalanan<br />Analisis Data Anda</h1>
              <p style={s.heroSub}>Daftarkan akun Anda dan dapatkan akses penuh ke empat modul machine learning terpadu.</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 36 }}>
                {[
                  { n: "01", title: "Buat Akun",        desc: "Isi data diri Anda dengan aman",          c: "#6366f1", bg: "rgba(99,102,241,0.08)"  },
                  { n: "02", title: "Verifikasi Email",  desc: "Konfirmasi kepemilikan email Anda",       c: "#a855f7", bg: "rgba(168,85,247,0.08)"  },
                  { n: "03", title: "Akses Dashboard",   desc: "Gunakan semua fitur analitik langsung",   c: "#f59e0b", bg: "rgba(245,158,11,0.08)"  },
                ].map((step, idx) => (
                  <div key={idx} className="step-card" style={{ display:"flex", alignItems:"center", gap:16, background:step.bg, border:`1px solid ${step.c}22`, borderRadius:12, padding:"14px 18px" }}>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:500, color:step.c, minWidth:24 }}>{step.n}</div>
                    <div style={{ width:1, height:28, background:step.c, opacity:0.25 }} />
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:"#1a1a2e", marginBottom:2 }}>{step.title}</div>
                      <div style={{ fontSize:11.5, color:"#9ca3af" }}>{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={s.tagRow}>
                {[
                  { text: "Enkripsi bcrypt",     c:"#6366f1", bc:"rgba(99,102,241,0.35)",  bg:"rgba(99,102,241,0.07)"  },
                  { text: "OAuth 2.0 Google",    c:"#a855f7", bc:"rgba(168,85,247,0.35)",  bg:"rgba(168,85,247,0.07)"  },
                  { text: "Prisma ORM",          c:"#d97706", bc:"rgba(217,119,6,0.35)",   bg:"rgba(245,158,11,0.07)"  },
                  { text: "PostgreSQL",          c:"#dc2626", bc:"rgba(220,38,38,0.35)",   bg:"rgba(239,68,68,0.07)"   },
                ].map(t => (
                  <span key={t.text} style={{ ...s.tag, color:t.c, borderColor:t.bc, background:t.bg }}>{t.text}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT / FORM PANEL ── */}
        <div style={s.right} className="right-panel">

          {/* FORM */}
          {view === "form" && (
            <div className="fade-up">
              <div style={{ marginBottom: 24 }}>
                <h2 style={s.loginH2}>Buat Akun Baru</h2>
                <p style={s.loginSub}>Daftar gratis dan mulai analisis data Anda hari ini.</p>
              </div>

              {serverErr && (
                <div style={s.alertErr}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {serverErr}
                </div>
              )}

              {/* Name */}
              <div style={s.field}>
                <label style={s.fieldLabel}>Nama Lengkap</label>
                <input style={{ ...s.input, ...(errors.name ? s.inputErr : {}) }}
                  type="text" placeholder="John Doe" {...field("name")} className="custom-input" />
                {errors.name && <p style={s.errMsg}>{errors.name}</p>}
              </div>

              {/* Email */}
              <div style={s.field}>
                <label style={s.fieldLabel}>Email</label>
                <input style={{ ...s.input, ...(errors.email ? s.inputErr : {}) }}
                  type="email" placeholder="analyst@example.com" {...field("email")} className="custom-input" />
                {errors.email && <p style={s.errMsg}>{errors.email}</p>}
              </div>

              {/* Password */}
              <div style={s.field}>
                <label style={s.fieldLabel}>Password</label>
                <div style={s.passwordWrapper}>
                  <input style={{ ...s.input, ...(errors.password ? s.inputErr : {}), paddingRight: 48 }}
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 karakter + huruf kapital + angka"
                    {...field("password")}
                    className="custom-input"
                  />
                  <button type="button" style={s.eyeButton} onClick={() => setShowPassword(!showPassword)} tabIndex={-1} aria-label="Toggle password visibility">
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                {form.password.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display:"flex", gap:4, marginBottom:5 }}>
                      {[1,2,3,4].map(i => (
                        <div key={i} style={{ flex:1, height:3, borderRadius:2, background: i <= strength.level ? strength.color : "rgba(0,0,0,0.08)", transition:"background 0.3s" }} />
                      ))}
                    </div>
                    <p style={{ fontSize:11, color:strength.color, fontFamily:"'DM Mono',monospace" }}>Kekuatan: {strength.label}</p>
                  </div>
                )}
                {errors.password && <p style={s.errMsg}>{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div style={s.field}>
                <label style={s.fieldLabel}>Konfirmasi Password</label>
                <div style={s.passwordWrapper}>
                  <input style={{ ...s.input, ...(errors.confirm ? s.inputErr : {}), paddingRight: 48 }}
                    type={showConfirm ? "text" : "password"}
                    placeholder="Ulangi password Anda"
                    {...field("confirm")}
                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                    className="custom-input"
                  />
                  <button type="button" style={s.eyeButton} onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1} aria-label="Toggle confirm password visibility">
                    <EyeIcon open={showConfirm} />
                  </button>
                </div>
                {errors.confirm && <p style={s.errMsg}>{errors.confirm}</p>}
              </div>

              {/* Terms */}
              <p style={{ fontSize:11, color:"#9ca3af", lineHeight:1.6, marginBottom:16 }}>
                Dengan mendaftar, Anda menyetujui{" "}
                <a href="/terms" style={{ color:"#6366f1", textDecoration:"none" }}>Syarat & Ketentuan</a>
                {" "}dan{" "}
                <a href="/privacy" style={{ color:"#6366f1", textDecoration:"none" }}>Kebijakan Privasi</a> kami.
              </p>

              <button style={s.btnLogin} className="btn-login-hover" onClick={handleSubmit}>
                Daftar Sekarang →
              </button>

              <div style={s.orRow}>
                <div style={s.orLine}/><span style={s.orText}>atau</span><div style={s.orLine}/>
              </div>

              <button style={s.btnGoogle} className="btn-google-hover" onClick={handleGoogle}>
                <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.015 17.64 11.707 17.64 9.2z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Daftar dengan Google
              </button>

              <p style={s.loginFooter}>
                Sudah punya akun?{" "}
                <a href="/" style={{ color:"#6366f1", textDecoration:"none", fontWeight:600 }}>Masuk sekarang</a>
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

          {/* SUCCESS */}
          {view === "success" && (
            <div className="fade-up" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20, padding:40, textAlign:"center" }}>
              <div style={{ width:64, height:64, borderRadius:"50%", background:"rgba(16,185,129,0.1)", border:"2px solid rgba(16,185,129,0.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize:20, fontWeight:700, color:"#1a1a2e", marginBottom:8 }}>Akun Berhasil Dibuat!</h3>
                <p style={{ fontSize:13, color:"#9ca3af", fontFamily:"'DM Mono',monospace" }}>Mengalihkan ke dashboard...</p>
              </div>
              <div style={s.spinnerRing} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Styles ── */
const s: Record<string, React.CSSProperties> = {
  body:       { display:"flex", minHeight:"100vh", background:"#f8f8f6", color:"#1a1a2e", fontFamily:"'Outfit',sans-serif" },
  left:       { width:"55%", position:"relative", display:"flex", flexDirection:"column", justifyContent:"center", padding:"48px 56px", overflow:"hidden", borderRight:"1px solid rgba(0,0,0,0.07)", background:"#f0f0ed" },
  canvas:     { position:"absolute", inset:0, width:"100%", height:"100%", zIndex:0 },
  vizArea:    { position:"relative", zIndex:1, pointerEvents:"none" },
  brandTag:   { fontSize:11, fontFamily:"'DM Mono',monospace", color:"#9ca3af", letterSpacing:"0.05em", marginBottom:6 },
  heroTitle:  { fontSize:"clamp(28px,3.5vw,42px)", fontWeight:800, lineHeight:1.15, marginBottom:12, background:"linear-gradient(135deg,#1a1a2e 30%,#6366f1)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" },
  heroSub:    { fontSize:14, color:"#6b7280", lineHeight:1.7, maxWidth:340, marginBottom:28 },
  tagRow:     { display:"flex", flexWrap:"wrap" as const, gap:8 },
  tag:        { fontSize:11, fontWeight:500, fontFamily:"'DM Mono',monospace", padding:"5px 12px", borderRadius:20, border:"1px solid", letterSpacing:"0.04em" },
  right:      { width:"45%", display:"flex", flexDirection:"column", justifyContent:"center", padding:"48px 52px", position:"relative", overflowY:"auto" as const, background:"#f8f8f6" },
  loginH2:    { fontSize:24, fontWeight:700, marginBottom:6, color:"#1a1a2e" },
  loginSub:   { fontSize:13, color:"#6b7280", lineHeight:1.6 },
  field:      { marginBottom:14 },
  fieldLabel: { display:"block", fontSize:11.5, fontWeight:600, letterSpacing:"0.06em", color:"#6b7280", marginBottom:7, textTransform:"uppercase" as const },
  input:      { width:"100%", padding:"12px 16px", background:"#ffffff", border:"1px solid rgba(0,0,0,0.12)", borderRadius:10, color:"#1a1a2e", fontFamily:"'Outfit',sans-serif", fontSize:16, outline:"none", boxShadow:"0 1px 3px rgba(0,0,0,0.05)", WebkitAppearance: "none" },
  inputErr:   { borderColor:"rgba(239,68,68,0.5)", background:"rgba(239,68,68,0.03)" },
  errMsg:     { fontSize:11, color:"#ef4444", marginTop:5, fontFamily:"'DM Mono',monospace" },
  alertErr:   { display:"flex", alignItems:"center", gap:8, padding:"11px 14px", background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:10, fontSize:13, color:"#dc2626", marginBottom:18 },
  btnLogin:   { width:"100%", padding:15, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", border:"none", borderRadius:10, color:"#ffffff", fontFamily:"'Outfit',sans-serif", fontSize:15, fontWeight:700, cursor:"pointer", letterSpacing:"0.02em", marginTop:4, boxShadow:"0 4px 14px rgba(99,102,241,0.3)", WebkitAppearance: "none", touchAction: "manipulation" },
  orRow:      { display:"flex", alignItems:"center", gap:12, margin:"16px 0" },
  orLine:     { flex:1, height:1, background:"rgba(0,0,0,0.08)" },
  orText:     { fontSize:11, color:"#9ca3af", fontFamily:"'DM Mono',monospace" },
  btnGoogle:  { width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:10, padding:14, background:"#ffffff", border:"1px solid rgba(0,0,0,0.1)", borderRadius:10, color:"#1a1a2e", fontFamily:"'Outfit',sans-serif", fontSize:14, fontWeight:500, cursor:"pointer", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", WebkitAppearance: "none", touchAction: "manipulation" },
  loginFooter:{ textAlign:"center" as const, fontSize:12, color:"#9ca3af", marginTop:20 },
  spinnerRing:{ width:40, height:40, border:"2px solid rgba(0,0,0,0.08)", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.75s linear infinite" },
  loadingText:{ fontSize:13, color:"#9ca3af", fontFamily:"'DM Mono',monospace" },
  passwordWrapper: { position:"relative" as const },
  eyeButton: { position:"absolute" as const, right:12, top:"50%", transform:"translateY(-50%)", background:"transparent", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:4, color:"#9ca3af", transition:"color 0.2s", minWidth:32, minHeight:32, touchAction:"manipulation" },
};

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700;800&display=swap');

  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }

  .fade-up { animation: fadeUp 0.45s ease both; }
  .step-card { transition: transform 0.2s; }
  .step-card:hover { transform: translateX(4px); }
  .custom-input:focus { border-color: rgba(99,102,241,0.45) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.1) !important; }
  .btn-login-hover:active { filter:brightness(0.95); transform:scale(0.98); }
  .btn-google-hover:active { background:#ececea !important; transform:scale(0.98); }

  /* Desktop hover */
  @media (hover: hover) {
    .btn-login-hover:hover { filter:brightness(1.06); transform:translateY(-1px); box-shadow:0 10px 24px rgba(99,102,241,0.35) !important; transition:all 0.2s; }
    .btn-google-hover:hover { background:#ececea !important; border-color:rgba(0,0,0,0.15) !important; transform:translateY(-1px); transition:all 0.2s; }
  }

  * { box-sizing:border-box; margin:0; padding:0; }

  /* ── Hide/show helpers ── */
  .mobile-header  { display: none; }
  .desktop-only   { display: block; }

  /* ── Mobile styles ── */
  @media (max-width: 768px) {
    /* Layout: stack vertically */
    div[style*="display:flex"][style*="min-height:100vh"],
    .register-body {
      flex-direction: column !important;
      overflow: auto !important;
    }

    /* Left panel becomes compact header */
    .left-panel {
      width: 100% !important;
      min-height: auto !important;
      padding: 20px 20px 18px !important;
      border-right: none !important;
      border-bottom: 1px solid rgba(0,0,0,0.07) !important;
    }

    /* Right panel full width */
    .right-panel {
      width: 100% !important;
      padding: 24px 20px 32px !important;
      min-height: auto !important;
      justify-content: flex-start !important;
    }

    /* Switch desktop/mobile content */
    .desktop-only { display: none !important; }
    .mobile-header { display: block !important; }

    /* Mobile step pills */
    .mobile-steps {
      display: flex;
      gap: 8px;
      margin-top: 10px;
      flex-wrap: wrap;
    }

    .mobile-step-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(99,102,241,0.07);
      border: 1px solid rgba(99,102,241,0.18);
      border-radius: 20px;
      padding: 5px 11px;
    }

    .mobile-step-num {
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      font-weight: 500;
      color: #6366f1;
    }

    .mobile-step-label {
      font-size: 11px;
      font-weight: 500;
      color: #374151;
    }
  }

  /* ── Small mobile (≤ 380px) ── */
  @media (max-width: 380px) {
    .left-panel {
      padding: 16px 16px 14px !important;
    }
    .right-panel {
      padding: 20px 16px 28px !important;
    }
    .mobile-step-pill {
      padding: 4px 9px;
    }
  }
`;