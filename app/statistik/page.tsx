"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";

/* ─── Types ─── */
type DataRow = Record<string, number | string>;
type ColumnType = "numeric" | "categorical";

type DescriptiveStats = {
  count: number; mean: number; median: number; min: number; max: number;
  std: number; skewness: number; kurtosis: number; q1: number; q3: number;
};
type CorrelationMatrix = { columns: string[]; matrix: number[][]; pValues: number[][] };
type TTestResult = { statistic: number; pValue: number; df: number; significant: boolean; interpretation: string };
type PearsonResult = { correlation: number; pValue: number; significant: boolean; interpretation: string };

/* ══════════════════════════════════════
   QUOTA — server-side via API
══════════════════════════════════════ */
type QuotaStatus = {
  allowed:    boolean;
  usedToday:  number;
  dailyLimit: number;
  remaining:  number;
  role:       string;
  resetAt:    string;
};

const QUOTA_FALLBACK: QuotaStatus = {
  allowed: true, usedToday: 0, dailyLimit: 3, remaining: 3, role: "free", resetAt: "",
};

function useQuota() {
  const [quota, setQuota]     = useState<QuotaStatus>(QUOTA_FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/quota")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setQuota(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /** Konsumsi 1 slot. Kembalikan true = boleh lanjut, false = quota habis. */
  const consume = useCallback(async (): Promise<boolean> => {
    try {
      const res  = await fetch("/api/quota", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "file_analysis" }) });
      const data = await res.json();
      if (res.status === 429 || data.error === "QUOTA_EXCEEDED") {
        setQuota(prev => ({ ...prev, ...data, allowed: false }));
        return false;
      }
      if (!res.ok) return false;
      setQuota(data);
      return true;
    } catch {
      return true; // fail-open: jangan blokir jika network error
    }
  }, []);

  return { quota, loading, consume };
}

/* ══════════════════════════════════════
   STATISTICAL FUNCTIONS
══════════════════════════════════════ */
function mean(arr: number[]): number { if (!arr.length) return 0; return arr.reduce((a,b)=>a+b,0)/arr.length; }
function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a,b)=>a-b); const m = Math.floor(s.length/2);
  return s.length%2===0?(s[m-1]+s[m])/2:s[m];
}
function variance(arr: number[], sample=true): number {
  const m=mean(arr); const sq=arr.map(v=>(v-m)**2);
  return sq.reduce((a,b)=>a+b,0)/(sample?arr.length-1:arr.length);
}
function std(arr: number[], sample=true): number { return Math.sqrt(variance(arr,sample)); }
function skewness(arr: number[]): number {
  const n=arr.length, m=mean(arr), s=std(arr,false);
  if(s===0) return 0;
  return arr.reduce((acc,v)=>acc+(v-m)**3,0)/n/(s**3);
}
function kurtosis(arr: number[]): number {
  const n=arr.length, m=mean(arr), s=std(arr,false);
  if(s===0) return -3;
  return arr.reduce((acc,v)=>acc+(v-m)**4,0)/n/(s**4)-3;
}
function quantile(arr: number[], q: number): number {
  const s=[...arr].sort((a,b)=>a-b); const pos=(s.length-1)*q;
  const base=Math.floor(pos), rest=pos-base;
  if(rest===0||base+1>=s.length) return s[base];
  return s[base]+rest*(s[base+1]-s[base]);
}
function pearsonCorrelation(a: number[], b: number[]): number {
  const m1=mean(a), m2=mean(b);
  const num=a.reduce((acc,v,i)=>acc+(v-m1)*(b[i]-m2),0);
  const d=Math.sqrt(a.reduce((acc,v)=>acc+(v-m1)**2,0)*b.reduce((acc,v)=>acc+(v-m2)**2,0));
  return d===0?0:num/d;
}
function gamma(n: number): number {
  if(n<0.5) return Math.PI/(Math.sin(Math.PI*n)*gamma(1-n));
  n-=1;
  const p=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  let x=p[0]; for(let i=1;i<p.length;i++) x+=p[i]/(n+i);
  const t=n+7.5; return Math.sqrt(2*Math.PI)*Math.pow(t,n+0.5)*Math.exp(-t)*x;
}
function lbeta(a: number, b: number): number { return Math.log(gamma(a)*gamma(b)/gamma(a+b)); }
function cfBeta(a: number, b: number, x: number, eps=1e-8, max=100): number {
  const qab=a+b,qap=a+1,qam=a-1; let c=1,d=1-qab*x/qap;
  if(Math.abs(d)<eps) d=eps; d=1/d; let h=d;
  for(let m=1;m<=max;m++){
    const m2=2*m; let aa=m*(b-m)*x/((qam+m2)*(a+m2));
    d=1+aa*d; if(Math.abs(d)<eps) d=eps; c=1+aa/c; if(Math.abs(c)<eps) c=eps;
    d=1/d; h*=d*c;
    aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));
    d=1+aa*d; if(Math.abs(d)<eps) d=eps; c=1+aa/c; if(Math.abs(c)<eps) c=eps;
    d=1/d; const del=d*c; h*=del; if(Math.abs(del-1)<eps) break;
  }
  return h;
}
function regIncBeta(a: number, b: number, x: number): number {
  if(x===0) return 0; if(x===1) return 1;
  return Math.exp(a*Math.log(x)+b*Math.log(1-x)-Math.log(a)-lbeta(a,b))*cfBeta(a,b,x);
}
function tcdf(t: number, df: number): number {
  const x=t/Math.sqrt(df), z=x/Math.sqrt(1+x*x);
  return 1-regIncBeta(df/2,0.5,z);
}
function pearsonPValue(r: number, n: number): number {
  if(n<3) return 1;
  const t=Math.abs(r)*Math.sqrt((n-2)/(1-r*r));
  return 2*(1-tcdf(t,n-2));
}
function tTestIndependent(s1: number[], s2: number[]): TTestResult {
  const n1=s1.length, n2=s2.length, m1=mean(s1), m2=mean(s2), v1=variance(s1), v2=variance(s2);
  const se=Math.sqrt(v1/n1+v2/n2), t=(m1-m2)/se;
  const df=Math.pow(se,4)/(Math.pow(v1/n1,2)/(n1-1)+Math.pow(v2/n2,2)/(n2-1));
  const pValue=2*(1-tcdf(Math.abs(t),df));
  return { statistic:t, pValue, df, significant:pValue<0.05, interpretation:pValue<0.05?"Perbedaan rata-rata signifikan secara statistik (p < 0.05)":"Tidak ada bukti cukup untuk perbedaan rata-rata (p ≥ 0.05)" };
}
function computeDescriptiveStats(values: number[]): DescriptiveStats {
  const valid=values.filter(v=>!isNaN(v));
  if(!valid.length) return {count:0,mean:0,median:0,min:0,max:0,std:0,skewness:0,kurtosis:0,q1:0,q3:0};
  return { count:valid.length, mean:mean(valid), median:median(valid), min:Math.min(...valid), max:Math.max(...valid), std:std(valid), skewness:skewness(valid), kurtosis:kurtosis(valid), q1:quantile(valid,0.25), q3:quantile(valid,0.75) };
}
function computeCorrelationMatrix(numericData: number[][], colNames: string[]): CorrelationMatrix {
  const k=colNames.length;
  const matrix=Array(k).fill(0).map(()=>Array(k).fill(0));
  const pValues=Array(k).fill(0).map(()=>Array(k).fill(0));
  for(let i=0;i<k;i++){
    matrix[i][i]=1;
    for(let j=i+1;j<k;j++){
      const c1=numericData.map(r=>r[i]), c2=numericData.map(r=>r[j]);
      const r=pearsonCorrelation(c1,c2), p=pearsonPValue(r,numericData.length);
      matrix[i][j]=matrix[j][i]=r; pValues[i][j]=pValues[j][i]=p;
    }
  }
  return {columns:colNames,matrix,pValues};
}
function parseCSV(text: string): DataRow[] {
  const lines=text.trim().split(/\r?\n/);
  const headers=lines[0].split(",").map(h=>h.trim().replace(/^"|"$/g,""));
  return lines.slice(1).map(line=>{
    const vals=line.split(",").map(v=>v.trim().replace(/^"|"$/g,""));
    const row:DataRow={};
    headers.forEach((h,i)=>{const n=parseFloat(vals[i]);row[h]=isNaN(n)?vals[i]:n;});
    return row;
  });
}
function detectColumnTypes(data: DataRow[]): Record<string,ColumnType> {
  if(!data.length) return {};
  const types:Record<string,ColumnType>={};
  for(const col of Object.keys(data[0])){
    const sample=data.slice(0,Math.min(100,data.length));
    types[col]=sample.every(r=>typeof r[col]==="number"&&!isNaN(r[col] as number))?"numeric":"categorical";
  }
  return types;
}
function getNumericColumns(data: DataRow[], types: Record<string,ColumnType>): string[] { return Object.keys(types).filter(c=>types[c]==="numeric"); }
function getCategoricalColumns(data: DataRow[], types: Record<string,ColumnType>): string[] { return Object.keys(types).filter(c=>types[c]==="categorical"); }
function extractNumericMatrix(data: DataRow[], numCols: string[]): number[][] { return data.map(r=>numCols.map(c=>r[c] as number)); }

/* ══════════════════════════════════════
   QUOTA EXCEEDED MODAL
══════════════════════════════════════ */
function QuotaModal({ used, limit, onClose, onUpgrade }: { used: number; limit: number; onClose: ()=>void; onUpgrade: ()=>void }) {
  return (
    <div style={ms.overlay}>
      <div style={ms.modal} className="quota-modal-in">
        <div style={ms.quotaIcon}>⚡</div>
        <h2 style={ms.quotaTitle}>Kuota Harian Habis</h2>
        <p style={ms.quotaDesc}>
          Kamu telah menggunakan <strong>{used}/{limit}</strong> analisis gratis hari ini.<br />
          Kuota akan direset besok, atau upgrade ke plan berbayar untuk akses tanpa batas.
        </p>
        <div style={ms.quotaBar}>
          <div style={{ ...ms.quotaFill, width: `${Math.min((used/limit)*100,100)}%` }} />
        </div>
        <p style={ms.quotaReset}>Reset otomatis: besok pukul 00.00</p>
        <div style={ms.modalBtns}>
          <button style={ms.btnUpgrade} onClick={onUpgrade}>
            🚀 Lihat Plan & Harga
          </button>
          <button style={ms.btnCancel} onClick={onClose}>
            Tutup
          </button>
        </div>
        <div style={ms.planHints}>
          <div style={ms.planHint}><span style={{ color:"#6366f1" }}>✓</span> Pro: 100 analisis/hari</div>
          <div style={ms.planHint}><span style={{ color:"#a855f7" }}>✓</span> Enterprise: Tak terbatas</div>
        </div>
      </div>
    </div>
  );
}

const ms: Record<string, React.CSSProperties> = {
  overlay:    { position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", backdropFilter:"blur(6px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 },
  modal:      { background:"#fff", borderRadius:20, padding:"36px 32px", maxWidth:420, width:"100%", boxShadow:"0 24px 80px rgba(0,0,0,0.2)", textAlign:"center" as const },
  quotaIcon:  { fontSize:48, marginBottom:12 },
  quotaTitle: { fontSize:22, fontWeight:800, color:"#1a1a2e", marginBottom:10, fontFamily:"'Outfit',sans-serif" },
  quotaDesc:  { fontSize:13.5, color:"#6b7280", lineHeight:1.7, marginBottom:20, fontFamily:"'Outfit',sans-serif" },
  quotaBar:   { height:8, background:"rgba(0,0,0,0.07)", borderRadius:99, overflow:"hidden", marginBottom:8 },
  quotaFill:  { height:"100%", background:"linear-gradient(90deg,#ef4444,#f59e0b)", borderRadius:99, transition:"width 0.6s ease" },
  quotaReset: { fontSize:11, color:"#9ca3af", fontFamily:"'DM Mono',monospace", marginBottom:24 },
  modalBtns:  { display:"flex", flexDirection:"column" as const, gap:10, marginBottom:20 },
  btnUpgrade: { padding:"14px 20px", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", border:"none", borderRadius:12, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'Outfit',sans-serif", boxShadow:"0 4px 14px rgba(99,102,241,0.35)" },
  btnCancel:  { padding:"11px 20px", background:"transparent", border:"1px solid rgba(0,0,0,0.1)", borderRadius:12, color:"#6b7280", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'Outfit',sans-serif" },
  planHints:  { display:"flex", justifyContent:"center", gap:24, borderTop:"1px solid rgba(0,0,0,0.07)", paddingTop:16 },
  planHint:   { fontSize:11.5, color:"#6b7280", fontFamily:"'DM Mono',monospace", display:"flex", alignItems:"center", gap:6 },
};

/* ══════════════════════════════════════
   SIDEBAR DRAWER (Mobile)
══════════════════════════════════════ */
function SidebarDrawer({ open, onClose, children }: { open: boolean; onClose: ()=>void; children: React.ReactNode }) {
  return (
    <>
      {open && <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:300, backdropFilter:"blur(2px)" }} onClick={onClose} />}
      <div style={{
        position:"fixed", top:0, left:0, bottom:0, width:300, background:"#f0f0ed",
        borderRight:"1px solid rgba(0,0,0,0.08)", zIndex:301, overflowY:"auto",
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition:"transform 0.3s cubic-bezier(.4,0,.2,1)",
        padding:"24px 20px",
      }}>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:8 }}>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#9ca3af", lineHeight:1 }}>✕</button>
        </div>
        {children}
      </div>
    </>
  );
}

/* ══════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════ */
export default function StatisticsPage() {
  const router = useRouter();

  /* ── Quota (server-side) ── */
  const { quota, consume } = useQuota();

  const fileRef      = useRef<HTMLInputElement>(null);
  const histogramRef = useRef<SVGSVGElement>(null);
  const heatmapRef   = useRef<SVGSVGElement>(null);
  const boxplotRef   = useRef<SVGSVGElement>(null);
  const dlMenuRef    = useRef<HTMLDivElement>(null);

  const [rawData,          setRawData]          = useState<DataRow[]>([]);
  const [columns,          setColumns]          = useState<string[]>([]);       // eslint-disable-line @typescript-eslint/no-unused-vars
  const [colTypes,         setColTypes]         = useState<Record<string,ColumnType>>({});  // eslint-disable-line @typescript-eslint/no-unused-vars
  const [numCols,          setNumCols]          = useState<string[]>([]);
  const [catCols,          setCatCols]          = useState<string[]>([]);
  const [fileName,         setFileName]         = useState("");
  const [dragging,         setDragging]         = useState(false);
  const [error,            setError]            = useState("");
  const [activeTab,        setActiveTab]        = useState<"deskriptif"|"distribusi"|"korelasi"|"ujistatistik">("deskriptif");
  const [selectedDistCol,  setSelectedDistCol]  = useState("");
  const [correlationMatrix,setCorrelationMatrix]= useState<CorrelationMatrix|null>(null);
  const [testType,         setTestType]         = useState<"pearson"|"ttest">("pearson");
  const [pearsonX,         setPearsonX]         = useState("");
  const [pearsonY,         setPearsonY]         = useState("");
  const [pearsonResult,    setPearsonResult]    = useState<PearsonResult|null>(null);
  const [ttestNumCol,      setTtestNumCol]      = useState("");
  const [ttestCatCol,      setTtestCatCol]      = useState("");
  const [ttestResult,      setTtestResult]      = useState<TTestResult|null>(null);
  const [descriptiveStats, setDescriptiveStats] = useState<Record<string,DescriptiveStats>>({});
  const [showDlMenu,       setShowDlMenu]       = useState(false);
  const [showQuotaModal,   setShowQuotaModal]   = useState(false);
  const [sidebarOpen,      setSidebarOpen]      = useState(false);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if(dlMenuRef.current && !dlMenuRef.current.contains(e.target as Node)) setShowDlMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const resetAnalysis = () => {
    setCorrelationMatrix(null); setPearsonResult(null); setTtestResult(null);
    setDescriptiveStats({}); setSelectedDistCol(""); setPearsonX(""); setPearsonY("");
    setTtestNumCol(""); setTtestCatCol("");
  };

  async function handleFile(file: File) {
    /* ── Cek & konsumsi quota via server ── */
    const allowed = await consume();
    if (!allowed) { setShowQuotaModal(true); return; }

    setError(""); resetAnalysis(); setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      let rows: DataRow[] = [];
      if (ext === "csv") {
        rows = parseCSV(await file.text());
      } else if (ext === "xlsx" || ext === "xls") {
        const XLSX = await import("xlsx");
        const buf  = await file.arrayBuffer();
        const wb   = XLSX.read(buf, { type:"array" });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as DataRow[];
      } else { setError("Format tidak didukung. Gunakan CSV atau XLSX."); return; }
      if (rows.length > 10000) { setError("Data terlalu besar (maks 10.000 baris)."); return; }
      if (!rows.length)        { setError("File kosong atau tidak dapat dibaca."); return; }

      setRawData(rows); setColumns(Object.keys(rows[0]));
      const types      = detectColumnTypes(rows); setColTypes(types);
      const numeric    = getNumericColumns(rows, types);
      const categorical = getCategoricalColumns(rows, types);
      setNumCols(numeric); setCatCols(categorical);
      if (!numeric.length) { setError("Tidak ada kolom numerik untuk analisis statistik."); return; }
      const matrix = extractNumericMatrix(rows, numeric);
      const statsMap: Record<string,DescriptiveStats> = {};
      numeric.forEach((col,idx) => { statsMap[col] = computeDescriptiveStats(matrix.map(r=>r[idx])); });
      setDescriptiveStats(statsMap);
      setSelectedDistCol(numeric[0]); setPearsonX(numeric[0]); setPearsonY(numeric[1]||numeric[0]);
      if (categorical.length && numeric.length) { setTtestNumCol(numeric[0]); setTtestCatCol(categorical[0]); }
      else if (numeric.length) setTtestNumCol(numeric[0]);
      setCorrelationMatrix(computeCorrelationMatrix(matrix, numeric));
    } catch(e) { setError("Gagal membaca file: "+(e as Error).message); }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quota]);

  const runPearsonTest = () => {
    if (!rawData.length || !pearsonX || !pearsonY) return;
    const vx = rawData.map(r=>r[pearsonX] as number).filter(v=>!isNaN(v));
    const vy = rawData.map(r=>r[pearsonY] as number).filter(v=>!isNaN(v));
    const n  = Math.min(vx.length, vy.length);
    if (n < 3) { setPearsonResult({correlation:0,pValue:1,significant:false,interpretation:"Data tidak cukup (n < 3)"}); return; }
    const r = pearsonCorrelation(vx.slice(0,n), vy.slice(0,n));
    const p = pearsonPValue(r, n);
    setPearsonResult({ correlation:r, pValue:p, significant:p<0.05, interpretation:p<0.05?`Korelasi ${r>0?"positif":"negatif"} signifikan (${Math.abs(r).toFixed(3)}), p=${p.toFixed(4)}`:`Tidak ada korelasi signifikan (r=${r.toFixed(3)}, p=${p.toFixed(4)})` });
  };

  const runTTest = () => {
    if (!rawData.length || !ttestNumCol || !ttestCatCol) return;
    const catVals = rawData.map(r=>String(r[ttestCatCol]));
    const uniq = [...new Set(catVals)];
    if (uniq.length !== 2) { setTtestResult({statistic:0,pValue:1,df:0,significant:false,interpretation:`Kolom kategorik harus memiliki tepat 2 kategori unik. Ditemukan ${uniq.length}.`}); return; }
    const g0 = rawData.filter((_,i)=>catVals[i]===uniq[0]).map(r=>r[ttestNumCol] as number).filter(v=>!isNaN(v));
    const g1 = rawData.filter((_,i)=>catVals[i]===uniq[1]).map(r=>r[ttestNumCol] as number).filter(v=>!isNaN(v));
    if (g0.length<2||g1.length<2) { setTtestResult({statistic:0,pValue:1,df:0,significant:false,interpretation:"Masing-masing grup minimal membutuhkan 2 data point."}); return; }
    setTtestResult(tTestIndependent(g0, g1));
  };

  useEffect(() => {
    if (rawData.length && pearsonX && pearsonY && activeTab==="ujistatistik" && testType==="pearson") runPearsonTest();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pearsonX, pearsonY, activeTab, testType, rawData]);

  useEffect(() => {
    if (rawData.length && ttestNumCol && ttestCatCol && activeTab==="ujistatistik" && testType==="ttest") runTTest();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttestNumCol, ttestCatCol, activeTab, testType, rawData]);

  /* D3 Histogram */
  useEffect(() => {
    if (!histogramRef.current || !rawData.length || !selectedDistCol || activeTab!=="distribusi") return;
    const values = rawData.map(r=>r[selectedDistCol] as number).filter(v=>!isNaN(v));
    if (!values.length) return;
    const svg = d3.select(histogramRef.current);
    const W = histogramRef.current.clientWidth || 680, H = 320;
    const margin = {top:20,right:20,bottom:50,left:55};
    svg.selectAll("*").remove(); svg.attr("viewBox",`0 0 ${W} ${H}`);
    const x = d3.scaleLinear().domain([d3.min(values)!*0.98,d3.max(values)!*1.02]).range([margin.left,W-margin.right]);
    const bins = d3.histogram().domain(x.domain() as [number,number]).thresholds(20)(values);
    const yMax = d3.max(bins,d=>d.length)||1;
    const y = d3.scaleLinear().domain([0,yMax*1.1]).range([H-margin.bottom,margin.top]);
    svg.append("g").attr("transform",`translate(0,${H-margin.bottom})`).call(d3.axisBottom(x).ticks(6)).selectAll("text").attr("fill","#9ca3af").attr("font-size","10").attr("font-family","'DM Mono',monospace");
    svg.append("g").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5)).selectAll("text").attr("fill","#9ca3af").attr("font-size","10").attr("font-family","'DM Mono',monospace");
    svg.selectAll(".domain").attr("stroke","rgba(0,0,0,0.12)"); svg.selectAll(".tick line").attr("stroke","rgba(0,0,0,0.08)");
    svg.selectAll("rect").data(bins).enter().append("rect").attr("x",d=>x(d.x0!)).attr("y",d=>y(d.length)).attr("width",d=>Math.max(0,x(d.x1!)-x(d.x0!)-1)).attr("height",d=>H-margin.bottom-y(d.length)).attr("fill","#6366f1").attr("opacity",0.7).attr("rx",2);
    svg.append("text").attr("x",W/2).attr("y",H-8).attr("text-anchor","middle").attr("fill","#6b7280").attr("font-size","11").attr("font-family","'DM Mono',monospace").text(selectedDistCol);
    svg.append("text").attr("transform","rotate(-90)").attr("x",-H/2).attr("y",16).attr("text-anchor","middle").attr("fill","#6b7280").attr("font-size","11").attr("font-family","'DM Mono',monospace").text("Frekuensi");
  }, [selectedDistCol, rawData, activeTab]);

  /* D3 Heatmap */
  useEffect(() => {
    if (!heatmapRef.current || !correlationMatrix || activeTab!=="korelasi") return;
    const {columns: cols, matrix} = correlationMatrix;
    const k = cols.length; if (!k) return;
    const svg = d3.select(heatmapRef.current);
    const W = Math.min(700, heatmapRef.current.clientWidth||700);
    const cellSize = Math.min(44, Math.floor((W-120)/k));
    const H = 40+k*cellSize;
    svg.selectAll("*").remove(); svg.attr("viewBox",`0 0 ${W} ${H}`).attr("width",W).attr("height",H);
    const margin={left:100,top:40,right:40,bottom:20};
    const x = d3.scaleBand().domain(cols).range([margin.left,margin.left+k*cellSize]).padding(0.05);
    const y = d3.scaleBand().domain(cols).range([margin.top,margin.top+k*cellSize]).padding(0.05);
    const colorScale = d3.scaleSequentialLog().domain([-1,1]).interpolator(t=>d3.interpolateRgb("#ef4444","#10b981")((t+1)/2));
    for(let i=0;i<k;i++) for(let j=0;j<k;j++){
      const corr=matrix[i][j];
      svg.append("rect").attr("x",x(cols[i])!).attr("y",y(cols[j])!).attr("width",x.bandwidth()).attr("height",y.bandwidth()).attr("fill",colorScale(corr)).attr("stroke","#fff").attr("stroke-width",1).attr("rx",3);
      svg.append("text").attr("x",x(cols[i])!+x.bandwidth()/2).attr("y",y(cols[j])!+y.bandwidth()/2).attr("text-anchor","middle").attr("dominant-baseline","middle").attr("fill",Math.abs(corr)>0.6?"#fff":"#1a1a2e").attr("font-size","9").attr("font-family","'DM Mono',monospace").text(corr.toFixed(2));
    }
    svg.append("g").attr("transform",`translate(${margin.left-5},0)`).call(d3.axisLeft(y).tickSize(0)).selectAll("text").attr("fill","#6b7280").attr("font-size","9").attr("font-family","'DM Mono',monospace");
    svg.append("g").attr("transform",`translate(0,${margin.top-5})`).call(d3.axisTop(x).tickSize(0)).selectAll("text").attr("transform","rotate(-45)").attr("text-anchor","start").attr("dx","0.5em").attr("dy","0.5em").attr("fill","#6b7280").attr("font-size","9").attr("font-family","'DM Mono',monospace");
  }, [correlationMatrix, activeTab]);

  /* D3 Boxplot */
  useEffect(() => {
    if (!boxplotRef.current || !rawData.length || !selectedDistCol || activeTab!=="distribusi") return;
    const values = rawData.map(r=>r[selectedDistCol] as number).filter(v=>!isNaN(v));
    if (!values.length) return;
    const stats = computeDescriptiveStats(values);
    const svg = d3.select(boxplotRef.current);
    const W = boxplotRef.current.clientWidth||680, H = 160;
    const margin={top:16,right:80,bottom:28,left:60};
    svg.selectAll("*").remove(); svg.attr("viewBox",`0 0 ${W} ${H}`);
    const yScale = d3.scaleLinear().domain([stats.min-(stats.max-stats.min)*0.05,stats.max+(stats.max-stats.min)*0.05]).range([H-margin.bottom,margin.top]);
    const boxX=margin.left, boxW=60;
    svg.append("rect").attr("x",boxX).attr("y",yScale(stats.q3)).attr("width",boxW).attr("height",yScale(stats.q1)-yScale(stats.q3)).attr("fill","rgba(99,102,241,0.15)").attr("stroke","#6366f1").attr("stroke-width",1.5).attr("rx",3);
    svg.append("line").attr("x1",boxX).attr("x2",boxX+boxW).attr("y1",yScale(stats.median)).attr("y2",yScale(stats.median)).attr("stroke","#f59e0b").attr("stroke-width",2);
    svg.append("line").attr("x1",boxX+boxW/2).attr("x2",boxX+boxW/2).attr("y1",yScale(stats.min)).attr("y2",yScale(stats.q1)).attr("stroke","#6366f1").attr("stroke-width",1.5);
    svg.append("line").attr("x1",boxX+boxW/2).attr("x2",boxX+boxW/2).attr("y1",yScale(stats.max)).attr("y2",yScale(stats.q3)).attr("stroke","#6366f1").attr("stroke-width",1.5);
    svg.append("line").attr("x1",boxX-5).attr("x2",boxX+boxW+5).attr("y1",yScale(stats.min)).attr("y2",yScale(stats.min)).attr("stroke","#6366f1").attr("stroke-width",1);
    svg.append("line").attr("x1",boxX-5).attr("x2",boxX+boxW+5).attr("y1",yScale(stats.max)).attr("y2",yScale(stats.max)).attr("stroke","#6366f1").attr("stroke-width",1);
    svg.append("g").attr("transform",`translate(0,${H-margin.bottom})`).call(d3.axisBottom(yScale).ticks(5)).selectAll("text").attr("fill","#9ca3af").attr("font-size","9").attr("font-family","'DM Mono',monospace");
    const notes=[`Min: ${stats.min.toFixed(2)}`,`Q1: ${stats.q1.toFixed(2)}`,`Median: ${stats.median.toFixed(2)}`,`Q3: ${stats.q3.toFixed(2)}`,`Max: ${stats.max.toFixed(2)}`];
    const ng=svg.append("g").attr("transform",`translate(${margin.left+boxW+15},${margin.top})`);
    notes.forEach((n,i)=>ng.append("text").attr("y",i*14).attr("fill","#6b7280").attr("font-size","9").attr("font-family","'DM Mono',monospace").text(n));
  }, [selectedDistCol, rawData, activeTab]);

  /* Download helpers */
  function triggerDownload(blob: Blob, name: string) { const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),10000); }
  function stripExt(name: string) { return name.replace(/\.[^/.]+$/,""); }
  function downloadDescriptiveCSV() {
    if (!numCols.length) return;
    const headers=["Variable","n","Mean","Median","Std","Min","Q1","Q3","Max","Skewness","Kurtosis"];
    const rows=numCols.map(col=>{const st=descriptiveStats[col];if(!st)return null;return [col,st.count,st.mean,st.median,st.std,st.min,st.q1,st.q3,st.max,st.skewness,st.kurtosis].join(",");}).filter(Boolean);
    triggerDownload(new Blob([[headers.join(","),...rows].join("\n")],{type:"text/csv"}),`${stripExt(fileName)}_descriptive_stats.csv`);
  }
  function downloadCorrelationCSV() {
    if (!correlationMatrix) return;
    const cols=correlationMatrix.columns;
    const rows=cols.map((v,i)=>[v,...correlationMatrix.matrix[i].map(x=>x.toFixed(4))].join(","));
    triggerDownload(new Blob([["Variable",...cols].join(",")+"\n"+rows.join("\n")],{type:"text/csv"}),`${stripExt(fileName)}_correlation_matrix.csv`);
  }
  function downloadTestResultsJSON() {
    const payload: Record<string,unknown> = { exported_at:new Date().toISOString(), source_file:fileName };
    if (testType==="pearson"&&pearsonResult) payload.test_result={type:"pearson",variables:{x:pearsonX,y:pearsonY},...pearsonResult};
    else if (testType==="ttest"&&ttestResult) payload.test_result={type:"independent_ttest",numeric:ttestNumCol,categorical:ttestCatCol,...ttestResult};
    else return;
    triggerDownload(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),`${stripExt(fileName)}_test_result.json`);
  }
  function downloadFullReportJSON() {
    if (!rawData.length) return;
    triggerDownload(new Blob([JSON.stringify({meta:{exported_at:new Date().toISOString(),source_file:fileName,total_rows:rawData.length,numeric_columns:numCols,categorical_columns:catCols},descriptive_stats:descriptiveStats,correlation_matrix:correlationMatrix?{columns:correlationMatrix.columns,matrix:correlationMatrix.matrix,p_values:correlationMatrix.pValues}:null},null,2)],{type:"application/json"}),`${stripExt(fileName)}_full_report.json`);
  }

  /* ── Sidebar content ── */
  const sidebarContent = (
    <>
      <div style={s.sideTop}>
        <button style={s.backBtn} onClick={()=>router.push("/")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Dashboard
        </button>
        <div style={s.sideTitle}><div style={s.sideDot}/><span>Statistik & EDA</span></div>
        <p style={s.sideDesc}>Analisis deskriptif, distribusi, korelasi, dan uji statistik.</p>
      </div>

      {/* Quota indicator — data dari server */}
      <div style={s.quotaWidget}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <span style={{ fontSize:10.5, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase" as const, color:"#9ca3af", fontFamily:"'DM Mono',monospace" }}>Kuota Hari Ini</span>
          <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color: !quota.allowed?"#ef4444":"#6b7280" }}>
            {quota.usedToday}/{quota.dailyLimit}
          </span>
        </div>
        <div style={{ height:5, background:"rgba(0,0,0,0.08)", borderRadius:99, overflow:"hidden" }}>
          <div style={{ height:"100%", borderRadius:99, background: !quota.allowed?"linear-gradient(90deg,#ef4444,#f59e0b)":"linear-gradient(90deg,#6366f1,#8b5cf6)", width:`${Math.min((quota.usedToday/quota.dailyLimit)*100,100)}%`, transition:"width 0.5s ease" }} />
        </div>
        {!quota.allowed && (
          <button style={s.quotaUpgradeBtn} onClick={()=>router.push("/pricing")}>Upgrade Plan →</button>
        )}
      </div>

      <div style={s.sideSection}>
        <label style={s.sideLabel}>Dataset</label>
        <div
          style={{...s.dropzone,...(dragging?s.dropzoneDrag:{})}}
          onDragOver={e=>{e.preventDefault();setDragging(true);}}
          onDragLeave={()=>setDragging(false)}
          onDrop={onDrop}
          onClick={()=>{ if(!quota.allowed){setShowQuotaModal(true);return;} fileRef.current?.click(); }}
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{display:"none"}} onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0])} />
          {fileName ? (
            <><div style={s.fileIcon}>📄</div><p style={s.fileName}>{fileName}</p><p style={s.fileRows}>{rawData.length} baris · {numCols.length} numerik · {catCols.length} kategorik</p></>
          ) : (
            <><div style={s.uploadIcon}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div><p style={s.dropText}>Drag & drop atau klik</p><p style={s.dropSub}>CSV · XLSX · XLS</p></>
          )}
        </div>
        {error && <p style={s.errMsg}>{error}</p>}
      </div>

      {rawData.length > 0 && (
        <div style={s.sideSection}>
          <label style={s.sideLabel}>Info Data</label>
          <div style={{fontSize:11,color:"#6b7280",fontFamily:"'DM Mono',monospace",lineHeight:1.6}}>
            <div>📊 Total baris: {rawData.length.toLocaleString()}</div>
            <div>🔢 Kolom numerik: {numCols.length}</div>
            <div>🏷️ Kolom kategorik: {catCols.length}</div>
          </div>
        </div>
      )}
      {rawData.length > 0 && numCols.length > 0 && (
        <div style={s.sideSection}>
          <label style={s.sideLabel}>Variabel Distribusi</label>
          <select style={s.select} value={selectedDistCol} onChange={e=>setSelectedDistCol(e.target.value)}>
            {numCols.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
      {rawData.length > 0 && activeTab === "ujistatistik" && (
        <div style={s.sideSection}>
          <label style={s.sideLabel}>Jenis Uji</label>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <button style={{...s.algoBtn,...(testType==="pearson"?s.algoBtnActive:{})}} onClick={()=>setTestType("pearson")}><div style={{...s.algoRadio,...(testType==="pearson"?s.algoRadioActive:{})}}/><span>Pearson</span></button>
            <button style={{...s.algoBtn,...(testType==="ttest"?s.algoBtnActive:{})}} onClick={()=>setTestType("ttest")}><div style={{...s.algoRadio,...(testType==="ttest"?s.algoRadioActive:{})}}/><span>Uji T</span></button>
          </div>
          {testType==="pearson"&&numCols.length>=2&&(<>
            <label style={s.sideLabel}>Variabel X</label>
            <select style={{...s.select,marginBottom:10}} value={pearsonX} onChange={e=>setPearsonX(e.target.value)}>{numCols.map(c=><option key={c} value={c}>{c}</option>)}</select>
            <label style={s.sideLabel}>Variabel Y</label>
            <select style={s.select} value={pearsonY} onChange={e=>setPearsonY(e.target.value)}>{numCols.map(c=><option key={c} value={c}>{c}</option>)}</select>
          </>)}
          {testType==="ttest"&&numCols.length>0&&catCols.length>0&&(<>
            <label style={s.sideLabel}>Numerik (Dependent)</label>
            <select style={{...s.select,marginBottom:10}} value={ttestNumCol} onChange={e=>setTtestNumCol(e.target.value)}>{numCols.map(c=><option key={c} value={c}>{c}</option>)}</select>
            <label style={s.sideLabel}>Kategorik (2 grup)</label>
            <select style={s.select} value={ttestCatCol} onChange={e=>setTtestCatCol(e.target.value)}>{catCols.map(c=><option key={c} value={c}>{c}</option>)}</select>
          </>)}
        </div>
      )}
    </>
  );

  return (
    <>
      <style>{CSS}</style>

      {showQuotaModal && (
        <QuotaModal
          used={quota.usedToday} limit={quota.dailyLimit}
          onClose={()=>setShowQuotaModal(false)}
          onUpgrade={()=>router.push("/pricing")}
        />
      )}

      <div style={s.shell}>
        <aside style={s.sidebar} className="desktop-sidebar">{sidebarContent}</aside>
        <SidebarDrawer open={sidebarOpen} onClose={()=>setSidebarOpen(false)}>{sidebarContent}</SidebarDrawer>

        <main style={s.main}>
          <div style={s.mainHeader}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <button className="mobile-menu-btn" style={s.mobileMenuBtn} onClick={()=>setSidebarOpen(true)} aria-label="Buka sidebar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
              <div>
                <h1 style={s.mainTitle}>Analisis Statistik & EDA</h1>
                <p style={s.mainSub}>{rawData.length?`${rawData.length} baris, ${numCols.length} numerik, ${catCols.length} kategorik`:"Upload dataset untuk memulai analisis"}</p>
              </div>
            </div>
            {rawData.length > 0 && (
              <div style={{position:"relative" as const}} ref={dlMenuRef}>
                <button style={s.dlBtn} className="dl-btn-hover" onClick={()=>setShowDlMenu(v=>!v)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span className="dl-btn-label">Unduh</span>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {showDlMenu && (
                  <div style={s.dlMenu}>
                    <p style={s.dlMenuTitle}>Pilih Format Unduhan</p>
                    {[
                      {icon:"📊",label:"Statistik Deskriptif",sub:"CSV · mean, median, skewness",disabled:!numCols.length,fn:downloadDescriptiveCSV},
                      {icon:"🔗",label:"Matriks Korelasi",sub:"CSV · koefisien Pearson",disabled:!correlationMatrix,fn:downloadCorrelationCSV},
                      {icon:"📐",label:"Hasil Uji Statistik",sub:"JSON · p-value, interpretasi",disabled:(testType==="pearson"&&!pearsonResult)||(testType==="ttest"&&!ttestResult),fn:downloadTestResultsJSON},
                      {icon:"📦",label:"Laporan Lengkap",sub:"JSON · semua hasil analisis",disabled:!rawData.length,fn:downloadFullReportJSON},
                    ].map(item=>(
                      <button key={item.label} style={{...s.dlMenuItem,...(item.disabled?s.dlMenuItemDisabled:{})}} className={item.disabled?"":"dl-item-hover"} onClick={item.disabled?undefined:item.fn} disabled={item.disabled}>
                        <span style={s.dlMenuIcon}>{item.icon}</span>
                        <span><span style={s.dlMenuLabel}>{item.label}</span><span style={s.dlMenuSub}>{item.sub}</span></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile quota bar */}
          <div className="mobile-quota-bar">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase" as const, color:"#9ca3af", fontFamily:"'DM Mono',monospace" }}>Kuota Hari Ini</span>
              <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:!quota.allowed?"#ef4444":"#6b7280" }}>{quota.usedToday}/{quota.dailyLimit}</span>
            </div>
            <div style={{ height:4, background:"rgba(0,0,0,0.08)", borderRadius:99, overflow:"hidden" }}>
              <div style={{ height:"100%", borderRadius:99, background:!quota.allowed?"linear-gradient(90deg,#ef4444,#f59e0b)":"linear-gradient(90deg,#6366f1,#8b5cf6)", width:`${Math.min((quota.usedToday/quota.dailyLimit)*100,100)}%` }} />
            </div>
          </div>

          {!rawData.length ? (
            <div style={s.emptyState}>
              <div style={s.emptyIcon}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <path d="M12 22V12"/><path d="M3.3 7L12 12l8.7-5"/>
                </svg>
              </div>
              <p style={s.emptyTitle}>Belum ada data</p>
              <p style={s.emptySub}>Upload file CSV atau Excel untuk memulai analisis statistik</p>
              <button className="mobile-upload-cta" style={s.mobileUploadCta} onClick={()=>setSidebarOpen(true)}>
                Upload Dataset
              </button>
            </div>
          ) : (
            <div style={s.resultsArea}>
              <div style={s.tabs} className="tabs-scroll">
                {(["deskriptif","distribusi","korelasi","ujistatistik"] as const).map(tab=>(
                  <button key={tab} style={{...s.tab,...(activeTab===tab?s.tabActive:{})}} onClick={()=>setActiveTab(tab)}>
                    {tab==="deskriptif"&&<>📋 <span className="tab-label">Deskriptif</span></>}
                    {tab==="distribusi"&&<>📊 <span className="tab-label">Distribusi</span></>}
                    {tab==="korelasi"&&<>🔗 <span className="tab-label">Korelasi</span></>}
                    {tab==="ujistatistik"&&<>📐 <span className="tab-label">Uji Statistik</span></>}
                  </button>
                ))}
              </div>

              {activeTab==="deskriptif"&&(
                <div style={s.statsWrap}>
                  <div style={{overflowX:"auto"}}>
                    <table style={s.table}>
                      <thead>
                        <tr>{["Variabel","n","Mean","Median","Std","Min","Q1","Q3","Max","Skewness","Kurtosis"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {numCols.map(col=>{
                          const st=descriptiveStats[col]; if(!st) return null;
                          return (
                            <tr key={col} style={s.tr} className="table-row">
                              <td style={{...s.td,fontWeight:600}}>{col}</td>
                              <td style={s.td}>{st.count}</td>
                              <td style={s.td}>{st.mean.toFixed(4)}</td>
                              <td style={s.td}>{st.median.toFixed(4)}</td>
                              <td style={s.td}>{st.std.toFixed(4)}</td>
                              <td style={s.td}>{st.min.toFixed(4)}</td>
                              <td style={s.td}>{st.q1.toFixed(4)}</td>
                              <td style={s.td}>{st.q3.toFixed(4)}</td>
                              <td style={s.td}>{st.max.toFixed(4)}</td>
                              <td style={{...s.td,color:Math.abs(st.skewness)>1?"#f59e0b":"#6b7280"}}>{st.skewness.toFixed(4)}</td>
                              <td style={s.td}>{st.kurtosis.toFixed(4)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{marginTop:16,fontSize:11,color:"#9ca3af",fontFamily:"'DM Mono',monospace",padding:"8px 14px",background:"rgba(0,0,0,0.02)",borderRadius:8}}>
                    📘 Skewness &gt; 1 = distribusi miring kanan, &lt; -1 = miring kiri.
                  </div>
                </div>
              )}

              {activeTab==="distribusi"&&(
                <div style={s.chartBox}>
                  <p style={{fontSize:12,color:"#6b7280",fontFamily:"'DM Mono',monospace",marginBottom:16}}>Histogram dan Boxplot untuk <strong>{selectedDistCol}</strong></p>
                  <svg ref={histogramRef} style={{width:"100%",height:320,marginBottom:24}}/>
                  <svg ref={boxplotRef} style={{width:"100%",height:160}}/>
                </div>
              )}

              {activeTab==="korelasi"&&(
                <div style={s.chartBox}>
                  {correlationMatrix&&correlationMatrix.columns.length>0?(
                    <>
                      <div style={{overflowX:"auto"}}><svg ref={heatmapRef} style={{minWidth:300,width:"100%"}}/></div>
                      <div style={{marginTop:24,fontSize:11,color:"#9ca3af",fontFamily:"'DM Mono',monospace",background:"rgba(0,0,0,0.02)",padding:"12px 16px",borderRadius:8}}>
                        ✅ Korelasi Pearson: nilai antara -1 (negatif sempurna) hingga +1 (positif sempurna).<br/>
                        🔵 Hijau = korelasi positif, merah = negatif.
                      </div>
                    </>
                  ):(
                    <div style={s.chartPlaceholder}>Tidak cukup kolom numerik untuk matriks korelasi.</div>
                  )}
                </div>
              )}

              {activeTab==="ujistatistik"&&(
                <div style={s.statsWrap}>
                  {testType==="pearson"&&pearsonResult&&(
                    <div style={s.testCard}>
                      <h3 style={s.testCardTitle}>Korelasi Pearson</h3>
                      <p style={s.testCardSub}>{pearsonX} ↔ {pearsonY}</p>
                      <div style={s.testGrid}>
                        <div><div style={s.metaLabel}>Koefisien (r)</div><div style={s.metaVal}>{pearsonResult.correlation.toFixed(4)}</div></div>
                        <div><div style={s.metaLabel}>p-value</div><div style={{...s.metaVal,color:pearsonResult.significant?"#10b981":"#f59e0b"}}>{pearsonResult.pValue.toExponential(4)}</div></div>
                        <div><div style={s.metaLabel}>Kesimpulan</div><div style={{fontSize:14,fontWeight:600,color:pearsonResult.significant?"#10b981":"#6b7280"}}>{pearsonResult.significant?"Signifikan":"Tidak Signifikan"}</div></div>
                      </div>
                      <div style={s.interpretBox}>📌 {pearsonResult.interpretation}</div>
                    </div>
                  )}
                  {testType==="ttest"&&ttestResult&&(
                    <div style={s.testCard}>
                      <h3 style={s.testCardTitle}>Uji T Independen (Welch)</h3>
                      <p style={s.testCardSub}>{ttestNumCol} berdasarkan {ttestCatCol}</p>
                      <div style={s.testGrid}>
                        <div><div style={s.metaLabel}>t-statistik</div><div style={s.metaVal}>{ttestResult.statistic.toFixed(4)}</div></div>
                        <div><div style={s.metaLabel}>df (Welch)</div><div style={{...s.metaVal,color:"#6b7280"}}>{ttestResult.df.toFixed(2)}</div></div>
                        <div><div style={s.metaLabel}>p-value</div><div style={{...s.metaVal,color:ttestResult.significant?"#10b981":"#f59e0b"}}>{ttestResult.pValue.toExponential(4)}</div></div>
                        <div><div style={s.metaLabel}>Kesimpulan</div><div style={{fontSize:14,fontWeight:600,color:ttestResult.significant?"#10b981":"#6b7280"}}>{ttestResult.significant?"Signifikan":"Tidak Signifikan"}</div></div>
                      </div>
                      <div style={s.interpretBox}>📌 {ttestResult.interpretation}</div>
                    </div>
                  )}
                  {testType==="pearson"&&(!pearsonX||!pearsonY)&&<div style={s.chartPlaceholder}>Pilih dua variabel numerik di sidebar.</div>}
                  {testType==="ttest"&&catCols.length===0&&<div style={s.chartPlaceholder}>Tidak ada kolom kategorik untuk uji T.</div>}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

/* ─── Styles ─── */
const s: Record<string, React.CSSProperties> = {
  shell:             { display:"flex", minHeight:"100vh", background:"#f8f8f6", fontFamily:"'Outfit',sans-serif", color:"#1a1a2e" },
  sidebar:           { width:288, minWidth:288, background:"#f0f0ed", borderRight:"1px solid rgba(0,0,0,0.07)", display:"flex", flexDirection:"column", padding:"24px 20px", overflowY:"auto" },
  sideTop:           { marginBottom:0 },
  backBtn:           { display:"flex", alignItems:"center", gap:6, fontSize:11.5, color:"#9ca3af", background:"none", border:"none", cursor:"pointer", fontFamily:"'Outfit',sans-serif", padding:0, marginBottom:20, fontWeight:500 },
  sideTitle:         { display:"flex", alignItems:"center", gap:8, fontSize:15, fontWeight:700, color:"#1a1a2e", marginBottom:6 },
  sideDot:           { width:8, height:8, borderRadius:"50%", background:"#6366f1" },
  sideDesc:          { fontSize:11.5, color:"#9ca3af", lineHeight:1.6, marginBottom:0 },
  sideSection:       { borderTop:"1px solid rgba(0,0,0,0.06)", paddingTop:16, marginTop:16 },
  sideLabel:         { display:"block", fontSize:10.5, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, color:"#9ca3af", marginBottom:10 },
  dropzone:          { border:"1.5px dashed rgba(0,0,0,0.14)", borderRadius:12, padding:"18px 12px", textAlign:"center" as const, cursor:"pointer", transition:"all 0.2s", background:"rgba(255,255,255,0.5)" },
  dropzoneDrag:      { borderColor:"#6366f1", background:"rgba(99,102,241,0.06)" },
  uploadIcon:        { width:40, height:40, borderRadius:"50%", background:"rgba(0,0,0,0.04)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px" },
  dropText:          { fontSize:12, fontWeight:600, color:"#6b7280", marginBottom:2 },
  dropSub:           { fontSize:10.5, color:"#9ca3af", fontFamily:"'DM Mono',monospace" },
  fileIcon:          { fontSize:22, marginBottom:6 },
  fileName:          { fontSize:11.5, fontWeight:600, color:"#1a1a2e", wordBreak:"break-all" as const, marginBottom:3 },
  fileRows:          { fontSize:10.5, color:"#9ca3af", fontFamily:"'DM Mono',monospace" },
  errMsg:            { fontSize:11, color:"#ef4444", marginTop:6, lineHeight:1.5 },
  select:            { width:"100%", padding:"7px 10px", background:"#fff", border:"1px solid rgba(0,0,0,0.1)", borderRadius:8, fontSize:12, color:"#1a1a2e", fontFamily:"'Outfit',sans-serif", outline:"none" },
  algoBtn:           { display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:"rgba(255,255,255,0.5)", border:"1px solid rgba(0,0,0,0.07)", borderRadius:10, cursor:"pointer", textAlign:"left" as const, transition:"all 0.2s", fontSize:11.5 },
  algoBtnActive:     { background:"rgba(99,102,241,0.07)", borderColor:"rgba(99,102,241,0.3)" },
  algoRadio:         { width:13, height:13, borderRadius:"50%", border:"2px solid rgba(0,0,0,0.2)", flexShrink:0, transition:"all 0.2s" },
  algoRadioActive:   { border:"4px solid #6366f1" },
  quotaWidget:       { marginTop:16, background:"rgba(255,255,255,0.5)", border:"1px solid rgba(0,0,0,0.07)", borderRadius:12, padding:"12px 14px" },
  quotaUpgradeBtn:   { marginTop:10, width:"100%", padding:"7px 0", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", border:"none", borderRadius:8, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"'Outfit',sans-serif" },
  main:              { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },
  mainHeader:        { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px 16px", borderBottom:"1px solid rgba(0,0,0,0.06)", flexWrap:"wrap" as const, gap:12 },
  mainTitle:         { fontSize:18, fontWeight:800, color:"#1a1a2e", marginBottom:2 },
  mainSub:           { fontSize:11, color:"#9ca3af", fontFamily:"'DM Mono',monospace" },
  mobileMenuBtn:     { display:"none", alignItems:"center", justifyContent:"center", width:36, height:36, background:"#fff", border:"1px solid rgba(0,0,0,0.1)", borderRadius:9, cursor:"pointer", flexShrink:0 },
  mobileUploadCta:   { display:"none" },
  emptyState:        { flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, padding:24 },
  emptyIcon:         { width:72, height:72, borderRadius:"50%", background:"rgba(0,0,0,0.04)", display:"flex", alignItems:"center", justifyContent:"center" },
  emptyTitle:        { fontSize:15, fontWeight:600, color:"#6b7280" },
  emptySub:          { fontSize:12, color:"#9ca3af", textAlign:"center" as const, maxWidth:280, lineHeight:1.6 },
  resultsArea:       { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },
  tabs:              { display:"flex", gap:0, borderBottom:"1px solid rgba(0,0,0,0.07)", padding:"0 24px" },
  tab:               { position:"relative" as const, padding:"11px 14px", fontSize:12, fontWeight:500, color:"#9ca3af", background:"none", border:"none", borderBottom:"2px solid transparent", cursor:"pointer", fontFamily:"'Outfit',sans-serif", transition:"all 0.2s", display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" as const },
  tabActive:         { color:"#6366f1", borderBottomColor:"#6366f1", fontWeight:700 },
  chartBox:          { flex:1, padding:"20px 24px", overflow:"auto" },
  chartPlaceholder:  { height:280, display:"flex", alignItems:"center", justifyContent:"center", border:"1.5px dashed rgba(0,0,0,0.1)", borderRadius:12, fontSize:13, color:"#9ca3af", textAlign:"center" as const, padding:24 },
  table:             { width:"100%", borderCollapse:"collapse" as const, fontSize:12 },
  th:                { padding:"9px 12px", textAlign:"left" as const, fontSize:10, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" as const, color:"#9ca3af", background:"#f8f8f6", borderBottom:"1px solid rgba(0,0,0,0.07)", whiteSpace:"nowrap" as const, fontFamily:"'DM Mono',monospace" },
  tr:                { borderBottom:"1px solid rgba(0,0,0,0.05)", transition:"background 0.15s" },
  td:                { padding:"8px 12px", color:"#374151", whiteSpace:"nowrap" as const, fontFamily:"'DM Mono',monospace", fontSize:11.5 },
  statsWrap:         { flex:1, overflow:"auto", padding:"20px 24px" },
  testCard:          { background:"#fff", border:"1px solid rgba(0,0,0,0.07)", borderRadius:16, padding:"22px 20px", marginBottom:20 },
  testCardTitle:     { fontSize:15, fontWeight:700, marginBottom:6, color:"#1a1a2e" },
  testCardSub:       { fontSize:12, color:"#6b7280", marginBottom:18 },
  testGrid:          { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:14, marginBottom:18 },
  metaLabel:         { fontSize:10.5, color:"#9ca3af", fontFamily:"'DM Mono',monospace", marginBottom:4 },
  metaVal:           { fontSize:24, fontWeight:800, color:"#6366f1", lineHeight:1 },
  interpretBox:      { padding:"10px 14px", background:"rgba(99,102,241,0.05)", borderRadius:10, fontSize:12, lineHeight:1.6 },
  dlBtn:             { display:"flex", alignItems:"center", gap:6, padding:"8px 12px", background:"#1a1a2e", border:"none", borderRadius:10, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Outfit',sans-serif", transition:"all 0.2s", whiteSpace:"nowrap" as const, boxShadow:"0 2px 8px rgba(26,26,46,0.18)" },
  dlMenu:            { position:"absolute" as const, top:"calc(100% + 8px)", right:0, width:268, background:"#fff", border:"1px solid rgba(0,0,0,0.09)", borderRadius:14, boxShadow:"0 8px 32px rgba(0,0,0,0.13)", zIndex:200, padding:"10px 8px" },
  dlMenuTitle:       { fontSize:9.5, fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase" as const, color:"#9ca3af", fontFamily:"'DM Mono',monospace", padding:"4px 10px 8px", borderBottom:"1px solid rgba(0,0,0,0.06)", marginBottom:4 },
  dlMenuItem:        { display:"flex", alignItems:"center", gap:10, width:"100%", padding:"9px 10px", background:"none", border:"none", borderRadius:9, cursor:"pointer", textAlign:"left" as const, transition:"background 0.15s" },
  dlMenuItemDisabled:{ opacity:0.38, cursor:"not-allowed" },
  dlMenuIcon:        { fontSize:18, lineHeight:1, flexShrink:0 },
  dlMenuLabel:       { display:"block", fontSize:12.5, fontWeight:600, color:"#1a1a2e", marginBottom:1 },
  dlMenuSub:         { display:"block", fontSize:10, color:"#9ca3af", fontFamily:"'DM Mono',monospace" },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700;800&display=swap');
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes quotaModalIn { from { opacity:0; transform:scale(0.92) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .quota-modal-in { animation: quotaModalIn 0.3s cubic-bezier(.34,1.56,.64,1) both; }
  .table-row:hover { background: rgba(99,102,241,0.03) !important; }
  .dl-btn-hover:hover { filter: brightness(1.15); transform: translateY(-1px); }
  .dl-item-hover:hover { background: rgba(99,102,241,0.05) !important; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width:5px; height:5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius:10px; }
  select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239ca3af'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 8px center; padding-right: 24px !important; }
  .mobile-quota-bar { display: none; }
  @media (max-width: 768px) {
    .desktop-sidebar { display: none !important; }
    .mobile-menu-btn { display: flex !important; }
    .mobile-quota-bar { display: block !important; padding: 10px 20px; background: rgba(240,240,237,0.6); border-bottom: 1px solid rgba(0,0,0,0.06); }
    .mobile-upload-cta { display: block !important; margin-top: 4px; padding: 12px 24px; background: linear-gradient(135deg,#6366f1,#8b5cf6); border: none; border-radius: 12px; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Outfit', sans-serif; }
    .tabs-scroll { overflow-x: auto !important; padding: 0 16px !important; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
    .tabs-scroll::-webkit-scrollbar { display: none; }
    .tab-label { display: inline; }
    .dl-btn-label { display: none; }
  }
  @media (max-width: 400px) { .tab-label { display: none; } }
`;