"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/* ─── Types ─── */
type Plan = {
  id:          string;
  name:        string;
  price:       number;       // IDR per bulan
  priceLabel:  string;
  period:      string;
  dailyLimit:  number | "∞";
  badge?:      string;
  features:    string[];
  cta:         string;
  highlight:   boolean;
};

/* ─── Plan data (hanya 2 paket) ─── */
const PLANS: Plan[] = [
  {
    id:         "free",
    name:       "Free",
    price:       0,
    priceLabel: "Gratis",
    period:     "selamanya",
    dailyLimit: 3,
    features: [
      "3 analisis / hari",
    ],
    cta:       "Paket Kamu",
    highlight: false,
  },
  {
    id:         "pro",
    name:       "Pro",
    price:       99000,
    priceLabel: "Rp 99.000",
    period:     "/ bulan",
    dailyLimit: 20,
    badge:      "Rekomendasi",
    features: [
      "20 analisis / hari",
    ],
    cta:       "Upgrade ke Pro",
    highlight: true,
  },
];

/* ─── Midtrans Snap loader ─── */
declare global {
  interface Window {
    snap?: {
      pay: (token: string, options: {
        onSuccess:  (result: unknown) => void;
        onPending:  (result: unknown) => void;
        onError:    (result: unknown) => void;
        onClose:    () => void;
      }) => void;
    };
  }
}

function loadSnapScript(clientKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.snap) { resolve(); return; }
    const s = document.createElement("script");
    s.src = `https://app.sandbox.midtrans.com/snap/snap.js`; // ganti ke production saat go-live
    s.setAttribute("data-client-key", clientKey);
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error("Gagal memuat Midtrans Snap"));
    document.head.appendChild(s);
  });
}

/* ══════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════ */
export default function PricingPage() {
  const router  = useRouter();
  const { data: session } = useSession();

  const [loading,   setLoading]   = useState<string | null>(null);
  const [toast,     setToast]     = useState<{ type: "success"|"error"|"info"; msg: string } | null>(null);
  const [annual,    setAnnual]    = useState(false);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(type: "success"|"error"|"info", msg: string) {
    setToast({ type, msg });
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => () => { if (toastRef.current) clearTimeout(toastRef.current); }, []);

  async function handleCheckout(plan: Plan) {
    if (plan.id === "free") return;
    if (!session?.user) {
      showToast("info", "Silakan login terlebih dahulu.");
      router.push("/login");
      return;
    }

    setLoading(plan.id);
    try {
      const res = await fetch("/api/payment/create-transaction", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          planId:    plan.id,
          planName:  plan.name,
          price:     annual ? Math.round(plan.price * 12 * 0.8) : plan.price,
          period:    annual ? "annual" : "monthly",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Gagal membuat transaksi");
      }

      const { snapToken, clientKey } = await res.json();

      await loadSnapScript(clientKey);

      window.snap!.pay(snapToken, {
        onSuccess: () => {
          showToast("success", "Pembayaran berhasil! Akun kamu akan diupgrade.");
          router.push("/dashboard?upgraded=1");
        },
        onPending: () => {
          showToast("info", "Pembayaran pending. Kami akan konfirmasi segera.");
          router.push("/dashboard");
        },
        onError: () => {
          showToast("error", "Pembayaran gagal. Silakan coba lagi.");
        },
        onClose: () => {
          showToast("info", "Checkout ditutup.");
        },
      });
    } catch (err: unknown) {
      const e = err as Error;
      showToast("error", e.message || "Terjadi kesalahan.");
    } finally {
      setLoading(null);
    }
  }

  const discount = annual ? "Hemat 20%" : null;

  return (
    <>
      <style>{CSS}</style>

      {toast && (
        <div style={{ ...ts.toast, ...ts[`toast_${toast.type}`] }} className="toast-in">
          {toast.type === "success" && "✅ "}
          {toast.type === "error"   && "❌ "}
          {toast.type === "info"    && "ℹ️ "}
          {toast.msg}
        </div>
      )}

      <div style={s.page}>
        <header style={s.header}>
          <button style={s.backBtn} onClick={() => router.back()}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Kembali
          </button>
        </header>

        <section style={s.hero}>
          <div style={s.heroBadge}>💎 Pilih Paket Sesuai Kebutuhan</div>
          <h1 style={s.heroTitle}>Analisis data tanpa batas,<br/>lebih hemat dengan Pro.</h1>
          <p style={s.heroSub}>Mulai gratis, upgrade kapan saja. Harga transparan, tanpa biaya tersembunyi.</p>

          <div style={s.toggle}>
            <span style={{ ...s.toggleLabel, color: !annual ? "#1a1a2e" : "#9ca3af" }}>Bulanan</span>
            <button
              style={{ ...s.toggleSwitch, background: annual ? "#6366f1" : "rgba(0,0,0,0.12)" }}
              onClick={() => setAnnual(v => !v)}
              role="switch" aria-checked={annual}
            >
              <span style={{ ...s.toggleThumb, transform: annual ? "translateX(20px)" : "translateX(2px)" }}/>
            </button>
            <span style={{ ...s.toggleLabel, color: annual ? "#1a1a2e" : "#9ca3af" }}>
              Tahunan {discount && <span style={s.saveBadge}>{discount}</span>}
            </span>
          </div>
        </section>

        <section style={s.cards}>
          {PLANS.map(plan => {
            const effectivePrice = annual && plan.price > 0
              ? Math.round(plan.price * 12 * 0.8)
              : plan.price;
            const isLoading = loading === plan.id;
            const isFree    = plan.id === "free";

            return (
              <div key={plan.id} style={{ ...s.card, ...(plan.highlight ? s.cardHL : {}) }} className="plan-card">
                {plan.badge && <div style={s.badge}>{plan.badge}</div>}

                <div style={s.cardTop}>
                  <div style={s.planIcon}>
                    {plan.id === "free" && "🌱"}
                    {plan.id === "pro"  && "⚡"}
                  </div>
                  <h2 style={{ ...s.planName, color: plan.highlight ? "#fff" : "#1a1a2e" }}>{plan.name}</h2>

                  <div style={s.priceRow}>
                    {plan.price === 0 ? (
                      <span style={{ ...s.priceMain, color: plan.highlight ? "#fff" : "#1a1a2e" }}>Gratis</span>
                    ) : (
                      <>
                        {annual && (
                          <span style={{ ...s.priceOld, color: plan.highlight ? "rgba(255,255,255,0.5)" : "#9ca3af" }}>
                            Rp {(plan.price * 12).toLocaleString("id-ID")}
                          </span>
                        )}
                        <span style={{ ...s.priceMain, color: plan.highlight ? "#fff" : "#1a1a2e" }}>
                          Rp {effectivePrice.toLocaleString("id-ID")}
                        </span>
                        <span style={{ ...s.pricePeriod, color: plan.highlight ? "rgba(255,255,255,0.65)" : "#9ca3af" }}>
                          {annual ? "/ tahun" : plan.period}
                        </span>
                      </>
                    )}
                  </div>

                  <div style={{ ...s.quotaBadge, background: plan.highlight ? "rgba(255,255,255,0.15)" : "rgba(99,102,241,0.07)", color: plan.highlight ? "#fff" : "#6366f1" }}>
                    {plan.dailyLimit === 100 ? "100 analisis/hari" : `${plan.dailyLimit} analisis/hari`}
                  </div>
                </div>

                <ul style={s.features}>
                  {plan.features.map(f => (
                    <li key={f} style={s.feature}>
                      <span style={{ ...s.featureCheck, color: plan.highlight ? "#a5f3b4" : "#10b981" }}>✓</span>
                      <span style={{ color: plan.highlight ? "rgba(255,255,255,0.85)" : "#374151" }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  style={{
                    ...s.ctaBtn,
                    ...(plan.highlight ? s.ctaBtnHL : {}),
                    ...(isFree ? s.ctaBtnFree : {}),
                    opacity: isFree ? 0.6 : 1,
                  }}
                  onClick={() => handleCheckout(plan)}
                  disabled={isFree || isLoading}
                  className={!isFree ? "cta-hover" : ""}
                >
                  {isLoading ? (
                    <span style={s.spinner} className="spin"/>
                  ) : (
                    <>
                      {!isFree && !plan.highlight && <span>→ </span>}
                      {plan.cta}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </section>

        <section style={s.faq}>
          {[
            { q: "Kapan akun diupgrade?", a: "Segera setelah pembayaran dikonfirmasi Midtrans, biasanya dalam hitungan detik." },
            { q: "Metode pembayaran apa saja?", a: "GoPay, OVO, Dana, QRIS, transfer bank (BCA, Mandiri, BNI, BRI), dan kartu kredit/debit." },
            { q: "Bisa cancel kapan saja?", a: "Ya. Tidak ada kontrak. Cancel dari dashboard dan quota kembali ke Free setelah periode habis." },
          ].map(({ q, a }) => (
            <div key={q} style={s.faqItem}>
              <p style={s.faqQ}>{q}</p>
              <p style={s.faqA}>{a}</p>
            </div>
          ))}
        </section>

        <p style={s.footNote}>
          Pembayaran diproses aman melalui <strong>Midtrans</strong> · Terenkripsi SSL · PCI-DSS compliant
        </p>
      </div>
    </>
  );
}

/* ─── Styles (tetap) ─── */
const s: Record<string, React.CSSProperties> = {
  page:         { minHeight:"100vh", background:"#f8f8f6", fontFamily:"'Outfit',sans-serif", color:"#1a1a2e", paddingBottom:80 },
  header:       { padding:"20px 32px", display:"flex", alignItems:"center" },
  backBtn:      { display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#9ca3af", background:"none", border:"none", cursor:"pointer", fontFamily:"'Outfit',sans-serif", fontWeight:500 },
  hero:         { textAlign:"center", padding:"40px 24px 20px" },
  heroBadge:    { display:"inline-block", padding:"5px 14px", background:"rgba(99,102,241,0.08)", borderRadius:99, fontSize:12, fontWeight:600, color:"#6366f1", marginBottom:16, border:"1px solid rgba(99,102,241,0.15)" },
  heroTitle:    { fontSize:"clamp(26px,4vw,42px)", fontWeight:800, lineHeight:1.22, marginBottom:14, letterSpacing:"-0.02em" },
  heroSub:      { fontSize:15, color:"#6b7280", maxWidth:500, margin:"0 auto 28px", lineHeight:1.6 },
  toggle:       { display:"inline-flex", alignItems:"center", gap:10, background:"rgba(0,0,0,0.04)", padding:"8px 16px", borderRadius:99, border:"1px solid rgba(0,0,0,0.07)" },
  toggleLabel:  { fontSize:13, fontWeight:600, transition:"color 0.2s" },
  toggleSwitch: { width:44, height:24, borderRadius:99, border:"none", cursor:"pointer", position:"relative", transition:"background 0.3s", flexShrink:0 },
  toggleThumb:  { position:"absolute", top:2, width:20, height:20, background:"#fff", borderRadius:"50%", transition:"transform 0.3s cubic-bezier(.34,1.56,.64,1)", boxShadow:"0 1px 4px rgba(0,0,0,0.18)" },
  saveBadge:    { marginLeft:6, fontSize:10.5, fontWeight:700, background:"#10b981", color:"#fff", padding:"2px 7px", borderRadius:99 },
  cards:        { display:"flex", gap:20, justifyContent:"center", flexWrap:"wrap", padding:"32px 24px 0" },
  card:         { position:"relative", width:300, background:"#fff", border:"1px solid rgba(0,0,0,0.08)", borderRadius:20, padding:"28px 24px", display:"flex", flexDirection:"column", gap:0, boxShadow:"0 2px 16px rgba(0,0,0,0.05)", transition:"transform 0.2s,box-shadow 0.2s" },
  cardHL:       { background:"linear-gradient(145deg,#4f46e5,#7c3aed)", border:"none", boxShadow:"0 12px 40px rgba(99,102,241,0.35)" },
  badge:        { position:"absolute", top:-13, left:"50%", transform:"translateX(-50%)", background:"linear-gradient(90deg,#f59e0b,#ef4444)", color:"#fff", fontSize:10.5, fontWeight:800, padding:"4px 14px", borderRadius:99, whiteSpace:"nowrap", letterSpacing:"0.04em", boxShadow:"0 2px 8px rgba(245,158,11,0.35)" },
  cardTop:      { marginBottom:20 },
  planIcon:     { fontSize:28, marginBottom:10 },
  planName:     { fontSize:19, fontWeight:800, marginBottom:12 },
  priceRow:     { display:"flex", alignItems:"baseline", gap:6, flexWrap:"wrap", marginBottom:12 },
  priceOld:     { fontSize:12, textDecoration:"line-through", fontFamily:"'DM Mono',monospace" },
  priceMain:    { fontSize:28, fontWeight:800, fontFamily:"'DM Mono',monospace", letterSpacing:"-0.02em" },
  pricePeriod:  { fontSize:13, fontWeight:500 },
  quotaBadge:   { display:"inline-flex", padding:"4px 12px", borderRadius:99, fontSize:12, fontWeight:700, fontFamily:"'DM Mono',monospace" },
  features:     { listStyle:"none", display:"flex", flexDirection:"column", gap:9, marginBottom:24, flex:1 },
  feature:      { display:"flex", alignItems:"flex-start", gap:8, fontSize:13, lineHeight:1.4 },
  featureCheck: { fontWeight:800, marginTop:1, flexShrink:0 },
  ctaBtn:       { width:"100%", padding:"13px 0", borderRadius:12, border:"none", fontSize:13.5, fontWeight:700, cursor:"pointer", fontFamily:"'Outfit',sans-serif", background:"rgba(99,102,241,0.09)", color:"#6366f1", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center", gap:6 },
  ctaBtnHL:     { background:"#fff", color:"#4f46e5", boxShadow:"0 4px 16px rgba(0,0,0,0.12)" },
  ctaBtnFree:   { background:"rgba(0,0,0,0.05)", color:"#9ca3af", cursor:"not-allowed" },
  spinner:      { width:16, height:16, border:"2.5px solid currentColor", borderTopColor:"transparent", borderRadius:"50%", display:"inline-block" },
  faq:          { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:16, maxWidth:900, margin:"52px auto 0", padding:"0 24px" },
  faqItem:      { background:"#fff", border:"1px solid rgba(0,0,0,0.07)", borderRadius:14, padding:"18px 20px" },
  faqQ:         { fontSize:13, fontWeight:700, marginBottom:6, color:"#1a1a2e" },
  faqA:         { fontSize:12, color:"#6b7280", lineHeight:1.6 },
  footNote:     { textAlign:"center", fontSize:11.5, color:"#9ca3af", marginTop:48, fontFamily:"'DM Mono',monospace" },
};

const ts: Record<string, React.CSSProperties> = {
  toast:          { position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", padding:"12px 22px", borderRadius:12, fontSize:13, fontWeight:600, fontFamily:"'Outfit',sans-serif", boxShadow:"0 8px 32px rgba(0,0,0,0.18)", zIndex:9999, whiteSpace:"nowrap" },
  toast_success:  { background:"#1a1a2e", color:"#a5f3b4" },
  toast_error:    { background:"#1a1a2e", color:"#fca5a5" },
  toast_info:     { background:"#1a1a2e", color:"#c7d2fe" },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(16px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
  .spin { animation: spin 0.7s linear infinite; }
  .toast-in { animation: toastIn 0.3s cubic-bezier(.34,1.56,.64,1) both; }
  .plan-card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(0,0,0,0.1) !important; }
  .cta-hover:hover { filter: brightness(1.08); transform: scale(1.02); }
  @media (max-width: 600px) {
    .plan-card { width: 100% !important; max-width: 360px; }
  }
`;