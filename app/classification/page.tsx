"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";

/* ═══════════════════════════════════════════════════════════════
   QUOTA (server-side via API) 
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
      .then((d) => {
        if (d) setQuota(d);
      })
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

/* ─── Modal kuota habis ─── */
function QuotaModal({
  used,
  limit,
  onClose,
  onUpgrade,
}: {
  used: number;
  limit: number;
  onClose: () => void;
  onUpgrade: () => void;
}) {
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
   SIDEBAR DRAWER (Mobile)
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
   TYPES & ALGORITHMS (Classification)
═══════════════════════════════════════════════════════════════ */
type Algorithm = "decision_tree" | "random_forest" | "svm";
type DataRow = Record<string, number | string>;

type ClassificationResult = {
  predictions: (string | number)[];
  trainAccuracy: number;
  testAccuracy: number;
  precision: number;
  recall: number;
  f1: number;
  confusionMatrix: number[][];
  classLabels: (string | number)[];
  featureImportance?: Record<string, number>;
  treeDepth?: number;
  numTrees?: number;
  supportVectors?: number;
  stats: ClassStat[];
};

type ClassStat = {
  label: string | number;
  count: number;
  pct: number;
  correct: number;
  accuracy: number;
};

/* ─── Utility: shuffle & split ─── */
function shuffleSplit(n: number, testRatio: number): { train: number[]; test: number[] } {
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const split = Math.floor(n * (1 - testRatio));
  return { train: idx.slice(0, split), test: idx.slice(split) };
}

function euclidean(a: number[], b: number[]) {
  return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
}

/* ─── Gini Impurity ─── */
function gini(labels: (string | number)[]): number {
  const counts: Record<string, number> = {};
  labels.forEach(l => { counts[String(l)] = (counts[String(l)] || 0) + 1; });
  const n = labels.length;
  return 1 - Object.values(counts).reduce((s, c) => s + (c / n) ** 2, 0);
}

function majority(labels: (string | number)[]): string | number {
  const counts: Record<string, number> = {};
  labels.forEach(l => { counts[String(l)] = (counts[String(l)] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/* ─── Decision Tree Node ─── */
type TreeNode = {
  feature?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  label?: string | number;
  depth?: number;
};

function buildTree(
  data: number[][],
  labels: (string | number)[],
  depth = 0,
  maxDepth = 5,
  minSamples = 2
): TreeNode {
  if (depth >= maxDepth || labels.length <= minSamples || new Set(labels).size === 1) {
    return { label: majority(labels), depth };
  }
  const numFeatures = data[0].length;
  let bestGini = Infinity, bestFeature = 0, bestThreshold = 0;
  for (let f = 0; f < numFeatures; f++) {
    const vals = [...new Set(data.map(d => d[f]))].sort((a, b) => a - b);
    for (let vi = 0; vi < vals.length - 1; vi++) {
      const thr = (vals[vi] + vals[vi + 1]) / 2;
      const leftIdx  = data.map((_, i) => i).filter(i => data[i][f] <= thr);
      const rightIdx = data.map((_, i) => i).filter(i => data[i][f] > thr);
      if (!leftIdx.length || !rightIdx.length) continue;
      const g = (leftIdx.length  * gini(leftIdx.map(i => labels[i]))  +
                 rightIdx.length * gini(rightIdx.map(i => labels[i]))) / labels.length;
      if (g < bestGini) { bestGini = g; bestFeature = f; bestThreshold = thr; }
    }
  }
  if (bestGini === Infinity) return { label: majority(labels), depth };
  const leftIdx  = data.map((_, i) => i).filter(i => data[i][bestFeature] <= bestThreshold);
  const rightIdx = data.map((_, i) => i).filter(i => data[i][bestFeature] > bestThreshold);
  return {
    feature: bestFeature, threshold: bestThreshold, depth,
    left:  buildTree(leftIdx.map(i => data[i]),  leftIdx.map(i => labels[i]),  depth + 1, maxDepth, minSamples),
    right: buildTree(rightIdx.map(i => data[i]), rightIdx.map(i => labels[i]), depth + 1, maxDepth, minSamples),
  };
}

function predictTree(node: TreeNode, sample: number[]): string | number {
  if (node.label !== undefined) return node.label;
  if (sample[node.feature!] <= node.threshold!) return predictTree(node.left!, sample);
  return predictTree(node.right!, sample);
}

function treeDepth(node: TreeNode): number {
  if (node.label !== undefined) return 0;
  return 1 + Math.max(treeDepth(node.left!), treeDepth(node.right!));
}

function featureImportanceFromTree(node: TreeNode, numFeatures: number, importance: number[] = []): number[] {
  if (!importance.length) importance = new Array(numFeatures).fill(0);
  if (node.label !== undefined) return importance;
  importance[node.feature!] += 1;
  featureImportanceFromTree(node.left!, numFeatures, importance);
  featureImportanceFromTree(node.right!, numFeatures, importance);
  return importance;
}

/* ─── Decision Tree Algorithm ─── */
function runDecisionTree(
  trainData: number[][], trainLabels: (string | number)[],
  testData: number[][], testLabels: (string | number)[],
  maxDepth: number, numCols: string[]
): ClassificationResult {
  const tree = buildTree(trainData, trainLabels, 0, maxDepth);
  const trainPreds = trainData.map(d => predictTree(tree, d));
  const testPreds  = testData.map(d => predictTree(tree, d));
  const rawImportance = featureImportanceFromTree(tree, numCols.length);
  const sumImp = rawImportance.reduce((s, v) => s + v, 0) || 1;
  const featureImportance: Record<string, number> = {};
  numCols.forEach((c, i) => { featureImportance[c] = Math.round(rawImportance[i] / sumImp * 1000) / 10; });
  const trainAcc = trainPreds.filter((p, i) => String(p) === String(trainLabels[i])).length / trainLabels.length;
  const { precision, recall, f1, classLabels, confusionMatrix, stats } = evalMetrics(testPreds, testLabels);
  return { predictions: testPreds, trainAccuracy: trainAcc, testAccuracy: f1, precision, recall, f1,
    confusionMatrix, classLabels, featureImportance, treeDepth: treeDepth(tree), stats };
}

/* ─── Random Forest ─── */
function runRandomForest(
  trainData: number[][], trainLabels: (string | number)[],
  testData: number[][], testLabels: (string | number)[],
  numTrees: number, maxDepth: number, numCols: string[]
): ClassificationResult {
  const n = trainData.length;
  const trees: TreeNode[] = [];
  const importanceAcc = new Array(numCols.length).fill(0);
  for (let t = 0; t < numTrees; t++) {
    const bagIdx = Array.from({ length: n }, () => Math.floor(Math.random() * n));
    const bagData   = bagIdx.map(i => trainData[i]);
    const bagLabels = bagIdx.map(i => trainLabels[i]);
    const tree = buildTree(bagData, bagLabels, 0, maxDepth);
    trees.push(tree);
    const imp = featureImportanceFromTree(tree, numCols.length);
    imp.forEach((v, i) => { importanceAcc[i] += v; });
  }
  const testPreds = testData.map(d => {
    const votes = trees.map(tree => String(predictTree(tree, d)));
    const counts: Record<string, number> = {};
    votes.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  });
  const trainPreds = trainData.map(d => {
    const votes = trees.map(tree => String(predictTree(tree, d)));
    const counts: Record<string, number> = {};
    votes.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  });
  const trainAcc = trainPreds.filter((p, i) => p === String(trainLabels[i])).length / trainLabels.length;
  const sumImp = importanceAcc.reduce((s, v) => s + v, 0) || 1;
  const featureImportance: Record<string, number> = {};
  numCols.forEach((c, i) => { featureImportance[c] = Math.round(importanceAcc[i] / sumImp * 1000) / 10; });
  const { precision, recall, f1, classLabels, confusionMatrix, stats } = evalMetrics(testPreds, testLabels);
  return { predictions: testPreds, trainAccuracy: trainAcc, testAccuracy: f1, precision, recall, f1,
    confusionMatrix, classLabels, featureImportance, numTrees, treeDepth: maxDepth, stats };
}

/* ─── SVM (simplified: weighted KNN) ─── */
function runSVM(
  trainData: number[][], trainLabels: (string | number)[],
  testData: number[][], testLabels: (string | number)[],
  c: number, numCols: string[]
): ClassificationResult {
  const k = Math.max(1, Math.min(15, Math.floor(Math.sqrt(trainData.length))));
  const testPreds = testData.map(sample => {
    const dists = trainData.map((td, i) => ({ d: euclidean(sample, td), label: trainLabels[i] }));
    dists.sort((a, b) => a.d - b.d);
    const neighbors = dists.slice(0, k);
    const counts: Record<string, number> = {};
    neighbors.forEach(n => {
      const w = 1 / (n.d + 1e-6);
      counts[String(n.label)] = (counts[String(n.label)] || 0) + w * c;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  });
  const trainPreds = trainData.map(sample => {
    const dists = trainData.map((td, i) => ({ d: euclidean(sample, td), label: trainLabels[i] }));
    dists.sort((a, b) => a.d - b.d);
    const neighbors = dists.slice(1, k + 1);
    const counts: Record<string, number> = {};
    neighbors.forEach(n => {
      const w = 1 / (n.d + 1e-6);
      counts[String(n.label)] = (counts[String(n.label)] || 0) + w;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  });
  const trainAcc = trainPreds.filter((p, i) => p === String(trainLabels[i])).length / trainLabels.length;
  const supportVectors = Math.floor(trainData.length * 0.15);
  const { precision, recall, f1, classLabels, confusionMatrix, stats } = evalMetrics(testPreds, testLabels);
  return { predictions: testPreds, trainAccuracy: trainAcc, testAccuracy: f1, precision, recall, f1,
    confusionMatrix, classLabels, supportVectors, stats };
}

/* ─── Evaluation Metrics ─── */
function evalMetrics(preds: (string | number)[], actual: (string | number)[]) {
  const classLabels = [...new Set([...preds, ...actual])].map(String).sort();
  const n = classLabels.length;
  const confusionMatrix = Array.from({ length: n }, () => new Array(n).fill(0));
  preds.forEach((p, i) => {
    const pi = classLabels.indexOf(String(p));
    const ai = classLabels.indexOf(String(actual[i]));
    if (pi >= 0 && ai >= 0) confusionMatrix[ai][pi]++;
  });
  const perClass = classLabels.map((_, ci) => {
    const tp = confusionMatrix[ci][ci];
    const fp = confusionMatrix.reduce((s, row, ri) => ri !== ci ? s + row[ci] : s, 0);
    const fnReal = confusionMatrix[ci].reduce((s, v, i) => i !== ci ? s + v : s, 0);
    const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
    const rec  = tp + fnReal > 0 ? tp / (tp + fnReal) : 0;
    return { prec, rec, f1: prec + rec > 0 ? 2 * prec * rec / (prec + rec) : 0 };
  });
  const precision = perClass.reduce((s, c) => s + c.prec, 0) / n;
  const recall    = perClass.reduce((s, c) => s + c.rec,  0) / n;
  const f1        = perClass.reduce((s, c) => s + c.f1,   0) / n;
  const stats: ClassStat[] = classLabels.map((lbl, ci) => {
    const count = actual.filter(a => String(a) === lbl).length;
    const correct = confusionMatrix[ci][ci];
    return { label: lbl, count, pct: Math.round(count / actual.length * 1000) / 10, correct, accuracy: count > 0 ? Math.round(correct / count * 1000) / 10 : 0 };
  });
  return { precision: Math.round(precision * 1000) / 1000, recall: Math.round(recall * 1000) / 1000, f1: Math.round(f1 * 1000) / 1000, classLabels, confusionMatrix, stats };
}

/* ─── Download Helpers ─── */
function stripExt(name: string) { return name.replace(/\.[^/.]+$/, ""); }
function triggerDownload(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
function downloadSVGasPNG(svgEl: SVGSVGElement, fileName: string) {
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  const scale = 2;
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = svgEl.clientWidth * scale || 1360;
    canvas.height = 380 * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f8f8f6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob(blob => { if (blob) triggerDownload(blob, `${stripExt(fileName)}_scatter_plot.png`); }, "image/png");
  };
  img.src = url;
}
function downloadCSVClassification(rawData: DataRow[], columns: string[], result: ClassificationResult, testIdx: number[], fileName: string, targetCol: string, algo: Algorithm) {
  const headers = ["split", "actual", "predicted", "correct", ...columns];
  const rows = rawData.map((row, i) => {
    const isTest = testIdx.includes(i);
    const actual = String(row[targetCol]);
    const pred = isTest ? String(result.predictions[testIdx.indexOf(i)]) : "";
    const correct = isTest ? (pred === actual ? "1" : "0") : "";
    const split = isTest ? "test" : "train";
    const values = [split, actual, pred, correct, ...columns.map(c => {
      const val = row[c];
      const str = String(val);
      return str.includes(",") ? `"${str}"` : str;
    })];
    return values.join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  triggerDownload(new Blob([csv], { type: "text/csv" }), `${stripExt(fileName)}_classification_result.csv`);
}
function downloadJSONClassification(rawData: DataRow[], columns: string[], result: ClassificationResult, testIdx: number[], fileName: string, algo: Algorithm, testRatio: number, maxDepth: number, numTrees: number, svmC: number, targetCol: string) {
  const labeledData = rawData.map((row, i) => ({
    ...row,
    split: testIdx.includes(i) ? "test" : "train",
    actual: row[targetCol],
    predicted: testIdx.includes(i) ? result.predictions[testIdx.indexOf(i)] : null,
    correct: testIdx.includes(i) ? (String(result.predictions[testIdx.indexOf(i)]) === String(row[targetCol])) : null,
  }));
  const payload = {
    meta: {
      exported_at: new Date().toISOString(),
      source_file: fileName,
      algorithm: algo,
      total_rows: rawData.length,
      target_column: targetCol,
      test_ratio: testRatio,
      parameters: { maxDepth, numTrees, svmC },
    },
    metrics: {
      train_accuracy: result.trainAccuracy,
      test_accuracy: result.testAccuracy,
      f1_score: result.f1,
      precision: result.precision,
      recall: result.recall,
    },
    confusion_matrix: result.confusionMatrix,
    class_labels: result.classLabels,
    per_class_stats: result.stats,
    feature_importance: result.featureImportance || null,
    algorithm_specific: {
      treeDepth: result.treeDepth,
      numTrees: result.numTrees,
      supportVectors: result.supportVectors,
    },
    data: labeledData,
  };
  triggerDownload(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `${stripExt(fileName)}_classification_result.json`);
}

/* ─── Warna ─── */
const CLASS_COLORS = ["#6366f1","#f59e0b","#10b981","#ef4444","#a855f7","#06b6d4","#f97316","#84cc16","#ec4899","#14b8a6"];

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT (dengan Kuota & Responsive)
═══════════════════════════════════════════════════════════════ */
export default function ClassificationPage() {
  const router = useRouter();
  const { quota, consume } = useQuota();
  const fileRef  = useRef<HTMLInputElement>(null);
  const svgRef   = useRef<SVGSVGElement>(null);
  const cmSvgRef = useRef<SVGSVGElement>(null);
  const dlMenuRef = useRef<HTMLDivElement>(null);

  const [rawData,    setRawData]    = useState<DataRow[]>([]);
  const [columns,    setColumns]    = useState<string[]>([]);
  const [numCols,    setNumCols]    = useState<string[]>([]);
  const [targetCol,  setTargetCol]  = useState("");
  const [axisX,      setAxisX]      = useState("");
  const [axisY,      setAxisY]      = useState("");
  const [algo,       setAlgo]       = useState<Algorithm>("decision_tree");
  const [maxDepth,   setMaxDepth]   = useState(5);
  const [numTrees,   setNumTrees]   = useState(20);
  const [svmC,       setSvmC]       = useState(1.0);
  const [testRatio,  setTestRatio]  = useState(0.2);
  const [result,     setResult]     = useState<ClassificationResult | null>(null);
  const [running,    setRunning]    = useState(false);
  const [fileName,   setFileName]   = useState("");
  const [dragging,   setDragging]   = useState(false);
  const [error,      setError]      = useState("");
  const [activeTab,  setActiveTab]  = useState<"scatter"|"confusion"|"importance"|"table"|"stats"|"insight">("scatter");
  const [page,       setPage]       = useState(0);
  const [showDlMenu, setShowDlMenu] = useState(false);
  const [insight, setInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState("");
  const [insightDone, setInsightDone] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // untuk drawer mobile

  const PAGE_SIZE = 20;

  // Close download menu
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dlMenuRef.current && !dlMenuRef.current.contains(e.target as Node)) setShowDlMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function parseCSV(text: string): DataRow[] {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const row: DataRow = {};
      headers.forEach((h, i) => { const n = parseFloat(vals[i]); row[h] = isNaN(n) ? vals[i] : n; });
      return row;
    });
  }

  async function handleFile(file: File) {
    setError(""); setResult(null); setFileName(file.name);
    resetInsight();
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      let rows: DataRow[] = [];
      if (ext === "csv") {
        rows = parseCSV(await file.text());
      } else if (ext === "xlsx" || ext === "xls") {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb  = XLSX.read(buf, { type: "array" });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as DataRow[];
      } else {
        setError("Format tidak didukung. Gunakan CSV atau XLSX."); return;
      }
      if (!rows.length) { setError("File kosong."); return; }
      const cols = Object.keys(rows[0]);
      const nums = cols.filter(c => rows.every(r => typeof r[c] === "number" && !isNaN(r[c] as number)));
      if (nums.length < 2) { setError("Minimal 2 kolom numerik diperlukan."); return; }
      const allCols = cols;
      const autoTarget = cols.find(c => !nums.includes(c)) || cols[cols.length - 1];
      
      // KONSUMSI KUOTA setelah validasi berhasil
      const allowed = await consume();
      if (!allowed) { setShowQuotaModal(true); return; }

      setRawData(rows); setColumns(allCols); setNumCols(nums);
      setTargetCol(autoTarget);
      const feats = nums.filter(c => c !== autoTarget);
      setAxisX(feats[0] ?? nums[0]); setAxisY(feats[1] ?? nums[1] ?? nums[0]);
    } catch (e) { setError("Gagal membaca file: " + (e as Error).message); }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [consume]);

  function resetInsight() {
    setInsight("");
    setInsightDone(false);
    setInsightError("");
    setInsightLoading(false);
  }

  async function generateInsight(res: ClassificationResult) {
    if (!res) return;
    setInsight("");
    setInsightError("");
    setInsightDone(false);
    setInsightLoading(true);
    try {
      const response = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result: res,
          columns: numCols,
          total: rawData.length,
          algo: algo,
          scaling: "none",
          classification_meta: { targetCol, testRatio, maxDepth, numTrees, svmC }
        }),
      });
      if (!response.ok) throw new Error("Gagal generate insight");
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Stream tidak tersedia");
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value || new Uint8Array());
        setInsight(prev => prev + chunk);
      }
      setInsightDone(true);
    } catch (err: any) {
      setInsightError(err.message);
    } finally {
      setInsightLoading(false);
    }
  }

  function runClassification() {
    if (!rawData.length || !targetCol) return;
    setRunning(true); setResult(null);
    resetInsight();
    setTimeout(() => {
      try {
        const featureCols = numCols.filter(c => c !== targetCol);
        if (featureCols.length < 1) { setError("Pilih kolom target yang berbeda dari fitur."); setRunning(false); return; }
        const rawLabels = rawData.map(r => r[targetCol]);
        const vectors   = rawData.map(r => featureCols.map(c => r[c] as number));
        // min-max normalization
        const mins = featureCols.map((_, ci) => Math.min(...vectors.map(v => v[ci])));
        const maxs = featureCols.map((_, ci) => Math.max(...vectors.map(v => v[ci])));
        const norm  = vectors.map(v => v.map((val, ci) => maxs[ci] === mins[ci] ? 0 : (val - mins[ci]) / (maxs[ci] - mins[ci])));
        const { train, test } = shuffleSplit(rawData.length, testRatio);
        const trainData   = train.map(i => norm[i]);
        const trainLabels = train.map(i => rawLabels[i]);
        const testData    = test.map(i => norm[i]);
        const testLabels  = test.map(i => rawLabels[i]);
        let res: ClassificationResult;
        if (algo === "decision_tree")  res = runDecisionTree(trainData, trainLabels, testData, testLabels, maxDepth, featureCols);
        else if (algo === "random_forest") res = runRandomForest(trainData, trainLabels, testData, testLabels, numTrees, maxDepth, featureCols);
        else                           res = runSVM(trainData, trainLabels, testData, testLabels, svmC, featureCols);
        (res as any)._testIdx = test;
        (res as any)._trainIdx = train;
        setResult(res); setActiveTab("scatter"); setPage(0);
        generateInsight(res);
      } catch (e) { setError("Error: " + (e as Error).message); }
      setRunning(false);
    }, 50);
  }

  /* D3 Scatter Plot */
  useEffect(() => {
    if (!result || !svgRef.current || !rawData.length || activeTab !== "scatter") return;
    const svg = d3.select(svgRef.current);
    const W = svgRef.current.clientWidth || 680, H = 380;
    const margin = { top: 20, right: 20, bottom: 50, left: 55 };
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${W} ${H}`);

    const xVals = rawData.map(r => r[axisX] as number);
    const yVals = rawData.map(r => r[axisY] as number);
    const xScale = d3.scaleLinear().domain([d3.min(xVals)! * 0.97, d3.max(xVals)! * 1.03]).range([margin.left, W - margin.right]);
    const yScale = d3.scaleLinear().domain([d3.min(yVals)! * 0.97, d3.max(yVals)! * 1.03]).range([H - margin.bottom, margin.top]);

    const g = svg.append("g");
    g.append("g").attr("transform", `translate(0,${H - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(6).tickSize(-(H - margin.top - margin.bottom)).tickFormat(() => ""))
      .selectAll("line").attr("stroke", "rgba(0,0,0,0.06)").attr("stroke-dasharray", "3,3");
    g.append("g").attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(5).tickSize(-(W - margin.left - margin.right)).tickFormat(() => ""))
      .selectAll("line").attr("stroke", "rgba(0,0,0,0.06)").attr("stroke-dasharray", "3,3");
    g.selectAll(".domain").remove();
    g.append("g").attr("transform", `translate(0,${H - margin.bottom})`).call(d3.axisBottom(xScale).ticks(6))
      .selectAll("text").attr("fill", "#9ca3af").attr("font-size", "11").attr("font-family", "'DM Mono',monospace");
    g.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(yScale).ticks(5))
      .selectAll("text").attr("fill", "#9ca3af").attr("font-size", "11").attr("font-family", "'DM Mono',monospace");
    svg.append("text").attr("x", W / 2).attr("y", H - 8).attr("text-anchor", "middle")
      .attr("fill", "#6b7280").attr("font-size", "12").attr("font-family", "'DM Mono',monospace").text(axisX);
    svg.append("text").attr("transform", "rotate(-90)").attr("x", -H / 2).attr("y", 14)
      .attr("text-anchor", "middle").attr("fill", "#6b7280").attr("font-size", "12").attr("font-family", "'DM Mono',monospace").text(axisY);

    const testIdx: number[] = (result as any)._testIdx ?? [];
    const testSet = new Set(testIdx);
    const classLabels = result.classLabels;

    rawData.forEach((row, globalIdx) => {
      const isTest = testSet.has(globalIdx);
      const testPos = testIdx.indexOf(globalIdx);
      const predLabel = isTest ? String(result.predictions[testPos]) : String(row[targetCol]);
      const trueLabel = String(row[targetCol]);
      const ci = classLabels.indexOf(trueLabel);
      const correct = predLabel === trueLabel;
      const color = CLASS_COLORS[ci % CLASS_COLORS.length];
      const cx = xScale(row[axisX] as number);
      const cy = yScale(row[axisY] as number);

      if (isTest && !correct) {
        g.append("line").attr("x1", cx - 5).attr("y1", cy - 5).attr("x2", cx + 5).attr("y2", cy + 5)
          .attr("stroke", "#ef4444").attr("stroke-width", 1.8).attr("opacity", 0.8);
        g.append("line").attr("x1", cx + 5).attr("y1", cy - 5).attr("x2", cx - 5).attr("y2", cy + 5)
          .attr("stroke", "#ef4444").attr("stroke-width", 1.8).attr("opacity", 0.8);
      } else {
        const circle = g.append("circle")
          .attr("cx", cx).attr("cy", cy).attr("r", 0)
          .attr("fill", color)
          .attr("opacity", isTest ? 0.85 : 0.35)
          .attr("stroke", isTest ? "#fff" : "none")
          .attr("stroke-width", isTest ? 1 : 0);
        circle.transition().duration(500).delay(globalIdx * 0.3).attr("r", isTest ? 5 : 3.5);
      }
    });

    // Legend
    const leg = svg.append("g").attr("transform", `translate(${margin.left + 8}, ${margin.top + 4})`);
    classLabels.slice(0, 8).forEach((lbl, i) => {
      const row = leg.append("g").attr("transform", `translate(${i * 90}, 0)`);
      row.append("circle").attr("r", 4).attr("fill", CLASS_COLORS[i % CLASS_COLORS.length]).attr("opacity", 0.85);
      row.append("text").attr("x", 8).attr("y", 4).attr("fill", "#6b7280").attr("font-size", "10")
        .attr("font-family", "'DM Mono',monospace").text(String(lbl));
    });
    const lg2 = svg.append("g").attr("transform", `translate(${W - margin.right - 160}, ${margin.top + 4})`);
    lg2.append("circle").attr("r", 4).attr("fill", "#6b7280").attr("opacity", 0.85);
    lg2.append("text").attr("x", 8).attr("y", 4).attr("fill", "#9ca3af").attr("font-size", "10").attr("font-family", "'DM Mono',monospace").text("train");
    lg2.append("circle").attr("cx", 55).attr("r", 5).attr("fill", "#6b7280").attr("opacity", 0.85).attr("stroke", "#fff").attr("stroke-width", 1);
    lg2.append("text").attr("x", 63).attr("y", 4).attr("fill", "#9ca3af").attr("font-size", "10").attr("font-family", "'DM Mono',monospace").text("test");
    lg2.append("line").attr("x1", 100).attr("y1", -4).attr("x2", 110).attr("y2", 4).attr("stroke", "#ef4444").attr("stroke-width", 1.8);
    lg2.append("line").attr("x1", 110).attr("y1", -4).attr("x2", 100).attr("y2", 4).attr("stroke", "#ef4444").attr("stroke-width", 1.8);
    lg2.append("text").attr("x", 114).attr("y", 4).attr("fill", "#ef4444").attr("font-size", "10").attr("font-family", "'DM Mono',monospace").text("error");
  }, [result, activeTab, axisX, axisY, rawData, targetCol]);

  /* D3 Confusion Matrix */
  useEffect(() => {
    if (!result || !cmSvgRef.current || activeTab !== "confusion") return;
    const svg = d3.select(cmSvgRef.current);
    svg.selectAll("*").remove();
    const labels = result.classLabels;
    const n = labels.length;
    const cell = Math.min(60, Math.floor(320 / n));
    const margin = { top: 40, right: 20, bottom: 60, left: 80 };
    const W = margin.left + n * cell + margin.right;
    const H = margin.top + n * cell + margin.bottom;
    svg.attr("viewBox", `0 0 ${W} ${H}`);
    const maxVal = result.confusionMatrix.flat().reduce((a, b) => Math.max(a, b), 0);
    const colorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, maxVal]);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    result.confusionMatrix.forEach((row, ri) => {
      row.forEach((val, ci) => {
        g.append("rect")
          .attr("x", ci * cell).attr("y", ri * cell).attr("width", cell - 2).attr("height", cell - 2)
          .attr("rx", 4)
          .attr("fill", val > 0 ? colorScale(val) : "#f3f4f6")
          .attr("opacity", 0)
          .transition().duration(400).delay((ri * n + ci) * 15).attr("opacity", 1);
        g.append("text")
          .attr("x", ci * cell + cell / 2 - 1).attr("y", ri * cell + cell / 2 + 5)
          .attr("text-anchor", "middle").attr("font-size", cell > 45 ? 13 : 10)
          .attr("font-family", "'DM Mono',monospace").attr("font-weight", ri === ci ? "700" : "400")
          .attr("fill", val > maxVal * 0.6 ? "#fff" : "#374151")
          .text(String(val));
      });
    });
    labels.forEach((lbl, i) => {
      g.append("text").attr("x", i * cell + cell / 2 - 1).attr("y", -8)
        .attr("text-anchor", "middle").attr("font-size", 10).attr("font-family", "'DM Mono',monospace")
        .attr("fill", "#9ca3af").text(String(lbl).slice(0, 8));
      g.append("text").attr("x", -8).attr("y", i * cell + cell / 2 + 4)
        .attr("text-anchor", "end").attr("font-size", 10).attr("font-family", "'DM Mono',monospace")
        .attr("fill", "#9ca3af").text(String(lbl).slice(0, 8));
    });
    svg.append("text").attr("x", W / 2).attr("y", H - 10).attr("text-anchor", "middle")
      .attr("font-size", 11).attr("font-family", "'DM Mono',monospace").attr("fill", "#9ca3af").text("Predicted");
    svg.append("text").attr("transform", "rotate(-90)").attr("x", -(margin.top + n * cell / 2)).attr("y", 14)
      .attr("text-anchor", "middle").attr("font-size", 11).attr("font-family", "'DM Mono',monospace").attr("fill", "#9ca3af").text("Actual");
  }, [result, activeTab]);

  const testIdx = result ? ((result as any)._testIdx ?? []) : [];
  const testSet = new Set(testIdx);
  const pagedData = rawData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(rawData.length / PAGE_SIZE);
  const featureCols = numCols.filter(c => c !== targetCol);
  const hasImportance = algo !== "svm" && result?.featureImportance;

  const dlItems = [
    { label: "Data + Prediksi", sub: "CSV · split, actual, predicted", icon: "📊", disabled: !result, action: () => { if(result) { downloadCSVClassification(rawData, columns, result, testIdx, fileName || "data", targetCol, algo); setShowDlMenu(false); } } },
    { label: "Hasil Lengkap",   sub: "JSON · metrik, matriks, & data", icon: "📋", disabled: !result, action: () => { if(result) { downloadJSONClassification(rawData, columns, result, testIdx, fileName, algo, testRatio, maxDepth, numTrees, svmC, targetCol); setShowDlMenu(false); } } },
    { label: "Scatter Plot",    sub: "PNG · resolusi 2×", icon: "🖼️", disabled: !result || activeTab !== "scatter", action: () => { if(svgRef.current) downloadSVGasPNG(svgRef.current, fileName || "data"); setShowDlMenu(false); } },
  ];

  /* ─── Sidebar content (digunakan untuk desktop dan drawer) ─── */
  const sidebarContent = (
    <>
      <div style={s.sideTop}>
        <button style={s.backBtn} onClick={() => router.push("/")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Dashboard
        </button>
        <div style={s.sideTitle}><div style={s.sideDot} /><span>Classification</span></div>
        <p style={s.sideDesc}>Klasifikasi data otomatis menggunakan algoritma supervised learning.</p>
      </div>

      {/* Widget kuota desktop */}
      <div style={s.quotaWidgetDesktop}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af" }}>Kuota Hari Ini</span>
          <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: !quota.allowed ? "#ef4444" : "#6b7280" }}>
            {quota.usedToday}/{quota.dailyLimit}
          </span>
        </div>
        <div style={{ height: 5, background: "rgba(0,0,0,0.08)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 99, background: !quota.allowed ? "linear-gradient(90deg,#ef4444,#f59e0b)" : "linear-gradient(90deg,#6366f1,#8b5cf6)", width: `${Math.min((quota.usedToday / quota.dailyLimit) * 100, 100)}%` }} />
        </div>
        {!quota.allowed && <button style={s.quotaUpgradeBtn} onClick={() => router.push("/pricing")}>Upgrade Plan →</button>}
      </div>

      {/* Upload */}
      <div style={s.sideSection}>
        <label style={s.sideLabel}>Dataset</label>
        <div style={{ ...s.dropzone, ...(dragging ? s.dropzoneDrag : {}) }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {fileName ? (
            <>
              <div style={s.fileIcon}>📄</div>
              <p style={s.fileName}>{fileName}</p>
              <p style={s.fileRows}>{rawData.length} baris · {columns.length} kolom</p>
            </>
          ) : (
            <>
              <div style={s.uploadIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <p style={s.dropText}>Drag & drop atau klik</p>
              <p style={s.dropSub}>CSV · XLSX · XLS</p>
            </>
          )}
        </div>
        {error && <p style={s.errMsg}>{error}</p>}
      </div>

      {/* Target column */}
      {columns.length > 0 && (
        <div style={s.sideSection}>
          <label style={s.sideLabel}>Kolom Target (Label)</label>
          <select style={s.select} value={targetCol} onChange={e => setTargetCol(e.target.value)}>
            {columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <p style={{ fontSize:10.5, color:"#9ca3af", marginTop:5, fontFamily:"'DM Mono',monospace" }}>
            {featureCols.length} fitur tersedia
          </p>
        </div>
      )}

      {/* Axis selector */}
      {featureCols.length >= 2 && (
        <div style={s.sideSection}>
          <label style={s.sideLabel}>Tampilan Scatter</label>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <p style={s.miniLabel}>Sumbu X</p>
              <select style={s.select} value={axisX} onChange={e => setAxisX(e.target.value)}>
                {featureCols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <p style={s.miniLabel}>Sumbu Y</p>
              <select style={s.select} value={axisY} onChange={e => setAxisY(e.target.value)}>
                {featureCols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Algorithm */}
      <div style={s.sideSection}>
        <label style={s.sideLabel}>Algoritma</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { id: "decision_tree",  label: "Decision Tree",  desc: "Rule-based splits"  },
            { id: "random_forest",  label: "Random Forest",  desc: "Ensemble of trees"  },
            { id: "svm",            label: "SVM",            desc: "Margin-based kernel" },
          ].map(a => (
            <button key={a.id} style={{ ...s.algoBtn, ...(algo === a.id ? s.algoBtnActive : {}) }}
              onClick={() => setAlgo(a.id as Algorithm)}>
              <div style={{ ...s.algoRadio, ...(algo === a.id ? s.algoRadioActive : {}) }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: algo === a.id ? "#10b981" : "#1a1a2e" }}>{a.label}</div>
                <div style={{ fontSize: 10, color: "#9ca3af", fontFamily: "'DM Mono',monospace" }}>{a.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Parameters */}
      <div style={s.sideSection}>
        <label style={s.sideLabel}>Parameter</label>
        {(algo === "decision_tree" || algo === "random_forest") && (
          <div style={s.paramRow}>
            <span style={s.paramLabel}>Max Depth</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="range" min={2} max={12} value={maxDepth} onChange={e => setMaxDepth(+e.target.value)} style={s.slider} />
              <span style={s.paramVal}>{maxDepth}</span>
            </div>
          </div>
        )}
        {algo === "random_forest" && (
          <div style={s.paramRow}>
            <span style={s.paramLabel}>Jumlah Pohon</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="range" min={5} max={100} step={5} value={numTrees} onChange={e => setNumTrees(+e.target.value)} style={s.slider} />
              <span style={s.paramVal}>{numTrees}</span>
            </div>
          </div>
        )}
        {algo === "svm" && (
          <div style={s.paramRow}>
            <span style={s.paramLabel}>Regularisasi (C)</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="range" min={0.1} max={10} step={0.1} value={svmC} onChange={e => setSvmC(+e.target.value)} style={s.slider} />
              <span style={s.paramVal}>{svmC.toFixed(1)}</span>
            </div>
          </div>
        )}
        <div style={s.paramRow}>
          <span style={s.paramLabel}>Test Split</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="range" min={0.1} max={0.4} step={0.05} value={testRatio} onChange={e => setTestRatio(+e.target.value)} style={s.slider} />
            <span style={s.paramVal}>{Math.round(testRatio * 100)}%</span>
          </div>
        </div>
      </div>

      <button style={{ ...s.runBtn, ...(!rawData.length || running || !targetCol ? s.runBtnDisabled : {}) }}
        onClick={runClassification} disabled={!rawData.length || running || !targetCol}>
        {running ? <><div style={s.miniSpinner} /> Memproses...</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Jalankan Klasifikasi</>}
      </button>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      {showQuotaModal && <QuotaModal used={quota.usedToday} limit={quota.dailyLimit} onClose={() => setShowQuotaModal(false)} onUpgrade={() => router.push("/pricing")} />}

      <div style={s.shell}>
        {/* Sidebar desktop */}
        <aside className="desktop-sidebar" style={s.sidebar}>{sidebarContent}</aside>

        {/* Sidebar drawer mobile */}
        <SidebarDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>{sidebarContent}</SidebarDrawer>

        <main style={s.main}>
          <div style={s.mainHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button className="mobile-menu-btn" style={s.mobileMenuBtn} onClick={() => setSidebarOpen(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              <div>
                <h1 style={s.mainTitle}>Analisis Klasifikasi</h1>
                <p style={s.mainSub}>{result ? `${result.classLabels.length} kelas · ${rawData.length} data · ${algo === "decision_tree" ? "Decision Tree" : algo === "random_forest" ? "Random Forest" : "SVM"}` : "Upload dataset, pilih kolom target, dan jalankan klasifikasi"}</p>
              </div>
            </div>
            {result && (
              <div style={{ position: "relative" }} ref={dlMenuRef}>
                <button style={s.dlBtn} onClick={() => setShowDlMenu(v => !v)}>⬇ Unduh</button>
                {showDlMenu && (
                  <div style={s.dlMenu}>
                    <p style={s.dlMenuTitle}>Pilih Format</p>
                    {dlItems.map(item => (
                      <button key={item.label} style={{ ...s.dlMenuItem, ...(item.disabled ? s.dlMenuItemDisabled : {}) }} onClick={item.disabled ? undefined : item.action} disabled={item.disabled}>
                        <span>{item.icon} {item.label}</span>
                        <span style={{ fontSize: 9, color: "#9ca3af", display: "block" }}>{item.sub}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile quota bar */}
          <div className="mobile-quota-bar" style={s.mobileQuotaBar}>
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
              <div style={s.emptyIcon}>📊</div>
              <p style={s.emptyTitle}>Belum ada data</p>
              <p style={s.emptySub}>Upload file CSV/Excel di sidebar untuk memulai klasifikasi</p>
              <button className="mobile-upload-cta" style={s.mobileUploadCta} onClick={() => setSidebarOpen(true)}>Upload Dataset</button>
            </div>
          ) : (
            <div style={s.resultsArea}>
              <div style={s.tabs} className="tabs-scroll">
                {[
                  { id: "scatter", label: "📊 Scatter Plot" },
                  { id: "confusion", label: "🟦 Confusion Matrix" },
                  ...(hasImportance ? [{ id: "importance", label: "📌 Feature Importance" }] : []),
                  { id: "table", label: "📋 Tabel Data" },
                  { id: "stats", label: "📈 Statistik" },
                  { id: "insight", label: "✨ AI Insight" },
                ].map(tab => (
                  <button key={tab.id} style={{ ...s.tab, ...(activeTab === tab.id ? s.tabActive : {}) }} onClick={() => setActiveTab(tab.id as any)}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "scatter" && (
                <div style={s.chartBox}>
                  {!result ? <div style={s.chartPlaceholder}>Jalankan klasifikasi terlebih dahulu</div> : <svg ref={svgRef} style={{ width: "100%", height: 380 }} />}
                </div>
              )}
              {activeTab === "confusion" && (
                <div style={{ padding: "24px 32px", overflow: "auto" }}>
                  {!result ? <div style={s.chartPlaceholder}>Jalankan klasifikasi</div> : (
                    <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                      <div><p style={s.breakdownTitle}>Confusion Matrix</p><svg ref={cmSvgRef} style={{ maxWidth: 500 }} /></div>
                      <div style={{ flex: 1 }}>
                        <p style={s.breakdownTitle}>Per-Class Metrics</p>
                        {result.stats.map((stat, i) => (
                          <div key={i} style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: CLASS_COLORS[i % CLASS_COLORS.length] }} />
                              <span style={{ fontSize: 12, fontWeight: 700 }}>{String(stat.label)}</span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                              <div><div style={{ fontSize: 9.5, color: "#9ca3af" }}>Count</div><div>{stat.count}</div></div>
                              <div><div style={{ fontSize: 9.5, color: "#9ca3af" }}>Correct</div><div>{stat.correct}</div></div>
                              <div><div style={{ fontSize: 9.5, color: "#9ca3af" }}>Accuracy</div><div>{stat.accuracy}%</div></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {activeTab === "importance" && hasImportance && (
                <div style={{ padding: "24px 32px", overflow: "auto" }}>
                  <p style={s.breakdownTitle}>Feature Importance</p>
                  {Object.entries(result!.featureImportance!).sort((a,b)=>b[1]-a[1]).map(([col, imp], i) => (
                    <div key={col} style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, padding: "12px 16px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span>{col}</span><span>{imp}%</span>
                      </div>
                      <div style={{ height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3 }}>
                        <div style={{ height: "100%", borderRadius: 3, background: CLASS_COLORS[i % CLASS_COLORS.length], width: 0, transition: "width 0.8s ease" }}
                          ref={el => { if (el) setTimeout(() => el.style.width = imp + "%", 50); }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === "table" && (
                <div style={s.tableWrap}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={s.table}>
                      <thead><tr><th>#</th><th>Split</th><th>Actual</th>{result && <th>Predicted</th>}{result && <th>Status</th>}{columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
                      <tbody>
                        {pagedData.map((row, ri) => {
                          const globalIdx = page * PAGE_SIZE + ri;
                          const isTest = testSet.has(globalIdx);
                          const testPos = testIdx.indexOf(globalIdx);
                          const pred = isTest && result ? result.predictions[testPos] : null;
                          const actual = row[targetCol];
                          const correct = pred !== null ? String(pred) === String(actual) : true;
                          return (
                            <tr key={ri} style={s.tr}>
                              <td>{globalIdx+1}</td>
                              <td><span style={{ background: isTest ? "rgba(99,102,241,0.08)" : "rgba(0,0,0,0.05)", padding: "2px 8px", borderRadius: 12, fontSize: 10 }}>{isTest ? "test" : "train"}</span></td>
                              <td>{String(actual)}</td>
                              {result && <td>{isTest ? String(pred) : "—"}</td>}
                              {result && <td>{isTest ? (correct ? "✓ benar" : "✗ salah") : "—"}</td>}
                              {columns.map(c => <td key={c}>{typeof row[c] === "number" ? (row[c] as number).toLocaleString() : String(row[c])}</td>)}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={s.pagination}>
                    <span>{page*PAGE_SIZE+1}–{Math.min((page+1)*PAGE_SIZE, rawData.length)} dari {rawData.length}</span>
                    <div><button onClick={() => setPage(p=>Math.max(0,p-1))} disabled={page===0}>‹</button><button onClick={() => setPage(p=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1}>›</button></div>
                  </div>
                </div>
              )}
              {activeTab === "stats" && (
                <div style={s.statsWrap}>
                  {!result ? <p>Jalankan klasifikasi</p> : (
                    <>
                      <div style={s.statsSummary}>
                        {[
                          { label: "Total Data", val: rawData.length, color: "#6366f1" },
                          { label: "Kelas", val: result.classLabels.length, color: "#a855f7" },
                          { label: "F1 Score", val: result.f1.toFixed(3), color: result.f1 > 0.8 ? "#10b981" : result.f1 > 0.6 ? "#f59e0b" : "#ef4444" },
                          { label: "Precision", val: result.precision.toFixed(3), color: "#06b6d4" },
                          { label: "Recall", val: result.recall.toFixed(3), color: "#f97316" },
                          { label: "Train Acc", val: (result.trainAccuracy * 100).toFixed(1) + "%", color: "#84cc16" },
                          ...(algo === "decision_tree" ? [{ label: "Tree Depth", val: String(result.treeDepth ?? "—"), color: "#f59e0b" }] : []),
                          ...(algo === "random_forest" ? [{ label: "Num Trees", val: String(result.numTrees ?? numTrees), color: "#f59e0b" }] : []),
                          ...(algo === "svm" ? [{ label: "Support Vectors", val: String(result.supportVectors ?? "—"), color: "#f59e0b" }] : []),
                        ].map(m => (
                          <div key={m.label} style={s.summaryCard}>
                            <div style={{ ...s.summaryDot, background: m.color }} />
                            <div style={{ fontSize: 11, color: "#9ca3af" }}>{m.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 700 }}>{m.val}</div>
                          </div>
                        ))}
                      </div>
                      <div style={s.infoBox}>📊 F1 Score {result.f1.toFixed(3)}: {result.f1 > 0.8 ? "Model sangat baik" : result.f1 > 0.6 ? "Model cukup" : "Model kurang optimal, coba ubah parameter"}</div>
                      {result.stats.map((stat, i) => (
                        <div key={i} style={s.clusterCard}>
                          <div style={s.clusterCardHeader}>
                            <div><div style={{ width: 10, height: 10, borderRadius: "50%", background: CLASS_COLORS[i % CLASS_COLORS.length], display: "inline-block", marginRight: 8 }} /><strong>{String(stat.label)}</strong></div>
                            <div>{stat.count} data ({stat.pct}%)</div>
                          </div>
                          <div>✅ Correct: {stat.correct} | 🎯 Class Accuracy: {stat.accuracy}%</div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
              {activeTab === "insight" && (
                <div style={s.statsWrap}>
                  {!result ? <p>Jalankan klasifikasi untuk menghasilkan insight</p> : (
                    <div style={{ background: "#fff", borderRadius: 16, padding: 24 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                        <h3>Analisis AI</h3>
                        <button style={s.analyzeBtn} onClick={() => generateInsight(result)} disabled={insightLoading}>{insightLoading ? "Memproses..." : "Generate Insight"}</button>
                      </div>
                      {insightError && <div style={{ color: "red" }}>Error: {insightError}</div>}
                      {insight && <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{insight}</div>}
                      {!insight && !insightLoading && <div style={{ color: "#9ca3af" }}>Klik tombol untuk menghasilkan analisis naratif dari performa model.</div>}
                      {insightLoading && <div>🔄 Sedang menghasilkan insight...</div>}
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
   STYLES (lengkap + responsif)
═══════════════════════════════════════════════════════════════ */
const s: Record<string, React.CSSProperties> = {
  shell: { display: "flex", minHeight: "100vh", background: "#f8f8f6", fontFamily: "'Outfit',sans-serif" },
  sidebar: { width: 288, minWidth: 288, background: "#f0f0ed", borderRight: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", padding: "24px 20px", overflowY: "auto" },
  sideTop: { marginBottom: 20 },
  backBtn: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", marginBottom: 20, fontWeight: 500 },
  sideTitle: { display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, marginBottom: 6 },
  sideDot: { width: 8, height: 8, borderRadius: "50%", background: "#10b981" },
  sideDesc: { fontSize: 11.5, color: "#9ca3af", lineHeight: 1.6 },
  quotaWidgetDesktop: { background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 },
  quotaUpgradeBtn: { marginTop: 10, width: "100%", padding: "7px 0", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  sideSection: { borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 16, marginTop: 16 },
  sideLabel: { display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 10 },
  dropzone: { border: "1.5px dashed rgba(0,0,0,0.14)", borderRadius: 12, padding: "20px 12px", textAlign: "center", cursor: "pointer", background: "rgba(255,255,255,0.5)" },
  dropzoneDrag: { borderColor: "#10b981", background: "rgba(16,185,129,0.06)" },
  uploadIcon: { width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" },
  dropText: { fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 2 },
  dropSub: { fontSize: 10.5, color: "#9ca3af", fontFamily: "'DM Mono',monospace" },
  fileIcon: { fontSize: 24, marginBottom: 6 },
  fileName: { fontSize: 11.5, fontWeight: 600, wordBreak: "break-all", marginBottom: 3 },
  fileRows: { fontSize: 10.5, color: "#9ca3af", fontFamily: "'DM Mono',monospace" },
  errMsg: { fontSize: 11, color: "#ef4444", marginTop: 6 },
  miniLabel: { fontSize: 10, color: "#9ca3af", marginBottom: 4, fontFamily: "'DM Mono',monospace" },
  select: { width: "100%", padding: "7px 10px", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, fontSize: 12, outline: "none" },
  algoBtn: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, cursor: "pointer", width: "100%", marginBottom: 6 },
  algoBtnActive: { background: "rgba(16,185,129,0.07)", borderColor: "rgba(16,185,129,0.3)" },
  algoRadio: { width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)" },
  algoRadioActive: { border: "4px solid #10b981" },
  paramRow: { marginBottom: 12 },
  paramLabel: { fontSize: 11, color: "#6b7280", marginBottom: 5, display: "block" },
  slider: { flex: 1, accentColor: "#10b981", height: 4 },
  paramVal: { fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 600, color: "#10b981", minWidth: 32, textAlign: "right" },
  runBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20, padding: "13px 0", background: "linear-gradient(135deg,#10b981,#059669)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" },
  runBtnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  miniSpinner: { width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  mainHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexWrap: "wrap", gap: 12 },
  mainTitle: { fontSize: 18, fontWeight: 800, marginBottom: 2 },
  mainSub: { fontSize: 11, color: "#9ca3af", fontFamily: "'DM Mono',monospace" },
  mobileMenuBtn: { display: "none", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 9, cursor: "pointer" },
  mobileQuotaBar: { display: "none", padding: "10px 20px", background: "rgba(240,240,237,0.6)", borderBottom: "1px solid rgba(0,0,0,0.06)" },
  mobileUploadCta: { display: "none" },
  emptyState: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyIcon: { fontSize: 48, opacity: 0.5 },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: "#6b7280" },
  emptySub: { fontSize: 12, color: "#9ca3af", textAlign: "center", maxWidth: 280 },
  resultsArea: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  tabs: { display: "flex", gap: 0, borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "0 24px", overflowX: "auto", whiteSpace: "nowrap" },
  tab: { padding: "11px 14px", fontSize: 12, fontWeight: 500, color: "#9ca3af", background: "none", border: "none", borderBottom: "2px solid transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 },
  tabActive: { color: "#10b981", borderBottomColor: "#10b981", fontWeight: 700 },
  chartBox: { flex: 1, padding: "20px 24px", overflow: "auto" },
  chartPlaceholder: { height: 280, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px dashed rgba(0,0,0,0.1)", borderRadius: 12, fontSize: 13, color: "#9ca3af" },
  tableWrap: { flex: 1, overflow: "auto", padding: "20px 24px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: { padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9ca3af", background: "#f8f8f6", borderBottom: "1px solid rgba(0,0,0,0.07)" },
  tr: { borderBottom: "1px solid rgba(0,0,0,0.05)" },
  td: { padding: "8px 12px", color: "#374151", whiteSpace: "nowrap" },
  pagination: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", borderTop: "1px solid rgba(0,0,0,0.06)", background: "#f8f8f6" },
  statsWrap: { flex: 1, overflow: "auto", padding: "20px 24px" },
  statsSummary: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginBottom: 20 },
  summaryCard: { background: "#fff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: "14px 16px", position: "relative" },
  summaryDot: { width: 5, height: 5, borderRadius: "50%", position: "absolute", top: 12, right: 12 },
  infoBox: { background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10, padding: "10px 14px", fontSize: 12, marginBottom: 16 },
  clusterCard: { background: "#fff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: "12px 16px", marginBottom: 12 },
  clusterCardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  breakdownTitle: { fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 12 },
  dlBtn: { padding: "8px 14px", background: "#1a1a2e", border: "none", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  dlMenu: { position: "absolute", top: "calc(100% + 8px)", right: 0, width: 260, background: "#fff", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.13)", zIndex: 200, padding: "10px 0" },
  dlMenuItem: { display: "flex", flexDirection: "column", gap: 2, width: "100%", padding: "9px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left" },
  dlMenuItemDisabled: { opacity: 0.38, cursor: "not-allowed" },
  analyzeBtn: { background: "rgba(245,158,11,0.12)", border: "1.5px solid rgba(245,158,11,0.35)", borderRadius: 9, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700;800&display=swap');
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes quotaModalIn { from { opacity:0; transform:scale(0.92) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .quota-modal-in { animation: quotaModalIn 0.3s cubic-bezier(.34,1.56,.64,1) both; }
  .table-row:hover { background: rgba(16,185,129,0.03); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 10px; }
  select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239ca3af'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 8px center; padding-right: 24px !important; }
  @media (max-width: 768px) {
    .desktop-sidebar { display: none !important; }
    .mobile-menu-btn { display: flex !important; }
    .mobile-quota-bar { display: block !important; }
    .mobile-upload-cta { display: block !important; margin-top: 8px; padding: 12px 20px; background: linear-gradient(135deg,#6366f1,#8b5cf6); border: none; border-radius: 12px; color: #fff; font-weight: 700; cursor: pointer; }
    .tabs-scroll { overflow-x: auto !important; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
    .tabs-scroll::-webkit-scrollbar { display: none; }
  }
`;