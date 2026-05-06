"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";

/* ═══════════════════════════════════════════════════════════════
   QUOTA (server-side via API) - sama seperti halaman statistik
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
   SIDEBAR DRAWER (Mobile) - persis seperti halaman statistik
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
   TYPES & CLUSTERING ALGORITHMS (lengkap)
═══════════════════════════════════════════════════════════════ */
type Algorithm = "kmeans" | "dbscan" | "hierarchical";
type ScalingMethod = "minmax" | "standard" | "robust" | "none";
type DataRow = Record<string, number | string>;
type ClusterResult = {
  labels: number[];
  centroids?: number[][];
  k?: number;
  silhouette?: number;
  daviesBouldin?: number;
  calinskiHarabasz?: number;
  inertia?: number;
  iterations?: number;
  noise?: number;
  stats: ClusterStat[];
};
type ClusterStat = { id: number; count: number; pct: number; means: Record<string, number> };
type ElbowPoint = { k: number; inertia: number; silhouette: number };

/* ─── Helper Euclidean ─── */
function euclidean(a: number[], b: number[]) {
  return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
}

/* ─── K-Means (multi‑run) ─── */
function kmeansOnce(data: number[][], k: number, maxIter = 150): ClusterResult {
  const n = data.length, dim = data[0].length;
  const centroids: number[][] = [data[Math.floor(Math.random() * n)]];
  while (centroids.length < k) {
    const dists = data.map(p => Math.min(...centroids.map(c => euclidean(p, c))));
    const sum = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum, idx = 0;
    for (let i = 0; i < dists.length; i++) { r -= dists[i]; if (r <= 0) { idx = i; break; } }
    centroids.push([...data[idx]]);
  }
  let labels = new Array(n).fill(0);
  let iter = 0;
  for (; iter < maxIter; iter++) {
    const newLabels = data.map(p => {
      let best = 0, bestD = Infinity;
      centroids.forEach((c, i) => { const d = euclidean(p, c); if (d < bestD) { bestD = d; best = i; } });
      return best;
    });
    const changed = newLabels.some((l, i) => l !== labels[i]);
    labels = newLabels;
    if (!changed) break;
    for (let ci = 0; ci < k; ci++) {
      const pts = data.filter((_, i) => labels[i] === ci);
      if (pts.length === 0) continue;
      for (let d = 0; d < dim; d++) centroids[ci][d] = pts.reduce((s, p) => s + p[d], 0) / pts.length;
    }
  }
  const inertia = data.reduce((s, p, i) => s + euclidean(p, centroids[labels[i]]) ** 2, 0);
  const silhouette = calcSilhouette(data, labels, k);
  const daviesBouldin = calcDaviesBouldin(data, labels, centroids, k);
  const calinskiHarabasz = calcCalinskiHarabasz(data, labels, k);
  return {
    labels, centroids, k, silhouette,
    daviesBouldin: Math.round(daviesBouldin * 1000) / 1000,
    calinskiHarabasz: Math.round(calinskiHarabasz * 100) / 100,
    inertia: Math.round(inertia * 100) / 100,
    iterations: iter,
    stats: buildStats(labels, data, k)
  };
}

function kmeans(data: number[][], k: number, runs = 8): ClusterResult {
  let best: ClusterResult | null = null;
  for (let r = 0; r < runs; r++) {
    const res = kmeansOnce(data, k);
    if (!best || (res.inertia ?? Infinity) < (best.inertia ?? Infinity)) best = res;
  }
  return best!;
}

/* ─── DBSCAN ─── */
function regionQuery(data: number[][], idx: number, eps: number) {
  return data.map((_, i) => i).filter(i => euclidean(data[idx], data[i]) <= eps);
}

function dbscan(data: number[][], eps: number, minPts: number): ClusterResult {
  const n = data.length;
  const visited = new Array(n).fill(false);
  const labels = new Array(n).fill(-1);
  let cluster = 0;
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    visited[i] = true;
    const neighbors = regionQuery(data, i, eps);
    if (neighbors.length < minPts) { labels[i] = -1; continue; }
    labels[i] = cluster;
    const queue = [...neighbors];
    while (queue.length > 0) {
      const j = queue.shift()!;
      if (!visited[j]) {
        visited[j] = true;
        const nb2 = regionQuery(data, j, eps);
        if (nb2.length >= minPts) queue.push(...nb2.filter(x => !queue.includes(x)));
      }
      if (labels[j] === -1) labels[j] = cluster;
    }
    cluster++;
  }
  const noise = labels.filter(l => l === -1).length;
  const k = cluster;
  const positiveLabels = labels.map(l => Math.max(l, 0));
  const silhouette = k > 1 ? calcSilhouette(data, positiveLabels, k) : 0;
  return { labels, k, noise, silhouette, stats: buildStats(labels, data, k) };
}

/* ─── Hierarchical (single‑linkage) ─── */
function hierarchical(data: number[][], k: number): ClusterResult {
  const n = data.length;
  let clusters: number[][] = Array.from({ length: n }, (_, i) => [i]);
  while (clusters.length > k) {
    let minD = Infinity, a = 0, b = 1;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const d = Math.min(...clusters[i].flatMap(pi => clusters[j].map(pj => euclidean(data[pi], data[pj]))));
        if (d < minD) { minD = d; a = i; b = j; }
      }
    }
    clusters[a] = [...clusters[a], ...clusters[b]];
    clusters.splice(b, 1);
  }
  const finalLabels = new Array(n).fill(0);
  clusters.forEach((cl, ci) => cl.forEach(idx => { finalLabels[idx] = ci; }));
  const silhouette = calcSilhouette(data, finalLabels, k);
  const daviesBouldin = calcDaviesBouldinFromLabels(data, finalLabels, k);
  const calinskiHarabasz = calcCalinskiHarabasz(data, finalLabels, k);
  return {
    labels: finalLabels, k, silhouette,
    daviesBouldin: Math.round(daviesBouldin * 1000) / 1000,
    calinskiHarabasz: Math.round(calinskiHarabasz * 100) / 100,
    stats: buildStats(finalLabels, data, k)
  };
}

/* ─── Internal validation metrics ─── */
function calcSilhouette(data: number[][], labels: number[], k: number): number {
  if (k < 2 || data.length < 4) return 0;
  const sampleSize = Math.min(data.length, 300);
  const indices = data.length > sampleSize
    ? Array.from({ length: sampleSize }, () => Math.floor(Math.random() * data.length))
    : data.map((_, i) => i);
  const scores = indices.map(i => {
    const p = data[i];
    const same = data.filter((_, j) => labels[j] === labels[i] && j !== i);
    if (same.length === 0) return 0;
    const a = same.reduce((s, q) => s + euclidean(p, q), 0) / same.length;
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === labels[i]) continue;
      const other = data.filter((_, j) => labels[j] === c);
      if (other.length === 0) continue;
      const avg = other.reduce((s, q) => s + euclidean(p, q), 0) / other.length;
      if (avg < b) b = avg;
    }
    return b === Infinity ? 0 : (b - a) / Math.max(a, b);
  });
  return Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 1000) / 1000;
}

function calcDaviesBouldin(data: number[][], labels: number[], centroids: number[][], k: number): number {
  const scatters = centroids.map((c, ci) => {
    const pts = data.filter((_, i) => labels[i] === ci);
    if (pts.length === 0) return 0;
    return pts.reduce((s, p) => s + euclidean(p, c), 0) / pts.length;
  });
  let db = 0;
  for (let i = 0; i < k; i++) {
    let maxR = 0;
    for (let j = 0; j < k; j++) {
      if (i === j) continue;
      const sep = euclidean(centroids[i], centroids[j]);
      if (sep === 0) continue;
      const R = (scatters[i] + scatters[j]) / sep;
      if (R > maxR) maxR = R;
    }
    db += maxR;
  }
  return db / k;
}

function calcDaviesBouldinFromLabels(data: number[][], labels: number[], k: number): number {
  const centroids = Array.from({ length: k }, (_, ci) => {
    const pts = data.filter((_, i) => labels[i] === ci);
    if (pts.length === 0) return new Array(data[0].length).fill(0);
    return data[0].map((_, d) => pts.reduce((s, p) => s + p[d], 0) / pts.length);
  });
  return calcDaviesBouldin(data, labels, centroids, k);
}

function calcCalinskiHarabasz(data: number[][], labels: number[], k: number): number {
  if (k < 2 || data.length < k + 1) return 0;
  const n = data.length, dim = data[0].length;
  const globalMean = Array.from({ length: dim }, (_, d) => data.reduce((s, p) => s + p[d], 0) / n);
  const centroids = Array.from({ length: k }, (_, ci) => {
    const pts = data.filter((_, i) => labels[i] === ci);
    if (pts.length === 0) return globalMean;
    return Array.from({ length: dim }, (_, d) => pts.reduce((s, p) => s + p[d], 0) / pts.length);
  });
  let bgss = 0, wgss = 0;
  for (let ci = 0; ci < k; ci++) {
    const pts = data.filter((_, i) => labels[i] === ci);
    bgss += pts.length * euclidean(centroids[ci], globalMean) ** 2;
    wgss += pts.reduce((s, p) => s + euclidean(p, centroids[ci]) ** 2, 0);
  }
  if (wgss === 0) return 0;
  return (bgss / (k - 1)) / (wgss / (n - k));
}

function detectOptimalK(data: number[][], maxK = 10): { optimalK: number; elbowPoints: ElbowPoint[] } {
  const results: ElbowPoint[] = [];
  const kMax = Math.min(maxK, Math.floor(data.length / 2), 10);
  for (let k = 2; k <= kMax; k++) {
    const res = kmeansOnce(data, k, 50);
    results.push({ k, inertia: res.inertia ?? 0, silhouette: res.silhouette ?? 0 });
  }
  let elbowK = 3;
  if (results.length >= 3) {
    let maxKnee = -Infinity;
    for (let i = 1; i < results.length - 1; i++) {
      const knee = results[i - 1].inertia - 2 * results[i].inertia + results[i + 1].inertia;
      if (knee > maxKnee) { maxKnee = knee; elbowK = results[i].k; }
    }
  }
  const silhouetteK = results.reduce((best, r) => r.silhouette > best.silhouette ? r : best, results[0])?.k ?? 3;
  const bestSil = results.find(r => r.k === silhouetteK)?.silhouette ?? 0;
  const elbowSil = results.find(r => r.k === elbowK)?.silhouette ?? 0;
  const optimalK = bestSil > elbowSil + 0.05 ? silhouetteK : elbowK;
  return { optimalK, elbowPoints: results };
}

function detectDbscanEps(data: number[][], minPts: number): number {
  const k = minPts;
  const kDists = data.map(p => {
    const dists = data.map(q => euclidean(p, q)).sort((a, b) => a - b);
    return dists[k] ?? dists[dists.length - 1];
  }).sort((a, b) => a - b);
  let maxJump = -Infinity, elbowIdx = Math.floor(kDists.length * 0.9);
  for (let i = 1; i < kDists.length; i++) {
    const jump = kDists[i] - kDists[i - 1];
    if (jump > maxJump) { maxJump = jump; elbowIdx = i; }
  }
  return Math.round(kDists[elbowIdx] * 100) / 100;
}

function buildStats(labels: number[], data: number[][], k: number): ClusterStat[] {
  const n = data.length;
  const uniqueLabels = [...new Set(labels)].sort((a, b) => a - b);
  return uniqueLabels.map(id => {
    const idxs = labels.map((l, i) => l === id ? i : -1).filter(i => i >= 0);
    return { id, count: idxs.length, pct: Math.round(idxs.length / n * 1000) / 10, means: {} };
  });
}

/* ═══════════════════════════════════════════════════════════════
   FEATURE SCALING
═══════════════════════════════════════════════════════════════ */
function scaleMinMax(vectors: number[][]): number[][] {
  const dim = vectors[0].length;
  const mins = Array.from({ length: dim }, (_, ci) => Math.min(...vectors.map(v => v[ci])));
  const maxs = Array.from({ length: dim }, (_, ci) => Math.max(...vectors.map(v => v[ci])));
  return vectors.map(v => v.map((val, ci) => maxs[ci] === mins[ci] ? 0 : (val - mins[ci]) / (maxs[ci] - mins[ci])));
}

function scaleStandard(vectors: number[][]): number[][] {
  const dim = vectors[0].length;
  const n = vectors.length;
  const means = Array.from({ length: dim }, (_, ci) => vectors.reduce((s, v) => s + v[ci], 0) / n);
  const stds = Array.from({ length: dim }, (_, ci) => {
    const variance = vectors.reduce((s, v) => s + (v[ci] - means[ci]) ** 2, 0) / n;
    return Math.sqrt(variance) || 1;
  });
  return vectors.map(v => v.map((val, ci) => (val - means[ci]) / stds[ci]));
}

function scaleRobust(vectors: number[][]): number[][] {
  const dim = vectors[0].length;
  const medians = Array.from({ length: dim }, (_, ci) => {
    const sorted = vectors.map(v => v[ci]).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  });
  const iqrs = Array.from({ length: dim }, (_, ci) => {
    const sorted = vectors.map(v => v[ci]).sort((a, b) => a - b);
    const n = sorted.length;
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    return (q3 - q1) || 1;
  });
  return vectors.map(v => v.map((val, ci) => (val - medians[ci]) / iqrs[ci]));
}

function applyScaling(vectors: number[][], method: ScalingMethod): number[][] {
  if (method === "minmax") return scaleMinMax(vectors);
  if (method === "standard") return scaleStandard(vectors);
  if (method === "robust") return scaleRobust(vectors);
  return vectors;
}

/* ═══════════════════════════════════════════════════════════════
   DOWNLOAD HELPERS
═══════════════════════════════════════════════════════════════ */
function triggerDownload(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
function stripExt(name: string) { return name.replace(/\.[^/.]+$/, ""); }

function downloadCSV(rawData: DataRow[], columns: string[], result: ClusterResult, fileName: string, algo: Algorithm) {
  const clusterHeader = algo === "dbscan" ? "cluster_label" : "cluster";
  const headers = [clusterHeader, ...columns];
  const rows = rawData.map((row, i) => {
    const label = result.labels[i];
    const clusterName = label === -1 ? "Noise" : `Cluster_${label + 1}`;
    return [clusterName, ...columns.map(c => {
      const val = row[c];
      const str = String(val);
      return str.includes(",") ? `"${str}"` : str;
    })].join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${stripExt(fileName)}_clustering_result.csv`);
}

function downloadJSON(rawData: DataRow[], columns: string[], result: ClusterResult, fileName: string, algo: Algorithm, elbowPoints: ElbowPoint[], optimalK: number, scaling: ScalingMethod | null) {
  const labeledData = rawData.map((row, i) => ({
    ...row,
    cluster: result.labels[i] === -1 ? "Noise" : `Cluster_${result.labels[i] + 1}`,
    cluster_id: result.labels[i],
  }));
  const payload = {
    meta: { exported_at: new Date().toISOString(), source_file: fileName, algorithm: algo, total_rows: rawData.length, numeric_columns: columns },
    parameters: { scaling_method: scaling, ...(algo !== "dbscan" ? { k: result.k } : {}), ...(algo === "dbscan" ? { noise_points: result.noise } : {}) },
    metrics: { silhouette_score: result.silhouette, davies_bouldin_index: result.daviesBouldin ?? null, calinski_harabasz_score: result.calinskiHarabasz ?? null, inertia: result.inertia ?? null, iterations: result.iterations ?? null },
    cluster_stats: result.stats,
    ...(elbowPoints.length > 0 ? { elbow_analysis: { optimal_k: optimalK, points: elbowPoints } } : {}),
    data: labeledData,
  };
  triggerDownload(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `${stripExt(fileName)}_clustering_result.json`);
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

function downloadElbowPNG(svgEl: SVGSVGElement, fileName: string) {
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  const scale = 2;
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = (svgEl.clientWidth || 640) * scale;
    canvas.height = 340 * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f8f8f6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob(blob => { if (blob) triggerDownload(blob, `${stripExt(fileName)}_elbow_chart.png`); }, "image/png");
  };
  img.src = url;
}

/* ─── Warna cluster ─── */
const CLUSTER_COLORS = ["#6366f1","#f59e0b","#10b981","#ef4444","#a855f7","#06b6d4","#f97316","#84cc16","#ec4899","#14b8a6"];
const NOISE_COLOR = "#9ca3af";

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT (LENGKAP + RESPONSIF + QUOTA)
═══════════════════════════════════════════════════════════════ */
export default function ClusteringPage() {
  const router = useRouter();
  const { quota, consume } = useQuota();
  const fileRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const elbowRef = useRef<SVGSVGElement>(null);
  const dlMenuRef = useRef<HTMLDivElement>(null);

  const [rawData, setRawData] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [numCols, setNumCols] = useState<string[]>([]);
  const [axisX, setAxisX] = useState("");
  const [axisY, setAxisY] = useState("");
  const [algo, setAlgo] = useState<Algorithm>("kmeans");
  const [k, setK] = useState(3);
  const [eps, setEps] = useState(0.5);
  const [minPts, setMinPts] = useState(5);
  const [autoK, setAutoK] = useState(true);
  const [autoEps, setAutoEps] = useState(true);
  const [result, setResult] = useState<ClusterResult | null>(null);
  const [elbowPoints, setElbowPoints] = useState<ElbowPoint[]>([]);
  const [optimalK, setOptimalK] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"chart"|"elbow"|"table"|"stats"|"insight">("chart");
  const [page, setPage] = useState(0);
  const [suggestion, setSuggestion] = useState<string>("");
  const [showDlMenu, setShowDlMenu] = useState(false);
  const [scaling, setScaling] = useState<ScalingMethod>("minmax");
  const [showScalingInfo, setShowScalingInfo] = useState(false);
  const [insight, setInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState("");
  const [insightDone, setInsightDone] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const PAGE_SIZE = 20;

  // Reset insight
  function resetInsight() {
    setInsight("");
    setInsightDone(false);
    setInsightError("");
    setInsightLoading(false);
  }

  // Parse CSV sederhana
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

  // Handle upload + quota
  async function handleFile(file: File) {
    setError("");
    setResult(null);
    setElbowPoints([]);
    setOptimalK(null);
    setSuggestion("");
    setFileName(file.name);
    resetInsight();
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      let rows: DataRow[] = [];
      if (ext === "csv") {
        rows = parseCSV(await file.text());
      } else if (ext === "xlsx" || ext === "xls") {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as DataRow[];
      } else { setError("Format tidak didukung. Gunakan CSV atau XLSX."); return; }
      if (rows.length > 5000) { setError("Data terlalu besar (maks 5000 baris untuk browser)."); return; }
      if (!rows.length) { setError("File kosong atau tidak dapat dibaca."); return; }
      const cols = Object.keys(rows[0]);
      const nums = cols.filter(c => rows.every(r => typeof r[c] === "number" && !isNaN(r[c] as number)));
      if (nums.length < 2) { setError("Minimal 2 kolom numerik diperlukan untuk clustering."); return; }

      // Konsumsi kuota setelah validasi berhasil
      const allowed = await consume();
      if (!allowed) { setShowQuotaModal(true); return; }

      setRawData(rows);
      setColumns(cols);
      setNumCols(nums);
      setAxisX(nums[0]);
      setAxisY(nums[1]);
    } catch (e) { setError("Gagal membaca file: " + (e as Error).message); }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [consume]);

  // Scaling
  function getScaled(): number[][] {
    const vectors = rawData.map(r => numCols.map(c => r[c] as number));
    return applyScaling(vectors, scaling);
  }

  // Auto-analyze
  function analyzeData() {
    if (!rawData.length) return;
    setAnalyzing(true);
    setTimeout(() => {
      const norm = getScaled();
      const { optimalK: ok, elbowPoints: ep } = detectOptimalK(norm);
      setOptimalK(ok);
      setElbowPoints(ep);
      if (autoK && (algo === "kmeans" || algo === "hierarchical")) setK(ok);
      if (autoEps && algo === "dbscan") {
        const suggestedEps = detectDbscanEps(norm, minPts);
        setEps(suggestedEps);
      }
      const bestSilhouette = ep.reduce((b, r) => r.silhouette > b ? r.silhouette : b, 0);
      setSuggestion(`Optimal k=${ok} terdeteksi (silhouette terbaik: ${bestSilhouette.toFixed(3)})`);
      setAnalyzing(false);
    }, 60);
  }

  // Running clustering
  function runClustering() {
    if (!rawData.length || !axisX || !axisY) return;
    setRunning(true); setResult(null); resetInsight();
    setTimeout(() => {
      try {
        const norm = getScaled();
        let res: ClusterResult;
        if (algo === "kmeans") res = kmeans(norm, k);
        else if (algo === "dbscan") res = dbscan(norm, eps, minPts);
        else res = hierarchical(norm, k);

        const uniqueLabels = [...new Set(res.labels)].sort((a, b) => a - b);
        res.stats = uniqueLabels.map(id => {
          const idxs = res.labels.map((l, i) => l === id ? i : -1).filter(i => i >= 0);
          const means: Record<string, number> = {};
          numCols.forEach(col => {
            means[col] = Math.round(idxs.reduce((s, i) => s + (rawData[i][col] as number), 0) / idxs.length * 100) / 100;
          });
          return { id, count: idxs.length, pct: Math.round(idxs.length / rawData.length * 1000) / 10, means };
        });
        setResult(res); setActiveTab("chart"); setPage(0);
        generateInsight(res);
      } catch (e) { setError("Error saat clustering: " + (e as Error).message); }
      setRunning(false);
    }, 50);
  }

  // Generate insight via API (mock, bisa diganti dengan API nyata)
  async function generateInsight(res: ClusterResult) {
    if (!res) return;
    setInsight("");
    setInsightError("");
    setInsightDone(false);
    setInsightLoading(true);
    try {
      // Contoh panggil API /api/insight (pastikan endpoint ada)
      const response = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: res, columns: numCols, total: rawData.length, algo, scaling }),
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

  /* ─── D3 Scatter Plot ─── */
  useEffect(() => {
    if (!result || !svgRef.current || !rawData.length || activeTab !== "chart") return;
    const svg = d3.select(svgRef.current);
    const W = svgRef.current.clientWidth || 680;
    const H = 380;
    const margin = { top: 20, right: 20, bottom: 50, left: 55 };
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${W} ${H}`);

    const xVals = rawData.map(r => r[axisX] as number);
    const yVals = rawData.map(r => r[axisY] as number);
    const xScale = d3.scaleLinear().domain([d3.min(xVals)! * 0.97, d3.max(xVals)! * 1.03]).range([margin.left, W - margin.right]);
    const yScale = d3.scaleLinear().domain([d3.min(yVals)! * 0.97, d3.max(yVals)! * 1.03]).range([H - margin.bottom, margin.top]);

    const g = svg.append("g");
    g.append("g").attr("class","grid").attr("transform",`translate(0,${H-margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(6).tickSize(-(H-margin.top-margin.bottom)).tickFormat(()=>""))
      .selectAll("line").attr("stroke","rgba(0,0,0,0.06)").attr("stroke-dasharray","3,3");
    g.append("g").attr("class","grid").attr("transform",`translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(5).tickSize(-(W-margin.left-margin.right)).tickFormat(()=>""))
      .selectAll("line").attr("stroke","rgba(0,0,0,0.06)").attr("stroke-dasharray","3,3");
    g.selectAll(".grid .domain").remove();

    g.append("g").attr("transform",`translate(0,${H-margin.bottom})`).call(d3.axisBottom(xScale).ticks(6))
      .selectAll("text").attr("fill","#9ca3af").attr("font-size","11").attr("font-family","'DM Mono',monospace");
    g.append("g").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(yScale).ticks(5))
      .selectAll("text").attr("fill","#9ca3af").attr("font-size","11").attr("font-family","'DM Mono',monospace");
    g.selectAll(".domain").attr("stroke","rgba(0,0,0,0.12)");
    g.selectAll(".tick line").attr("stroke","rgba(0,0,0,0.08)");

    svg.append("text").attr("x",W/2).attr("y",H-8).attr("text-anchor","middle")
      .attr("fill","#6b7280").attr("font-size","12").attr("font-family","'DM Mono',monospace").text(axisX);
    svg.append("text").attr("transform","rotate(-90)").attr("x",-H/2).attr("y",14)
      .attr("text-anchor","middle").attr("fill","#6b7280").attr("font-size","12").attr("font-family","'DM Mono',monospace").text(axisY);

    const dots = g.selectAll("circle.dot").data(rawData).enter().append("circle")
      .attr("class","dot")
      .attr("cx",(_,i)=>xScale(rawData[i][axisX] as number))
      .attr("cy",(_,i)=>yScale(rawData[i][axisY] as number))
      .attr("r",0)
      .attr("fill",(_,i)=>result.labels[i]===-1?NOISE_COLOR:CLUSTER_COLORS[result.labels[i]%CLUSTER_COLORS.length])
      .attr("opacity",0.75)
      .attr("stroke","#ffffff").attr("stroke-width",0.8);
    dots.transition().duration(600).delay((_,i)=>i*0.5).attr("r",4.5);

    if (result.centroids && algo==="kmeans") {
      const xiIdx = numCols.indexOf(axisX), yiIdx = numCols.indexOf(axisY);
      const xMin = d3.min(xVals)!, xMax = d3.max(xVals)!, yMin = d3.min(yVals)!, yMax = d3.max(yVals)!;
      result.centroids.forEach((c, ci) => {
        const cx = xScale(xMin + c[xiIdx] * (xMax - xMin));
        const cy = yScale(yMin + c[yiIdx] * (yMax - yMin));
        g.append("circle").attr("cx",cx).attr("cy",cy).attr("r",10).attr("fill",CLUSTER_COLORS[ci%CLUSTER_COLORS.length]).attr("opacity",0.18);
        g.append("circle").attr("cx",cx).attr("cy",cy).attr("r",5).attr("fill",CLUSTER_COLORS[ci%CLUSTER_COLORS.length]).attr("stroke","#fff").attr("stroke-width",2);
        g.append("text").attr("x",cx+8).attr("y",cy-7).attr("fill",CLUSTER_COLORS[ci%CLUSTER_COLORS.length]).attr("font-size","10").attr("font-family","'DM Mono',monospace").attr("font-weight","600").text(`C${ci+1}`);
      });
    }
  }, [result, activeTab, axisX, axisY, rawData, numCols, algo]);

  /* ─── D3 Elbow Chart ─── */
  useEffect(() => {
    if (!elbowRef.current || !elbowPoints.length || activeTab !== "elbow") return;
    const svg = d3.select(elbowRef.current);
    const W = elbowRef.current.clientWidth || 640;
    const H = 340;
    const margin = { top: 30, right: 60, bottom: 50, left: 60 };
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${W} ${H}`);

    const xScale = d3.scaleLinear().domain([elbowPoints[0].k, elbowPoints[elbowPoints.length-1].k]).range([margin.left, W-margin.right]);
    const yInertia = d3.scaleLinear().domain([0, d3.max(elbowPoints, d=>d.inertia)!*1.05]).range([H-margin.bottom, margin.top]);
    const ySil = d3.scaleLinear().domain([0, Math.max(...elbowPoints.map(d=>d.silhouette))*1.1]).range([H-margin.bottom, margin.top]);

    svg.append("g").attr("transform",`translate(0,${H-margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(elbowPoints.length).tickFormat(d=>`k=${d}`))
      .selectAll("text").attr("fill","#9ca3af").attr("font-size","11").attr("font-family","'DM Mono',monospace");
    svg.append("g").attr("transform",`translate(${margin.left},0)`)
      .call(d3.axisLeft(yInertia).ticks(5))
      .selectAll("text").attr("fill","#9ca3af").attr("font-size","10").attr("font-family","'DM Mono',monospace");
    svg.append("g").attr("transform",`translate(${W-margin.right},0)`)
      .call(d3.axisRight(ySil).ticks(5).tickFormat(d=>(+d).toFixed(2)))
      .selectAll("text").attr("fill","#10b981").attr("font-size","10").attr("font-family","'DM Mono',monospace");
    svg.selectAll(".domain").attr("stroke","rgba(0,0,0,0.12)");
    svg.selectAll(".tick line").attr("stroke","rgba(0,0,0,0.08)");

    const inertiaLine = d3.line<ElbowPoint>().x(d=>xScale(d.k)).y(d=>yInertia(d.inertia)).curve(d3.curveMonotoneX);
    svg.append("path").datum(elbowPoints).attr("fill","none").attr("stroke","#6366f1").attr("stroke-width",2.5).attr("d", inertiaLine);
    svg.selectAll("circle.inertia").data(elbowPoints).enter().append("circle")
      .attr("cx",d=>xScale(d.k)).attr("cy",d=>yInertia(d.inertia)).attr("r",4)
      .attr("fill","#6366f1").attr("stroke","#fff").attr("stroke-width",2);

    const silLine = d3.line<ElbowPoint>().x(d=>xScale(d.k)).y(d=>ySil(d.silhouette)).curve(d3.curveMonotoneX);
    svg.append("path").datum(elbowPoints).attr("fill","none").attr("stroke","#10b981").attr("stroke-width",2).attr("stroke-dasharray","5,3").attr("d", silLine);
    svg.selectAll("circle.sil").data(elbowPoints).enter().append("circle")
      .attr("cx",d=>xScale(d.k)).attr("cy",d=>ySil(d.silhouette)).attr("r",3.5)
      .attr("fill","#10b981").attr("stroke","#fff").attr("stroke-width",2);

    if (optimalK) {
      const okPt = elbowPoints.find(p=>p.k===optimalK);
      if (okPt) {
        svg.append("line").attr("x1",xScale(optimalK)).attr("y1",margin.top).attr("x2",xScale(optimalK)).attr("y2",H-margin.bottom)
          .attr("stroke","#f59e0b").attr("stroke-width",1.5).attr("stroke-dasharray","4,3");
        svg.append("text").attr("x",xScale(optimalK)+5).attr("y",margin.top+14)
          .attr("fill","#f59e0b").attr("font-size","11").attr("font-family","'DM Mono',monospace").attr("font-weight","600").text(`optimal k=${optimalK}`);
      }
    }
  }, [elbowPoints, activeTab, optimalK]);

  // Menu download
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dlMenuRef.current && !dlMenuRef.current.contains(e.target as Node)) setShowDlMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const totalPages = Math.ceil(rawData.length / PAGE_SIZE);
  const pagedData = rawData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  /* ─── Sidebar Content (digunakan untuk desktop dan drawer) ─── */
  const sidebarContent = (
    <>
      <div style={s.sideTop}>
        <button style={s.backBtn} onClick={() => router.push("/")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Dashboard
        </button>
        <div style={s.sideTitle}><div style={s.sideDot}/><span>Clustering</span></div>
        <p style={s.sideDesc}>Segmentasi data otomatis menggunakan algoritma ML.</p>
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
              <p style={s.fileRows}>{rawData.length} baris · {numCols.length} numerik</p>
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

      {/* Auto analyze */}
      {rawData.length > 0 && (
        <div style={s.sideSection}>
          <label style={s.sideLabel}>Analisis Otomatis</label>
          <button style={{ ...s.analyzeBtn, ...(analyzing ? s.runBtnDisabled : {}) }} onClick={analyzeData} disabled={analyzing}>
            {analyzing ? "Menganalisis..." : "🔍 Deteksi Optimal k"}
          </button>
          {suggestion && <div style={s.suggestionBadge}>💡 {suggestion}</div>}
        </div>
      )}

      {/* Axis selector */}
      {numCols.length >= 2 && (
        <div style={s.sideSection}>
          <label style={s.sideLabel}>Tampilan Scatter</label>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <p style={s.miniLabel}>Sumbu X</p>
              <select style={s.select} value={axisX} onChange={e => setAxisX(e.target.value)}>
                {numCols.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <p style={s.miniLabel}>Sumbu Y</p>
              <select style={s.select} value={axisY} onChange={e => setAxisY(e.target.value)}>
                {numCols.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Feature scaling */}
      <div style={s.sideSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <label style={{ ...s.sideLabel, marginBottom: 0 }}>Feature Scaling</label>
          <button style={s.infoBtn} onClick={() => setShowScalingInfo(v => !v)}>ⓘ</button>
        </div>
        {showScalingInfo && (
          <div style={s.scalingInfoBox}>
            <div><strong>Min-Max</strong> → [0,1], sensitif outlier</div>
            <div><strong>Z-score</strong> → mean=0, std=1</div>
            <div><strong>Robust</strong> → median & IQR, tahan outlier</div>
            <div><strong>None</strong> → data asli</div>
          </div>
        )}
        <div style={s.scalingGrid}>
          {(["minmax","standard","robust","none"] as ScalingMethod[]).map(m => (
            <button key={m} style={{ ...s.scalingBtn, ...(scaling === m ? { borderColor: "#6366f1", background: "rgba(99,102,241,0.1)", color: "#6366f1" } : {}) }}
              onClick={() => { setScaling(m); setResult(null); setElbowPoints([]); setOptimalK(null); setSuggestion(""); resetInsight(); }}>
              <span>{m === "minmax" ? "Min-Max" : m === "standard" ? "Z-score" : m === "robust" ? "Robust" : "None"}</span>
            </button>
          ))}
        </div>
        {rawData.length > 0 && (
          <div style={s.scalingPreview}>
            {numCols.slice(0, 3).map(col => {
              const vec = getScaled();
              const vals = vec.map(v => v[numCols.indexOf(col)]);
              return <div key={col} style={{ fontSize: 10, fontFamily: "'DM Mono',monospace" }}>{col}: [{vals[0]?.toFixed(2)} …]</div>;
            })}
          </div>
        )}
      </div>

      {/* Algorithm */}
      <div style={s.sideSection}>
        <label style={s.sideLabel}>Algoritma</label>
        {(["kmeans","dbscan","hierarchical"] as Algorithm[]).map(a => (
          <button key={a} style={{ ...s.algoBtn, ...(algo === a ? s.algoBtnActive : {}) }} onClick={() => setAlgo(a)}>
            <div style={{ ...s.algoRadio, ...(algo === a ? s.algoRadioActive : {}) }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{a === "kmeans" ? "K-Means" : a === "dbscan" ? "DBSCAN" : "Hierarchical"}</div>
              <div style={{ fontSize: 10, color: "#9ca3af" }}>{a === "kmeans" ? "Centroid-based" : a === "dbscan" ? "Density-based" : "Linkage-based"}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Parameters */}
      <div style={s.sideSection}>
        <label style={s.sideLabel}>Parameter</label>
        {(algo === "kmeans" || algo === "hierarchical") && (
          <div style={s.paramRow}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Jumlah Cluster (k)</span>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input type="checkbox" checked={autoK} onChange={e => setAutoK(e.target.checked)} />
                <span style={{ fontSize: 10, color: "#f59e0b" }}>auto</span>
              </label>
            </div>
            <input type="range" min={2} max={10} value={k} onChange={e => setK(+e.target.value)} disabled={autoK && optimalK !== null} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>{k}</span>
          </div>
        )}
        {algo === "dbscan" && (
          <>
            <div><span>Epsilon (ε)</span> <input type="range" min={0.05} max={2} step={0.05} value={eps} onChange={e => setEps(+e.target.value)} /> {eps.toFixed(2)}</div>
            <div><span>Min Points</span> <input type="range" min={2} max={20} value={minPts} onChange={e => setMinPts(+e.target.value)} /> {minPts}</div>
          </>
        )}
      </div>

      <button style={{ ...s.runBtn, ...((!rawData.length || running) ? s.runBtnDisabled : {}) }} onClick={runClustering} disabled={!rawData.length || running}>
        {running ? "Memproses..." : "▶ Jalankan Clustering"}
      </button>
    </>
  );

  /* ─── Render utama ─── */
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
              <div>
                <h1 style={s.mainTitle}>Analisis Clustering</h1>
                <p style={s.mainSub}>{result ? `${result.k} cluster · ${rawData.length} data` : "Upload dataset untuk memulai"}</p>
              </div>
            </div>
            {result && (
              <div style={{ position: "relative" }} ref={dlMenuRef}>
                <button style={s.dlBtn} onClick={() => setShowDlMenu(v => !v)}>⬇ Unduh</button>
                {showDlMenu && (
                  <div style={s.dlMenu}>
                    <p style={s.dlMenuTitle}>Pilih Format</p>
                    <button onClick={() => { downloadCSV(rawData, columns, result, fileName, algo); setShowDlMenu(false); }}>📊 CSV (data+label)</button>
                    <button onClick={() => { downloadJSON(rawData, columns, result, fileName, algo, elbowPoints, optimalK || 0, scaling); setShowDlMenu(false); }}>📋 JSON (lengkap)</button>
                    <button onClick={() => { if (svgRef.current) downloadSVGasPNG(svgRef.current, fileName); setShowDlMenu(false); }}>🖼️ Scatter PNG</button>
                    <button onClick={() => { if (elbowRef.current) downloadElbowPNG(elbowRef.current, fileName); setShowDlMenu(false); }}>📐 Elbow PNG</button>
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
              <p style={s.emptySub}>Upload file CSV/Excel di sidebar untuk memulai clustering</p>
              <button className="mobile-upload-cta" style={s.mobileUploadCta} onClick={() => setSidebarOpen(true)}>Upload Dataset</button>
            </div>
          ) : (
            <div style={s.resultsArea}>
              <div style={s.tabs} className="tabs-scroll">
                {["chart","elbow","table","stats","insight"].map(tab => (
                  <button key={tab} style={{ ...s.tab, ...(activeTab === tab ? s.tabActive : {}) }} onClick={() => setActiveTab(tab as any)}>
                    {tab === "chart" ? "📊 Scatter" : tab === "elbow" ? "📐 Elbow" : tab === "table" ? "📋 Data" : tab === "stats" ? "📈 Statistik" : "✨ Insight"}
                  </button>
                ))}
              </div>

              {activeTab === "chart" && (
                <div style={s.chartBox}>
                  {!result ? <div style={s.chartPlaceholder}>Jalankan clustering terlebih dahulu</div> : <svg ref={svgRef} style={{ width: "100%", height: 380 }} />}
                </div>
              )}
              {activeTab === "elbow" && (
                <div style={s.chartBox}>
                  {elbowPoints.length === 0 ? <div style={s.chartPlaceholder}>Klik "Deteksi Optimal k" di sidebar</div> : <svg ref={elbowRef} style={{ width: "100%", height: 340 }} />}
                </div>
              )}
              {activeTab === "table" && (
                <div style={s.tableWrap}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={s.th}>#</th>
                          {result && <th style={{ ...s.th, color: "#6366f1" }}>Cluster</th>}
                          {columns.map(c => <th key={c} style={s.th}>{c}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {pagedData.map((row, ri) => {
                          const globalIdx = page * PAGE_SIZE + ri;
                          const lbl = result?.labels[globalIdx] ?? null;
                          return (
                            <tr key={ri} style={s.tr} className="table-row">
                              <td style={s.tdNum}>{globalIdx + 1}</td>
                              {result && (
                                <td style={s.td}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: "'DM Mono',monospace", padding: "2px 8px", borderRadius: 20, background: lbl === -1 ? "rgba(156,163,175,0.1)" : `${CLUSTER_COLORS[lbl! % CLUSTER_COLORS.length]}18`, color: lbl === -1 ? "#9ca3af" : CLUSTER_COLORS[lbl! % CLUSTER_COLORS.length], border: `1px solid ${lbl === -1 ? "rgba(156,163,175,0.3)" : `${CLUSTER_COLORS[lbl! % CLUSTER_COLORS.length]}40`}` }}>
                                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: lbl === -1 ? "#9ca3af" : CLUSTER_COLORS[lbl! % CLUSTER_COLORS.length] }} />
                                    {lbl === -1 ? "Noise" : `C${lbl! + 1}`}
                                  </span>
                                </td>
                              )}
                              {columns.map(c => <td key={c} style={s.td}>{typeof row[c] === "number" ? (row[c] as number).toLocaleString() : String(row[c])}</td>)}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={s.pagination}>
                    <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rawData.length)} dari {rawData.length}</span>
                    <div><button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>‹</button><button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>›</button></div>
                  </div>
                </div>
              )}
              {activeTab === "stats" && (
                <div style={s.statsWrap}>
                  {!result ? <p>Jalankan clustering</p> : (
                    <>
                      <h3>Statistik Cluster</h3>
                      {result.stats.map(stat => (
                        <div key={stat.id} style={s.clusterCard}>
                          <div><strong>{stat.id === -1 ? "Noise" : `Cluster ${stat.id + 1}`}</strong> ({stat.count} data, {stat.pct}%)</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                            {Object.entries(stat.means).map(([col, val]) => <span key={col} style={{ fontSize: 11, background: "#f3f4f6", padding: "2px 6px", borderRadius: 12 }}>{col}: {val}</span>)}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
              {activeTab === "insight" && (
                <div style={s.statsWrap}>
                  {!result ? <p>Jalankan clustering untuk menghasilkan insight</p> : (
                    <div>
                      {insightLoading && <div>Menghasilkan insight...</div>}
                      {insightError && <div style={{ color: "red" }}>Error: {insightError}</div>}
                      {insight && <div style={{ whiteSpace: "pre-wrap" }}>{insight}</div>}
                      {!insight && !insightLoading && <button onClick={() => generateInsight(result)}>Generate Insight</button>}
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
  backBtn: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", fontFamily: "'Outfit',sans-serif", padding: 0, marginBottom: 20, fontWeight: 500 },
  sideTitle: { display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, marginBottom: 6 },
  sideDot: { width: 8, height: 8, borderRadius: "50%", background: "#6366f1" },
  sideDesc: { fontSize: 11.5, color: "#9ca3af", lineHeight: 1.6, marginBottom: 0 },
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
  fileName: { fontSize: 11.5, fontWeight: 600, color: "#1a1a2e", wordBreak: "break-all", marginBottom: 3 },
  fileRows: { fontSize: 10.5, color: "#9ca3af", fontFamily: "'DM Mono',monospace" },
  errMsg: { fontSize: 11, color: "#ef4444", marginTop: 6, lineHeight: 1.5 },
  analyzeBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "10px 0", background: "rgba(245,158,11,0.12)", border: "1.5px solid rgba(245,158,11,0.35)", borderRadius: 9, color: "#d97706", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  runBtnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  suggestionBadge: { display: "flex", alignItems: "flex-start", gap: 6, marginTop: 8, padding: "7px 10px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, fontSize: 10.5, color: "#92400e", fontFamily: "'DM Mono',monospace", lineHeight: 1.5 },
  miniLabel: { fontSize: 10, color: "#9ca3af", marginBottom: 4, fontFamily: "'DM Mono',monospace" },
  select: { width: "100%", padding: "7px 10px", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, fontSize: 12, color: "#1a1a2e", fontFamily: "'Outfit',sans-serif", outline: "none" },
  infoBtn: { background: "none", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#9ca3af" },
  scalingInfoBox: { background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.12)", borderRadius: 9, padding: "10px 12px", marginBottom: 10, fontSize: 10 },
  scalingGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 },
  scalingBtn: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: "8px 6px", background: "rgba(255,255,255,0.6)", border: "1.5px solid rgba(0,0,0,0.1)", borderRadius: 9, cursor: "pointer", fontSize: 11, transition: "all 0.18s" },
  scalingPreview: { background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8, padding: "8px 10px", fontSize: 10, fontFamily: "'DM Mono',monospace" },
  algoBtn: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, cursor: "pointer", textAlign: "left", width: "100%", marginBottom: 6 },
  algoBtnActive: { background: "rgba(99,102,241,0.07)", borderColor: "rgba(99,102,241,0.3)" },
  algoRadio: { width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", flexShrink: 0 },
  algoRadioActive: { border: "4px solid #6366f1" },
  paramRow: { marginBottom: 12 },
  runBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20, padding: "13px 0", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(99,102,241,0.3)" },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  mainHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexWrap: "wrap", gap: 12 },
  mainTitle: { fontSize: 18, fontWeight: 800, color: "#1a1a2e", marginBottom: 2 },
  mainSub: { fontSize: 11, color: "#9ca3af", fontFamily: "'DM Mono',monospace" },
  mobileMenuBtn: { display: "none", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 9, cursor: "pointer", flexShrink: 0 },
  mobileQuotaBar: { display: "none", padding: "10px 20px", background: "rgba(240,240,237,0.6)", borderBottom: "1px solid rgba(0,0,0,0.06)" },
  mobileUploadCta: { display: "none" },
  emptyState: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyIcon: { fontSize: 48, opacity: 0.5 },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: "#6b7280" },
  emptySub: { fontSize: 12, color: "#9ca3af", textAlign: "center", maxWidth: 280 },
  resultsArea: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  tabs: { display: "flex", gap: 0, borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "0 24px", overflowX: "auto", whiteSpace: "nowrap" },
  tab: { padding: "11px 14px", fontSize: 12, fontWeight: 500, color: "#9ca3af", background: "none", border: "none", borderBottom: "2px solid transparent", cursor: "pointer", fontFamily: "'Outfit',sans-serif", display: "inline-flex", alignItems: "center", gap: 5 },
  tabActive: { color: "#6366f1", borderBottomColor: "#6366f1", fontWeight: 700 },
  chartBox: { flex: 1, padding: "20px 24px", overflow: "auto" },
  chartPlaceholder: { height: 280, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px dashed rgba(0,0,0,0.1)", borderRadius: 12, fontSize: 13, color: "#9ca3af" },
  tableWrap: { flex: 1, overflow: "auto", padding: "20px 24px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: { padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9ca3af", background: "#f8f8f6", borderBottom: "1px solid rgba(0,0,0,0.07)", whiteSpace: "nowrap", fontFamily: "'DM Mono',monospace" },
  tr: { borderBottom: "1px solid rgba(0,0,0,0.05)", transition: "background 0.15s" },
  td: { padding: "8px 12px", color: "#374151", whiteSpace: "nowrap", fontFamily: "'DM Mono',monospace", fontSize: 11.5 },
  tdNum: { padding: "8px 12px", color: "#d1d5db", fontFamily: "'DM Mono',monospace", fontSize: 11.5 },
  pagination: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", borderTop: "1px solid rgba(0,0,0,0.06)", background: "#f8f8f6", fontSize: 12 },
  statsWrap: { flex: 1, overflow: "auto", padding: "20px 24px" },
  clusterCard: { background: "#fff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: "12px 16px", marginBottom: 12 },
  dlBtn: { display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#1a1a2e", border: "none", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit',sans-serif" },
  dlMenu: { position: "absolute", top: "calc(100% + 8px)", right: 0, width: 240, background: "#fff", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.13)", zIndex: 200, padding: "10px 0" },
  dlMenuTitle: { fontSize: 9.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#9ca3af", fontFamily: "'DM Mono',monospace", padding: "4px 12px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)", marginBottom: 4 },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700;800&display=swap');
  @keyframes quotaModalIn { from { opacity:0; transform:scale(0.92) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .quota-modal-in { animation: quotaModalIn 0.3s cubic-bezier(.34,1.56,.64,1) both; }
  .table-row:hover { background: rgba(99,102,241,0.03); }
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