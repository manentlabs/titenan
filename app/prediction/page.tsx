"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";

/* ═══════════════════════════════════════════════════════════════
   QUOTA
═══════════════════════════════════════════════════════════════ */
type QuotaStatus = {
  allowed: boolean;
  usedToday: number;
  dailyLimit: number;
  remaining: number;
  role: string;
  resetAt: string;
};

const QUOTA_FALLBACK: QuotaStatus = {
  allowed: true,
  usedToday: 0,
  dailyLimit: 3,
  remaining: 3,
  role: "free",
  resetAt: "",
};

function useQuota() {
  const [quota, setQuota] = useState<QuotaStatus>(QUOTA_FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/quota")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setQuota(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const consume = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/quota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "file_analysis" }),
      });
      const data = await res.json();
      if (res.status === 429 || data.error === "QUOTA_EXCEEDED") {
        setQuota((prev) => ({ ...prev, ...data, allowed: false }));
        return false;
      }
      if (!res.ok) return false;
      setQuota(data);
      return true;
    } catch {
      return true;
    }
  }, []);

  return { quota, loading, consume };
}

function QuotaModal({ used, limit, onClose, onUpgrade }: { used: number; limit: number; onClose: () => void; onUpgrade: () => void }) {
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
          <div style={{ ...ms.quotaFill, width: `${Math.min((used / limit) * 100, 100)}%` }} />
        </div>
        <p style={ms.quotaReset}>Reset otomatis: besok pukul 00.00</p>
        <div style={ms.modalBtns}>
          <button style={ms.btnUpgrade} onClick={onUpgrade}>🚀 Lihat Plan & Harga</button>
          <button style={ms.btnCancel} onClick={onClose}>Tutup</button>
        </div>
        <div style={ms.planHints}>
          <div style={ms.planHint}><span style={{ color: "#6366f1" }}>✓</span> Pro: 100 analisis/hari</div>
          <div style={ms.planHint}><span style={{ color: "#a855f7" }}>✓</span> Enterprise: Tak terbatas</div>
        </div>
      </div>
    </div>
  );
}

const ms: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { background: "#fff", borderRadius: 20, padding: "36px 32px", maxWidth: 420, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.2)", textAlign: "center" as const },
  quotaIcon: { fontSize: 48, marginBottom: 12 },
  quotaTitle: { fontSize: 22, fontWeight: 800, color: "#1a1a2e", marginBottom: 10, fontFamily: "'Outfit',sans-serif" },
  quotaDesc: { fontSize: 13.5, color: "#6b7280", lineHeight: 1.7, marginBottom: 20, fontFamily: "'Outfit',sans-serif" },
  quotaBar: { height: 8, background: "rgba(0,0,0,0.07)", borderRadius: 99, overflow: "hidden", marginBottom: 8 },
  quotaFill: { height: "100%", background: "linear-gradient(90deg,#ef4444,#f59e0b)", borderRadius: 99, transition: "width 0.6s ease" },
  quotaReset: { fontSize: 11, color: "#9ca3af", fontFamily: "'DM Mono',monospace", marginBottom: 24 },
  modalBtns: { display: "flex", flexDirection: "column" as const, gap: 10, marginBottom: 20 },
  btnUpgrade: { padding: "14px 20px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit',sans-serif", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" },
  btnCancel: { padding: "11px 20px", background: "transparent", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 12, color: "#6b7280", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Outfit',sans-serif" },
  planHints: { display: "flex", justifyContent: "center", gap: 24, borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 16 },
  planHint: { fontSize: 11.5, color: "#6b7280", fontFamily: "'DM Mono',monospace", display: "flex", alignItems: "center", gap: 6 },
};

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR DRAWER
═══════════════════════════════════════════════════════════════ */
function SidebarDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      {open && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, backdropFilter: "blur(2px)" }} onClick={onClose} />}
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: 300, background: "#f0f0ed",
        borderRight: "1px solid rgba(0,0,0,0.08)", zIndex: 301, overflowY: "auto",
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s cubic-bezier(.4,0,.2,1)",
        padding: "24px 20px",
      }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af", lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */
type ModelType = "regression" | "lstm" | "timeseries";
type DataRow = Record<string, number | string>;

type PredictionResult = {
  predictions: number[];
  actuals: number[];
  trainIndices: number[];
  testIndices: number[];
  metrics: { mae: number; rmse: number; r2: number };
  modelInfo: { type: ModelType; params: Record<string, any>; trainingTime?: number };
  lookback?: number;
  forecastSteps?: number[];
  forecastValues?: number[];
};

/* ═══════════════════════════════════════════════════════════════
   MATH UTILITIES — safe, no infinite loops
═══════════════════════════════════════════════════════════════ */
function matTranspose(m: number[][]): number[][] {
  if (!m.length || !m[0].length) return [];
  return m[0].map((_, i) => m.map((row) => row[i]));
}

function matMultiply(A: number[][], B: number[][]): number[][] {
  const rows = A.length, cols = B[0].length, inner = B.length;
  const result: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++)
    for (let k = 0; k < inner; k++)
      if (A[i][k] !== 0)
        for (let j = 0; j < cols; j++)
          result[i][j] += A[i][k] * B[k][j];
  return result;
}

/** Gauss-Jordan inverse — returns null if singular */
function matInverse(m: number[][]): number[][] | null {
  const n = m.length;
  const aug = m.map((row, i) => {
    const eye = new Array(n).fill(0);
    eye[i] = 1;
    return [...row, ...eye];
  });
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(aug[r][col]) > Math.abs(aug[maxRow][col])) maxRow = r;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-10) return null; // singular

    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      for (let j = 0; j < 2 * n; j++) aug[r][j] -= factor * aug[col][j];
    }
  }
  return aug.map((row) => row.slice(n));
}

/* ═══════════════════════════════════════════════════════════════
   REGRESSION — Multiple Linear Regression (safe OLS)
═══════════════════════════════════════════════════════════════ */
function linearRegression(
  X_train: number[][],
  y_train: number[],
  X_test: number[][]
): { predictions: number[]; coef: number[]; intercept: number } {
  // Add bias column
  const X = X_train.map((row) => [1, ...row]);
  const Xt = matTranspose(X);
  const XtX = matMultiply(Xt, X);
  const XtX_inv = matInverse(XtX);

  if (!XtX_inv) {
    // Fallback: return mean prediction if matrix is singular
    const mean = y_train.reduce((a, b) => a + b, 0) / y_train.length;
    return { predictions: X_test.map(() => mean), coef: [], intercept: mean };
  }

  const XtY = matMultiply(Xt, y_train.map((v) => [v]));
  const theta = matMultiply(XtX_inv, XtY).map((row) => row[0]);
  const intercept = theta[0];
  const coef = theta.slice(1);

  const predictions = X_test.map((row) =>
    [1, ...row].reduce((sum, val, i) => sum + val * theta[i], 0)
  );

  return { predictions, coef, intercept };
}

/* ═══════════════════════════════════════════════════════════════
   LSTM — runs in Web Worker to avoid UI freeze
═══════════════════════════════════════════════════════════════ */
const LSTM_WORKER_CODE = `
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js');

self.onmessage = async function(e) {
  const { X_train, y_train, X_test, epochs, learningRate, lookback, features } = e.data;

  try {
    const inputShape = [lookback, features];
    const model = tf.sequential();
    model.add(tf.layers.lstm({ units: 32, returnSequences: false, inputShape }));
    model.add(tf.layers.dropout({ rate: 0.1 }));
    model.add(tf.layers.dense({ units: 1 }));
    model.compile({ optimizer: tf.train.adam(learningRate), loss: 'meanSquaredError' });

    const xs = tf.tensor3d(X_train);
    const ys = tf.tensor1d(y_train);

    await model.fit(xs, ys, {
      epochs,
      batchSize: Math.min(32, Math.floor(X_train.length / 4) || 1),
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          self.postMessage({ type: 'progress', epoch, loss: logs?.loss || 0 });
        }
      },
      verbose: 0,
    });

    xs.dispose(); ys.dispose();

    const testXs = tf.tensor3d(X_test);
    const predTensor = model.predict(testXs);
    const predictions = Array.from(await predTensor.data()).slice(0, X_test.length);
    testXs.dispose(); predTensor.dispose();

    self.postMessage({ type: 'done', predictions });
  } catch(err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
`;

function createLSTMWorker(): Worker {
  const blob = new Blob([LSTM_WORKER_CODE], { type: "application/javascript" });
  return new Worker(URL.createObjectURL(blob));
}

/* ═══════════════════════════════════════════════════════════════
   TIME SERIES — Holt-Winters (fixed seasonal indexing)
═══════════════════════════════════════════════════════════════ */
function holtWinters(
  data: number[],
  seasonality: number,
  alpha: number,
  beta: number,
  gamma: number,
  forecastHorizon: number
): { fitted: number[]; forecast: number[] } {
  const n = data.length;
  if (n < seasonality * 2) {
    // Not enough data — fallback to simple exponential smoothing
    const fitted: number[] = [data[0]];
    let level = data[0];
    for (let t = 1; t < n; t++) {
      level = alpha * data[t] + (1 - alpha) * level;
      fitted.push(level);
    }
    return { fitted, forecast: new Array(forecastHorizon).fill(level) };
  }

  // Init: level = mean of first season, trend = avg change, seasonal = deviations
  const level: number[] = new Array(n);
  const trend: number[] = new Array(n);
  const seasonal: number[] = new Array(n + forecastHorizon);

  // Initial level: mean of first season
  level[0] = data.slice(0, seasonality).reduce((a, b) => a + b, 0) / seasonality;
  // Initial trend: average of (season2 - season1) / seasonality
  const s2 = data.slice(seasonality, seasonality * 2).reduce((a, b) => a + b, 0) / seasonality;
  trend[0] = (s2 - level[0]) / seasonality;
  // Initial seasonal indices
  for (let i = 0; i < seasonality; i++) {
    seasonal[i] = data[i] - level[0];
  }

  const fitted: number[] = new Array(n).fill(0);
  fitted[0] = level[0] + trend[0] + seasonal[0];

  for (let t = 1; t < n; t++) {
    const prevSeasIdx = t - seasonality;
    const prevSeas = prevSeasIdx >= 0 ? seasonal[prevSeasIdx] : 0;
    const prevLevel = level[t - 1];
    const prevTrend = trend[t - 1];

    level[t] = alpha * (data[t] - prevSeas) + (1 - alpha) * (prevLevel + prevTrend);
    trend[t] = beta * (level[t] - prevLevel) + (1 - beta) * prevTrend;
    seasonal[t] = gamma * (data[t] - level[t]) + (1 - gamma) * prevSeas;
    fitted[t] = level[t] + trend[t] + seasonal[t];
  }

  const forecast: number[] = [];
  const lastLevel = level[n - 1];
  const lastTrend = trend[n - 1];

  for (let h = 1; h <= forecastHorizon; h++) {
    // Correct seasonal index: look back into the fitted seasonal array
    const sIdx = n - seasonality + ((h - 1) % seasonality);
    const seas = sIdx >= 0 && sIdx < n ? seasonal[sIdx] : 0;
    forecast.push(lastLevel + h * lastTrend + seas);
  }

  return { fitted, forecast };
}

/* ═══════════════════════════════════════════════════════════════
   METRICS & DATA PREP
═══════════════════════════════════════════════════════════════ */
function computeMetrics(actual: number[], predicted: number[]): { mae: number; rmse: number; r2: number } {
  const n = actual.length;
  if (!n) return { mae: 0, rmse: 0, r2: 0 };
  const mae = actual.reduce((sum, a, i) => sum + Math.abs(a - predicted[i]), 0) / n;
  const rmse = Math.sqrt(actual.reduce((sum, a, i) => sum + (a - predicted[i]) ** 2, 0) / n);
  const meanActual = actual.reduce((a, b) => a + b, 0) / n;
  const ssRes = actual.reduce((sum, a, i) => sum + (a - predicted[i]) ** 2, 0);
  const ssTot = actual.reduce((sum, a) => sum + (a - meanActual) ** 2, 0);
  const r2 = ssTot < 1e-10 ? 0 : 1 - ssRes / ssTot;
  return { mae, rmse, r2: isNaN(r2) || !isFinite(r2) ? 0 : Math.max(-1, Math.min(1, r2)) };
}

function prepareRegressionData(data: DataRow[], featureCols: string[], targetCol: string, testRatio: number) {
  const n = data.length;
  // Deterministic split (no shuffle to keep reproducibility and avoid NaN from numeric issues)
  const split = Math.floor(n * (1 - testRatio));
  const trainIdx = Array.from({ length: split }, (_, i) => i);
  const testIdx = Array.from({ length: n - split }, (_, i) => split + i);

  const toNum = (v: any) => (typeof v === "number" && isFinite(v) ? v : 0);

  const X_train = trainIdx.map((i) => featureCols.map((c) => toNum(data[i][c])));
  const y_train = trainIdx.map((i) => toNum(data[i][targetCol]));
  const X_test = testIdx.map((i) => featureCols.map((c) => toNum(data[i][c])));
  const y_test = testIdx.map((i) => toNum(data[i][targetCol]));
  return { X_train, y_train, X_test, y_test, trainIdx, testIdx };
}

function prepareTimeSeriesData(data: DataRow[], targetCol: string, dateCol: string | null, lookback: number, testRatio: number) {
  let sortedData = [...data];
  if (dateCol) {
    sortedData.sort((a, b) => new Date(String(a[dateCol])).getTime() - new Date(String(b[dateCol])).getTime());
  }
  const toNum = (v: any) => (typeof v === "number" && isFinite(v) ? v : 0);
  const values = sortedData.map((row) => toNum(row[targetCol]));
  const n = values.length;
  const split = Math.floor(n * (1 - testRatio));

  const X_train: number[][][] = [];
  const y_train: number[] = [];
  for (let i = lookback; i < split; i++) {
    X_train.push(values.slice(i - lookback, i).map((v) => [v]));
    y_train.push(values[i]);
  }

  const X_test: number[][][] = [];
  const y_test: number[] = [];
  for (let i = lookback; i < n; i++) {
    if (i >= split) {
      X_test.push(values.slice(i - lookback, i).map((v) => [v]));
      y_test.push(values[i]);
    }
  }

  const trainIdx = Array.from({ length: X_train.length }, (_, i) => i + lookback);
  const testIdx = Array.from({ length: X_test.length }, (_, i) => split + i);
  return { X_train, y_train, X_test, y_test, trainIdx, testIdx, originalValues: values };
}

/* ═══════════════════════════════════════════════════════════════
   DOWNLOAD HELPERS
═══════════════════════════════════════════════════════════════ */
function stripExt(name: string) { return name.replace(/\.[^/.]+$/, ""); }
function triggerDownload(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
function downloadCSV(data: DataRow[], columns: string[], result: PredictionResult, fileName: string, targetCol: string) {
  const headers = ["index", "split", "actual", "predicted", ...columns];
  const rows = data.map((row, i) => {
    const isTest = result.testIndices.includes(i);
    const actual = isTest ? result.actuals[result.testIndices.indexOf(i)] : undefined;
    const pred = isTest ? result.predictions[result.testIndices.indexOf(i)] : undefined;
    const values = [i, isTest ? "test" : "train", actual ?? "", pred ?? "", ...columns.map((c) => row[c])];
    return values.join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  triggerDownload(new Blob([csv], { type: "text/csv" }), `${stripExt(fileName)}_predictions.csv`);
}
function downloadJSON(data: DataRow[], columns: string[], result: PredictionResult, fileName: string, modelType: ModelType, params: any) {
  const payload = {
    meta: { exported_at: new Date().toISOString(), source_file: fileName, model_type: modelType, parameters: params },
    metrics: result.metrics,
    predictions: result.predictions,
    actuals: result.actuals,
    train_test_split: { train_count: result.trainIndices.length, test_count: result.testIndices.length },
    forecast: result.forecastSteps ? { steps: result.forecastSteps, values: result.forecastValues } : undefined,
  };
  triggerDownload(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `${stripExt(fileName)}_prediction.json`);
}
function downloadPNG(svgEl: SVGSVGElement, fileName: string) {
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  const scale = 2;
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = (svgEl.clientWidth || 800) * scale;
    canvas.height = (svgEl.clientHeight || 400) * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f8f8f6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => blob && triggerDownload(blob, `${stripExt(fileName)}_plot.png`), "image/png");
  };
  img.src = url;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function PredictionPage() {
  const router = useRouter();
  const { quota, consume } = useQuota();
  const fileRef = useRef<HTMLInputElement>(null);
  const plotRef = useRef<SVGSVGElement>(null);
  const dlMenuRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);

  const [rawData, setRawData] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [numCols, setNumCols] = useState<string[]>([]);
  const [targetCol, setTargetCol] = useState("");
  const [featureCols, setFeatureCols] = useState<string[]>([]);
  const [dateCol, setDateCol] = useState<string | null>(null);
  const [modelType, setModelType] = useState<ModelType>("regression");
  const [testRatio, setTestRatio] = useState(0.2);
  const [lookback, setLookback] = useState(5);
  const [forecastHorizon, setForecastHorizon] = useState(10);
  const [lstmEpochs, setLstmEpochs] = useState(30);
  const [lstmLR, setLstmLR] = useState(0.01);
  const [hwAlpha, setHwAlpha] = useState(0.3);
  const [hwBeta, setHwBeta] = useState(0.2);
  const [hwGamma, setHwGamma] = useState(0.1);
  const [hwSeasonality, setHwSeasonality] = useState(7);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [running, setRunning] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState<{ epoch: number; loss: number } | null>(null);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"plot" | "table" | "insight">("plot");
  const [showDlMenu, setShowDlMenu] = useState(false);
  const [insight, setInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState("");
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Cleanup worker on unmount
  useEffect(() => {
    return () => { workerRef.current?.terminate(); };
  }, []);

  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (dlMenuRef.current && !dlMenuRef.current.contains(e.target as Node)) setShowDlMenu(false);
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, []);

  async function handleFile(file: File) {
    setError(""); setResult(null); setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      let rows: DataRow[] = [];
      if (ext === "csv") {
        const text = await file.text();
        rows = parseCSV(text);
      } else if (ext === "xlsx" || ext === "xls") {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as DataRow[];
      } else {
        setError("Format tidak didukung. Gunakan CSV atau XLSX.");
        return;
      }
      if (!rows.length) throw new Error("File kosong");
      const cols = Object.keys(rows[0]);
      const nums = cols.filter((c) => rows.slice(0, 20).every((r) => {
        const v = r[c];
        return typeof v === "number" && isFinite(v);
      }));
      if (nums.length < 1) throw new Error("Minimal 1 kolom numerik untuk target");

      const allowed = await consume();
      if (!allowed) { setShowQuotaModal(true); return; }

      setRawData(rows);
      setColumns(cols);
      setNumCols(nums);
      setTargetCol(nums[0]);
      setFeatureCols(nums.slice(1, Math.min(5, nums.length)));
      const dateCandidates = cols.filter((c) => c.toLowerCase().includes("date") || c.toLowerCase().includes("time"));
      if (dateCandidates.length) setDateCol(dateCandidates[0]);
    } catch (e) {
      setError("Gagal membaca file: " + (e as Error).message);
    }
  }

  function parseCSV(text: string): DataRow[] {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).filter((l) => l.trim()).map((line) => {
      const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: DataRow = {};
      headers.forEach((h, i) => {
        const n = parseFloat(vals[i]);
        row[h] = isNaN(n) ? vals[i] : n;
      });
      return row;
    });
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [consume]);

  function cancelRun() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
    setTrainingProgress(null);
  }

  async function runPrediction() {
    if (!rawData.length || !targetCol) return;
    if (modelType === "regression" && featureCols.length === 0) {
      setError("Pilih minimal 1 kolom fitur untuk regresi");
      return;
    }
    setRunning(true);
    setResult(null);
    setTrainingProgress(null);
    setError("");
    const startTime = performance.now();

    try {
      if (modelType === "regression") {
        // ── Sync but fast ──
        const { X_train, y_train, X_test, y_test, trainIdx, testIdx } = prepareRegressionData(rawData, featureCols, targetCol, testRatio);
        const { predictions } = linearRegression(X_train, y_train, X_test);
        const metrics = computeMetrics(y_test, predictions);
        const res: PredictionResult = {
          predictions, actuals: y_test, trainIndices: trainIdx, testIndices: testIdx, metrics,
          modelInfo: { type: "regression", params: { features: featureCols, testRatio }, trainingTime: performance.now() - startTime },
        };
        setResult(res);
        setActiveTab("plot");
        generateInsight(res);

      } else if (modelType === "lstm") {
        // ── Runs in Web Worker so UI stays responsive ──
        const { X_train, y_train, X_test, y_test, trainIdx, testIdx } = prepareTimeSeriesData(rawData, targetCol, dateCol, lookback, testRatio);
        if (X_train.length < 4) throw new Error("Data tidak cukup untuk LSTM. Kurangi lookback atau tambah data.");

        // Kill previous worker if any
        workerRef.current?.terminate();
        const worker = createLSTMWorker();
        workerRef.current = worker;

        const predictions = await new Promise<number[]>((resolve, reject) => {
          worker.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === "progress") setTrainingProgress({ epoch: msg.epoch, loss: msg.loss });
            else if (msg.type === "done") resolve(msg.predictions);
            else if (msg.type === "error") reject(new Error(msg.message));
          };
          worker.onerror = (err) => reject(new Error(err.message));
          worker.postMessage({
            X_train, y_train, X_test,
            epochs: lstmEpochs,
            learningRate: lstmLR,
            lookback,
            features: X_train[0][0].length,
          });
        });

        workerRef.current = null;
        const metrics = computeMetrics(y_test, predictions);
        const res: PredictionResult = {
          predictions, actuals: y_test, trainIndices: trainIdx, testIndices: testIdx, metrics,
          lookback,
          modelInfo: { type: "lstm", params: { lookback, epochs: lstmEpochs, learningRate: lstmLR, testRatio }, trainingTime: performance.now() - startTime },
        };
        setResult(res);
        setActiveTab("plot");
        generateInsight(res);

      } else if (modelType === "timeseries") {
        const toNum = (v: any) => (typeof v === "number" && isFinite(v) ? v : 0);
        const values = rawData.map((row) => toNum(row[targetCol]));
        const split = Math.floor(values.length * (1 - testRatio));
        const trainVals = values.slice(0, split);
        const testVals = values.slice(split);

        if (trainVals.length < hwSeasonality * 2) {
          throw new Error(`Butuh minimal ${hwSeasonality * 2} data latih. Turunkan seasonality atau testRatio.`);
        }

        const { forecast: testForecast } = holtWinters(trainVals, hwSeasonality, hwAlpha, hwBeta, hwGamma, testVals.length);
        const metrics = computeMetrics(testVals, testForecast);

        const { forecast: futureForecast } = holtWinters(values, hwSeasonality, hwAlpha, hwBeta, hwGamma, forecastHorizon);

        const trainIdx = Array.from({ length: split }, (_, i) => i);
        const testIdx = Array.from({ length: testVals.length }, (_, i) => split + i);

        const res: PredictionResult = {
          predictions: testForecast,
          actuals: testVals,
          trainIndices: trainIdx,
          testIndices: testIdx,
          metrics,
          forecastSteps: Array.from({ length: forecastHorizon }, (_, i) => split + testVals.length + i),
          forecastValues: futureForecast,
          modelInfo: { type: "timeseries", params: { alpha: hwAlpha, beta: hwBeta, gamma: hwGamma, seasonality: hwSeasonality, forecastHorizon }, trainingTime: performance.now() - startTime },
        };
        setResult(res);
        setActiveTab("plot");
        generateInsight(res);
      }
    } catch (e) {
      setError("Error: " + (e as Error).message);
    }
    setRunning(false);
    setTrainingProgress(null);
  }

  async function generateInsight(res: PredictionResult) {
    setInsight(""); setInsightError(""); setInsightLoading(true);
    try {
      const response = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "prediction",
          result: {
            model_type: res.modelInfo.type,
            metrics: res.metrics,
            num_samples: res.actuals.length,
            params: res.modelInfo.params,
          },
        }),
      });
      if (!response.ok) throw new Error("Gagal generate insight");
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Stream tidak tersedia");
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setInsight((prev) => prev + decoder.decode(value));
      }
    } catch (err: any) {
      setInsightError(err.message);
    } finally {
      setInsightLoading(false);
    }
  }

  // ── D3 Chart (cleanup on every render) ──
  useEffect(() => {
    if (!result || !plotRef.current || activeTab !== "plot") return;

    const svgEl = plotRef.current;
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const width = svgEl.clientWidth || 800;
    const height = 400;
    const margin = { top: 24, right: 72, bottom: 50, left: 64 };

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    // Build series
    const actualPts: { x: number; y: number }[] = [
      ...result.trainIndices.map((i) => ({ x: i, y: rawData[i]?.[targetCol] as number ?? 0 })),
      ...result.testIndices.map((idx, i) => ({ x: idx, y: result.actuals[i] })),
    ].sort((a, b) => a.x - b.x);

    const predPts = result.testIndices
      .map((idx, i) => ({ x: idx, y: result.predictions[i] }))
      .sort((a, b) => a.x - b.x);

    const forecastPts = (result.forecastSteps || [])
      .map((x, i) => ({ x, y: result.forecastValues![i] }));

    const allX = [...actualPts, ...predPts, ...forecastPts].map((d) => d.x);
    const allY = [...actualPts, ...predPts, ...forecastPts].map((d) => d.y).filter(isFinite);

    if (!allX.length || !allY.length) return;

    const xExt = d3.extent(allX) as [number, number];
    const yExt = d3.extent(allY) as [number, number];
    const yPad = (yExt[1] - yExt[0]) * 0.08 || 1;

    const xScale = d3.scaleLinear().domain(xExt).range([margin.left, width - margin.right]);
    const yScale = d3.scaleLinear().domain([yExt[0] - yPad, yExt[1] + yPad]).range([height - margin.bottom, margin.top]);

    // Grid
    svg.append("g")
      .attr("stroke", "rgba(0,0,0,0.05)")
      .call(g => g.selectAll("line").data(yScale.ticks(5)).join("line")
        .attr("x1", margin.left).attr("x2", width - margin.right)
        .attr("y1", d => yScale(d)).attr("y2", d => yScale(d)));

    // Axes
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(6))
      .call(g => g.select(".domain").attr("stroke", "rgba(0,0,0,0.15)"))
      .call(g => g.selectAll("text").style("font-size", "10px").style("font-family", "'DM Mono',monospace"));

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(5))
      .call(g => g.select(".domain").attr("stroke", "rgba(0,0,0,0.15)"))
      .call(g => g.selectAll("text").style("font-size", "10px").style("font-family", "'DM Mono',monospace"));

    const line = d3.line<{ x: number; y: number }>()
      .defined((d) => isFinite(d.y))
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.y));

    // Actual line
    svg.append("path").datum(actualPts).attr("fill", "none").attr("stroke", "#6366f1").attr("stroke-width", 2).attr("d", line);

    // Prediction line
    svg.append("path").datum(predPts).attr("fill", "none").attr("stroke", "#f59e0b").attr("stroke-width", 2).attr("stroke-dasharray", "6,4").attr("d", line);

    // Forecast line
    if (forecastPts.length) {
      // Connect last actual/pred point to first forecast
      const connectPt = predPts[predPts.length - 1] || actualPts[actualPts.length - 1];
      const connectedForecast = connectPt ? [connectPt, ...forecastPts] : forecastPts;
      svg.append("path").datum(connectedForecast).attr("fill", "none").attr("stroke", "#ef4444").attr("stroke-width", 2).attr("stroke-dasharray", "3,4").attr("d", line);
    }

    // Train/test divider
    if (result.testIndices.length) {
      const divX = xScale(result.testIndices[0]);
      svg.append("line")
        .attr("x1", divX).attr("x2", divX)
        .attr("y1", margin.top).attr("y2", height - margin.bottom)
        .attr("stroke", "rgba(0,0,0,0.15)").attr("stroke-dasharray", "4,4").attr("stroke-width", 1);
      svg.append("text").attr("x", divX + 4).attr("y", margin.top + 12)
        .text("test →").style("font-size", "9px").style("fill", "#9ca3af").style("font-family", "'DM Mono',monospace");
    }

    // Legend
    const legendData = [
      { label: "Aktual", color: "#6366f1", dash: "none" },
      { label: "Prediksi", color: "#f59e0b", dash: "6,4" },
      ...(forecastPts.length ? [{ label: "Forecast", color: "#ef4444", dash: "3,4" }] : []),
    ];

    const legend = svg.append("g").attr("transform", `translate(${margin.left + 8},${margin.top + 4})`);
    legendData.forEach((item, i) => {
      const g = legend.append("g").attr("transform", `translate(${i * 90},0)`);
      g.append("line").attr("x1", 0).attr("x2", 18).attr("y1", 5).attr("y2", 5)
        .attr("stroke", item.color).attr("stroke-width", 2)
        .attr("stroke-dasharray", item.dash === "none" ? null : item.dash);
      g.append("text").attr("x", 22).attr("y", 9).text(item.label)
        .style("font-size", "10px").style("fill", "#6b7280").style("font-family", "'Outfit',sans-serif");
    });

    return () => { svg.selectAll("*").remove(); };
  }, [result, activeTab, rawData, targetCol]);

  const pagedData = rawData.slice(0, 100);
  const dlItems = [
    { label: "Data + Prediksi (CSV)", sub: "Semua baris dengan actual/predicted", icon: "📊", action: () => result && downloadCSV(rawData, columns, result, fileName, targetCol), disabled: !result },
    { label: "Hasil Lengkap (JSON)", sub: "Metrik, parameter, prediksi", icon: "📋", action: () => result && downloadJSON(rawData, columns, result, fileName, modelType, result.modelInfo.params), disabled: !result },
    { label: "Plot (PNG)", sub: "Grafik aktual vs prediksi", icon: "🖼️", action: () => plotRef.current && downloadPNG(plotRef.current, fileName), disabled: !result || activeTab !== "plot" },
  ];

  const sidebarContent = (
    <>
      <div style={s.sideTop}>
        <button style={s.backBtn} onClick={() => router.push("/")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
          Dashboard
        </button>
        <div style={s.sideTitle}><div style={s.sideDot} /><span>Prediction</span></div>
        <p style={s.sideDesc}>Regresi, LSTM, dan Time Series Forecasting</p>
      </div>

      <div style={s.quotaWidgetDesktop}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af" }}>Kuota Hari Ini</span>
          <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: !quota.allowed ? "#ef4444" : "#6b7280" }}>{quota.usedToday}/{quota.dailyLimit}</span>
        </div>
        <div style={{ height: 5, background: "rgba(0,0,0,0.08)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 99, background: !quota.allowed ? "linear-gradient(90deg,#ef4444,#f59e0b)" : "linear-gradient(90deg,#6366f1,#8b5cf6)", width: `${Math.min((quota.usedToday / quota.dailyLimit) * 100, 100)}%` }} />
        </div>
        {!quota.allowed && <button style={s.quotaUpgradeBtn} onClick={() => router.push("/pricing")}>Upgrade Plan →</button>}
      </div>

      <div style={s.sideSection}>
        <label style={s.sideLabel}>Dataset</label>
        <div
          style={{ ...s.dropzone, ...(dragging ? s.dropzoneDrag : {}) }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {fileName ? (
            <>
              <div style={s.fileIcon}>📄</div>
              <p style={s.fileName}>{fileName}</p>
              <p style={s.fileRows}>{rawData.length} baris</p>
            </>
          ) : (
            <>
              <div style={s.uploadIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p style={s.dropText}>Drag & drop atau klik</p>
              <p style={s.dropSub}>CSV · XLSX · XLS</p>
            </>
          )}
        </div>
        {error && <p style={s.errMsg}>{error}</p>}
      </div>

      {rawData.length > 0 && (
        <>
          <div style={s.sideSection}>
            <label style={s.sideLabel}>Target & Fitur</label>
            <select style={s.select} value={targetCol} onChange={(e) => setTargetCol(e.target.value)}>
              {numCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {modelType === "regression" && (
              <>
                <p style={{ marginTop: 8, marginBottom: 4, fontSize: 10, color: "#9ca3af" }}>Fitur (X)</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {numCols.filter((c) => c !== targetCol).map((c) => (
                    <label key={c} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, cursor: "pointer" }}>
                      <input type="checkbox" checked={featureCols.includes(c)} onChange={(e) => {
                        if (e.target.checked) setFeatureCols([...featureCols, c]);
                        else setFeatureCols(featureCols.filter((f) => f !== c));
                      }} /> {c}
                    </label>
                  ))}
                </div>
              </>
            )}
            {(modelType === "lstm" || modelType === "timeseries") && (
              <div style={{ marginTop: 8 }}>
                <label style={s.miniLabel}>Kolom Tanggal (opsional)</label>
                <select style={s.select} value={dateCol || ""} onChange={(e) => setDateCol(e.target.value || null)}>
                  <option value="">(urutan baris)</option>
                  {columns.filter((c) => c.toLowerCase().includes("date") || c.toLowerCase().includes("time")).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>

          <div style={s.sideSection}>
            <label style={s.sideLabel}>Model</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(["regression", "lstm", "timeseries"] as const).map((m) => (
                <button key={m} style={{ ...s.algoBtn, ...(modelType === m ? s.algoBtnActive : {}) }} onClick={() => setModelType(m)}>
                  <div style={{ ...s.algoRadio, ...(modelType === m ? s.algoRadioActive : {}) }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{m === "regression" ? "Linear Regression" : m === "lstm" ? "LSTM (Deep Learning)" : "Time Series (Holt-Winters)"}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>{m === "regression" ? "Multiple linear OLS" : m === "lstm" ? "TF.js – berjalan di background" : "Exponential smoothing"}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div style={s.sideSection}>
            <label style={s.sideLabel}>Parameter</label>
            <div style={s.paramRow}>
              <span style={s.paramLabel}>Test split</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="range" min={0.1} max={0.4} step={0.05} value={testRatio} onChange={(e) => setTestRatio(+e.target.value)} style={{ flex: 1, accentColor: "#6366f1" }} />
                <span style={s.paramVal}>{Math.round(testRatio * 100)}%</span>
              </div>
            </div>
            {(modelType === "lstm" || modelType === "timeseries") && (
              <div style={s.paramRow}>
                <span style={s.paramLabel}>Lookback window</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" min={2} max={20} value={lookback} onChange={(e) => setLookback(+e.target.value)} style={{ flex: 1, accentColor: "#6366f1" }} />
                  <span style={s.paramVal}>{lookback}</span>
                </div>
              </div>
            )}
            {modelType === "lstm" && (
              <>
                <div style={s.paramRow}>
                  <span style={s.paramLabel}>Epochs (lebih kecil = lebih cepat)</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="range" min={5} max={100} step={5} value={lstmEpochs} onChange={(e) => setLstmEpochs(+e.target.value)} style={{ flex: 1, accentColor: "#6366f1" }} />
                    <span style={s.paramVal}>{lstmEpochs}</span>
                  </div>
                </div>
                <div style={s.paramRow}>
                  <span style={s.paramLabel}>Learning rate</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="range" min={0.001} max={0.05} step={0.001} value={lstmLR} onChange={(e) => setLstmLR(+e.target.value)} style={{ flex: 1, accentColor: "#6366f1" }} />
                    <span style={s.paramVal}>{lstmLR.toFixed(3)}</span>
                  </div>
                </div>
              </>
            )}
            {modelType === "timeseries" && (
              <>
                <div style={s.paramRow}>
                  <span style={s.paramLabel}>Seasonality</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="range" min={2} max={30} value={hwSeasonality} onChange={(e) => setHwSeasonality(+e.target.value)} style={{ flex: 1, accentColor: "#6366f1" }} />
                    <span style={s.paramVal}>{hwSeasonality}</span>
                  </div>
                </div>
                <div style={s.paramRow}>
                  <span style={s.paramLabel}>Forecast horizon</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="range" min={1} max={60} value={forecastHorizon} onChange={(e) => setForecastHorizon(+e.target.value)} style={{ flex: 1, accentColor: "#6366f1" }} />
                    <span style={s.paramVal}>{forecastHorizon}</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[["Alpha", hwAlpha, setHwAlpha], ["Beta", hwBeta, setHwBeta], ["Gamma", hwGamma, setHwGamma]].map(([label, val, setter]: any) => (
                    <div key={label}>
                      <span style={s.paramLabel}>{label}</span>
                      <input type="range" min={0.01} max={0.99} step={0.01} value={val}
                        onChange={(e) => setter(+e.target.value)} style={{ width: "100%", accentColor: "#6366f1" }} />
                      <span style={{ ...s.paramVal, display: "block", textAlign: "center" }}>{val.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button style={{ ...s.runBtn, ...(running ? s.runBtnDisabled : {}), flex: 1 }} onClick={runPrediction} disabled={running}>
              {running
                ? <><div style={s.miniSpinner} />{trainingProgress ? `Epoch ${trainingProgress.epoch + 1}/${lstmEpochs} · loss ${trainingProgress.loss.toFixed(4)}` : "Memproses..."}</>
                : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>Jalankan Prediksi</>}
            </button>
            {running && modelType === "lstm" && (
              <button style={s.cancelBtn} onClick={cancelRun} title="Batalkan training">✕</button>
            )}
          </div>
        </>
      )}
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      {showQuotaModal && <QuotaModal used={quota.usedToday} limit={quota.dailyLimit} onClose={() => setShowQuotaModal(false)} onUpgrade={() => router.push("/pricing")} />}

      <div style={s.shell}>
        <aside className="desktop-sidebar" style={s.sidebar}>{sidebarContent}</aside>
        <SidebarDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>{sidebarContent}</SidebarDrawer>

        <main style={s.main}>
          <div style={s.mainHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button className="mobile-menu-btn" style={s.mobileMenuBtn} onClick={() => setSidebarOpen(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <div>
                <h1 style={s.mainTitle}>Prediksi & Forecasting</h1>
                <p style={s.mainSub}>
                  {result
                    ? `${result.modelInfo.type} · MAE ${result.metrics.mae.toFixed(4)} · RMSE ${result.metrics.rmse.toFixed(4)} · R² ${result.metrics.r2.toFixed(4)} · ${((result.modelInfo.trainingTime || 0) / 1000).toFixed(1)}s`
                    : "Upload data dan pilih model"}
                </p>
              </div>
            </div>
            {result && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {[
                  { label: "MAE", val: result.metrics.mae.toFixed(4), color: "#6366f1" },
                  { label: "RMSE", val: result.metrics.rmse.toFixed(4), color: "#a855f7" },
                  { label: "R²", val: result.metrics.r2.toFixed(4), color: "#10b981" },
                ].map((m) => (
                  <div key={m.label} style={s.metricCard}>
                    <div style={s.metricLabel}>{m.label}</div>
                    <div style={{ ...s.metricVal, color: m.color }}>{m.val}</div>
                  </div>
                ))}
                <div style={{ position: "relative" }} ref={dlMenuRef}>
                  <button style={s.dlBtn} onClick={() => setShowDlMenu((v) => !v)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Unduh
                  </button>
                  {showDlMenu && (
                    <div style={s.dlMenu}>
                      <p style={s.dlMenuTitle}>Pilih Format</p>
                      {dlItems.map((item) => (
                        <button key={item.label} style={{ ...s.dlMenuItem, ...(item.disabled ? s.dlMenuItemDisabled : {}) }} onClick={item.action} disabled={item.disabled}>
                          <span style={s.dlMenuIcon}>{item.icon}</span>
                          <span><span style={s.dlMenuLabel}>{item.label}</span><span style={s.dlMenuSub}>{item.sub}</span></span>
                        </button>
                      ))}
                      <div style={s.dlMenuNote}>PNG hanya tersedia setelah tab Plot aktif</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile quota bar */}
          <div className="mobile-quota-bar" style={s.mobileQuotaBarDesktop}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Kuota Hari Ini</span>
              <span style={{ fontSize: 10, fontFamily: "'DM Mono',monospace" }}>{quota.usedToday}/{quota.dailyLimit}</span>
            </div>
            <div style={{ height: 4, background: "rgba(0,0,0,0.08)", borderRadius: 99 }}>
              <div style={{ height: "100%", borderRadius: 99, background: !quota.allowed ? "linear-gradient(90deg,#ef4444,#f59e0b)" : "linear-gradient(90deg,#6366f1,#8b5cf6)", width: `${Math.min((quota.usedToday / quota.dailyLimit) * 100, 100)}%` }} />
            </div>
          </div>

          {!rawData.length ? (
            <div style={s.emptyState}>
              <div style={s.emptyIcon}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.2">
                  <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
                </svg>
              </div>
              <p style={s.emptyTitle}>Belum ada data</p>
              <p style={s.emptySub}>Upload file CSV/Excel untuk memulai prediksi</p>
              <button className="mobile-upload-cta" style={s.mobileUploadCta} onClick={() => setSidebarOpen(true)}>Upload Dataset</button>
            </div>
          ) : (
            <div style={s.resultsArea}>
              <div style={s.tabs} className="tabs-scroll">
                {(["plot", "table", "insight"] as const).map((tab) => (
                  <button key={tab} style={{ ...s.tab, ...(activeTab === tab ? s.tabActive : {}) }} onClick={() => setActiveTab(tab)}>
                    {tab === "plot" ? "📈 Plot" : tab === "table" ? "📋 Data & Prediksi" : "✨ AI Insight"}
                  </button>
                ))}
              </div>

              {activeTab === "plot" && (
                <div style={s.chartBox}>
                  {!result
                    ? <div style={s.chartPlaceholder}>Jalankan prediksi untuk melihat grafik</div>
                    : <svg ref={plotRef} style={{ width: "100%", height: 400 }} />}
                </div>
              )}

              {activeTab === "table" && (
                <div style={s.tableWrap}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={s.th}>#</th>
                          <th style={s.th}>Split</th>
                          <th style={s.th}>Actual</th>
                          {result && <th style={s.th}>Predicted</th>}
                          {columns.map((c) => <th key={c} style={s.th}>{c}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {pagedData.map((row, i) => {
                          const isTest = result?.testIndices.includes(i);
                          const actual = isTest ? result?.actuals[result.testIndices.indexOf(i)] : undefined;
                          const pred = isTest ? result?.predictions[result.testIndices.indexOf(i)] : undefined;
                          return (
                            <tr key={i} style={s.tr} className="table-row">
                              <td style={s.tdNum}>{i}</td>
                              <td style={{ ...s.td, color: isTest ? "#f59e0b" : "#9ca3af" }}>{isTest ? "test" : "train"}</td>
                              <td style={s.td}>{actual !== undefined ? actual.toFixed(4) : String(row[targetCol]).slice(0, 12)}</td>
                              {result && <td style={{ ...s.td, color: pred !== undefined ? "#6366f1" : "#d1d5db" }}>{pred !== undefined ? pred.toFixed(4) : "—"}</td>}
                              {columns.map((c) => <td key={c} style={s.td}>{String(row[c]).slice(0, 30)}</td>)}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {rawData.length > 100 && <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", padding: "12px 0", fontFamily: "'DM Mono',monospace" }}>Menampilkan 100 dari {rawData.length} baris</p>}
                  </div>
                </div>
              )}

              {activeTab === "insight" && (
                <div style={s.statsWrap}>
                  {!result
                    ? <p style={{ textAlign: "center", padding: 32, color: "#9ca3af" }}>Jalankan prediksi terlebih dahulu</p>
                    : (
                      <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid rgba(0,0,0,0.07)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Analisis Naratif AI</h3>
                          <button style={s.analyzeBtn} onClick={() => generateInsight(result)} disabled={insightLoading}>
                            {insightLoading ? "Sedang Berpikir..." : "🔄 Generate Ulang"}
                          </button>
                        </div>
                        {insightLoading && !insight && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#9ca3af", fontSize: 13, padding: "20px 0" }}>
                            <div style={s.miniSpinnerDark} /> Menganalisis hasil model...
                          </div>
                        )}
                        {insightError && <div style={{ ...s.errMsg, background: "#fef2f2", padding: 12, borderRadius: 8, marginBottom: 12 }}>⚠️ {insightError}</div>}
                        <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap", color: "#374151" }}>
                          {insight || (!insightLoading && "Klik tombol di atas untuk analisis mendalam.")}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════ */
const s: Record<string, React.CSSProperties> = {
  shell: { display: "flex", minHeight: "100vh", background: "#f8f8f6", fontFamily: "'Outfit',sans-serif", color: "#1a1a2e" },
  sidebar: { width: 288, minWidth: 288, background: "#f0f0ed", borderRight: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", padding: "24px 20px", overflowY: "auto" },
  sideTop: { marginBottom: 20 },
  backBtn: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", marginBottom: 20, fontWeight: 500 },
  sideTitle: { display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, marginBottom: 6 },
  sideDot: { width: 8, height: 8, borderRadius: "50%", background: "#6366f1" },
  sideDesc: { fontSize: 11.5, color: "#9ca3af", lineHeight: 1.6 },
  quotaWidgetDesktop: { background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 },
  quotaUpgradeBtn: { marginTop: 10, width: "100%", padding: "7px 0", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  sideSection: { borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 16, marginTop: 16 },
  sideLabel: { display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 10 },
  dropzone: { border: "1.5px dashed rgba(0,0,0,0.14)", borderRadius: 12, padding: "20px 12px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: "rgba(255,255,255,0.5)" },
  dropzoneDrag: { borderColor: "#6366f1", background: "rgba(99,102,241,0.06)" },
  uploadIcon: { width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" },
  dropText: { fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 2 },
  dropSub: { fontSize: 10.5, color: "#9ca3af", fontFamily: "'DM Mono',monospace" },
  fileIcon: { fontSize: 24, marginBottom: 6 },
  fileName: { fontSize: 11.5, fontWeight: 600, wordBreak: "break-all", marginBottom: 3 },
  fileRows: { fontSize: 10.5, color: "#9ca3af", fontFamily: "'DM Mono',monospace" },
  errMsg: { fontSize: 11, color: "#ef4444", marginTop: 6, lineHeight: 1.5 },
  miniLabel: { fontSize: 10, color: "#9ca3af", marginBottom: 4, display: "block", fontFamily: "'DM Mono',monospace" },
  select: { width: "100%", padding: "7px 10px", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, fontSize: 12, fontFamily: "'Outfit',sans-serif", outline: "none" },
  algoBtn: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, cursor: "pointer", textAlign: "left", width: "100%" },
  algoBtnActive: { background: "rgba(99,102,241,0.07)", borderColor: "rgba(99,102,241,0.3)" },
  algoRadio: { width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", flexShrink: 0 },
  algoRadioActive: { border: "4px solid #6366f1" },
  paramRow: { marginBottom: 12 },
  paramLabel: { fontSize: 11, color: "#6b7280", marginBottom: 5, display: "block" },
  paramVal: { fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 600, color: "#6366f1", minWidth: 44, textAlign: "right" },
  runBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 0", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(99,102,241,0.3)" },
  runBtnDisabled: { opacity: 0.6, cursor: "not-allowed", boxShadow: "none" },
  cancelBtn: { padding: "0 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "#ef4444", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  miniSpinner: { width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 },
  miniSpinnerDark: { width: 14, height: 14, border: "2px solid rgba(0,0,0,0.1)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 },
  mainHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexWrap: "wrap", gap: 12 },
  mainTitle: { fontSize: 18, fontWeight: 800, marginBottom: 2 },
  mainSub: { fontSize: 11, color: "#9ca3af", fontFamily: "'DM Mono',monospace" },
  mobileMenuBtn: { display: "none", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 9, cursor: "pointer", flexShrink: 0 },
  mobileQuotaBarDesktop: { display: "none", padding: "10px 20px", background: "rgba(240,240,237,0.6)", borderBottom: "1px solid rgba(0,0,0,0.06)" },
  mobileUploadCta: { display: "none" },
  emptyState: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyIcon: { width: 72, height: 72, borderRadius: "50%", background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: "#6b7280" },
  emptySub: { fontSize: 12, color: "#9ca3af", textAlign: "center", maxWidth: 320, lineHeight: 1.6 },
  resultsArea: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  tabs: { display: "flex", borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "0 24px", overflowX: "auto", whiteSpace: "nowrap" as const },
  tab: { padding: "11px 14px", fontSize: 12, fontWeight: 500, color: "#9ca3af", background: "none", border: "none", borderBottom: "2px solid transparent", cursor: "pointer", fontFamily: "'Outfit',sans-serif", display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 },
  tabActive: { color: "#6366f1", borderBottomColor: "#6366f1", fontWeight: 700 },
  chartBox: { flex: 1, padding: "20px 24px", overflow: "auto" },
  chartPlaceholder: { height: 400, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px dashed rgba(0,0,0,0.1)", borderRadius: 12, fontSize: 13, color: "#9ca3af" },
  tableWrap: { flex: 1, overflow: "auto", padding: "20px 24px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: { padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9ca3af", background: "#f8f8f6", borderBottom: "1px solid rgba(0,0,0,0.07)", whiteSpace: "nowrap", fontFamily: "'DM Mono',monospace" },
  tr: { borderBottom: "1px solid rgba(0,0,0,0.05)" },
  td: { padding: "8px 12px", color: "#374151", whiteSpace: "nowrap", fontFamily: "'DM Mono',monospace", fontSize: 11.5 },
  tdNum: { padding: "8px 12px", color: "#d1d5db", fontFamily: "'DM Mono',monospace", fontSize: 11.5 },
  statsWrap: { flex: 1, overflow: "auto", padding: "20px 24px" },
  metricCard: { background: "#fff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, padding: "8px 14px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" },
  metricLabel: { fontSize: 9.5, fontFamily: "'DM Mono',monospace", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 },
  metricVal: { fontSize: 17, fontWeight: 700 },
  dlBtn: { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#1a1a2e", border: "none", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(26,26,46,0.18)" },
  dlMenu: { position: "absolute", top: "calc(100% + 8px)", right: 0, width: 272, background: "#fff", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.13)", zIndex: 200, padding: "10px 8px" },
  dlMenuTitle: { fontSize: 9.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#9ca3af", fontFamily: "'DM Mono',monospace", padding: "4px 10px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)", marginBottom: 4 },
  dlMenuItem: { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", background: "none", border: "none", borderRadius: 9, cursor: "pointer", textAlign: "left" },
  dlMenuItemDisabled: { opacity: 0.38, cursor: "not-allowed" },
  dlMenuIcon: { fontSize: 18, lineHeight: 1, flexShrink: 0 },
  dlMenuLabel: { display: "block", fontSize: 12.5, fontWeight: 600, color: "#1a1a2e", marginBottom: 1 },
  dlMenuSub: { display: "block", fontSize: 10, color: "#9ca3af", fontFamily: "'DM Mono',monospace" },
  dlMenuNote: { fontSize: 9.5, color: "#c4b5a0", fontFamily: "'DM Mono',monospace", padding: "8px 10px 2px", lineHeight: 1.5, borderTop: "1px solid rgba(0,0,0,0.05)", marginTop: 4 },
  analyzeBtn: { display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", background: "rgba(99,102,241,0.1)", border: "1.5px solid rgba(99,102,241,0.3)", borderRadius: 9, color: "#6366f1", fontSize: 12, fontWeight: 600, cursor: "pointer" },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700;800&display=swap');
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes quotaModalIn { from { opacity:0; transform:scale(0.92) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .quota-modal-in { animation: quotaModalIn 0.3s cubic-bezier(.34,1.56,.64,1) both; }
  .table-row:hover { background: rgba(99,102,241,0.03) !important; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 10px; }
  select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239ca3af'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 8px center; padding-right: 24px !important; }
  @media (max-width: 768px) {
    .desktop-sidebar { display: none !important; }
    .mobile-menu-btn { display: flex !important; }
    .mobile-quota-bar { display: block !important; }
    .mobile-upload-cta { display: block !important; margin-top: 8px; padding: 12px 20px; background: linear-gradient(135deg,#6366f1,#8b5cf6); border: none; border-radius: 12px; color: #fff; font-weight: 700; cursor: pointer; font-family: 'Outfit',sans-serif; }
    .tabs-scroll { -webkit-overflow-scrolling: touch; scrollbar-width: none; }
    .tabs-scroll::-webkit-scrollbar { display: none; }
  }
`;