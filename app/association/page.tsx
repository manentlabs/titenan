"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";

/* ═══════════════════════════════════════════════════════════════
   QUOTA (server-side via API) – same as other pages
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
   TYPES & ASSOCIATION ALGORITHMS (Apriori, FP‑Growth, Eclat)
═══════════════════════════════════════════════════════════════ */
type Algorithm = "apriori" | "fpgrowth" | "eclat";
type DataRow = Record<string, string | number>;
type Transaction = Set<string>;
type Rule = {
  antecedent: string[];
  consequent: string[];
  support: number;
  confidence: number;
  lift: number;
  conviction: number;
  leverage: number;
};
type AssociationResult = {
  rules: Rule[];
  frequentItemsets: Map<string, number>;
  numTransactions: number;
  uniqueItems: string[];
  params: { minSupport: number; minConfidence: number; minLift: number; maxLength: number };
  executionTime: number;
};

function itemsetKey(items: string[]): string {
  return [...items].sort().join("|");
}
function supportCount(transactions: Transaction[], itemset: string[]): number {
  return transactions.filter(tx => itemset.every(item => tx.has(item))).length;
}

// Apriori
function apriori(transactions: Transaction[], minSup: number, maxLen: number): Map<string, number> {
  const minSupCount = Math.ceil(minSup * transactions.length);
  const freqItemsets = new Map<string, number>();
  const itemCounts = new Map<string, number>();
  for (const tx of transactions) {
    for (const item of tx) {
      itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
    }
  }
  let prevLevel: string[][] = [];
  for (const [item, cnt] of itemCounts.entries()) {
    if (cnt >= minSupCount) {
      freqItemsets.set(itemsetKey([item]), cnt);
      prevLevel.push([item]);
    }
  }
  let k = 2;
  while (prevLevel.length > 0 && k <= maxLen) {
    const candidates: string[][] = [];
    for (let i = 0; i < prevLevel.length; i++) {
      for (let j = i + 1; j < prevLevel.length; j++) {
        const a = prevLevel[i];
        const b = prevLevel[j];
        if (a.slice(0, k - 2).every((v, idx) => v === b[idx])) {
          const newSet = [...new Set([...a, ...b])].sort();
          if (newSet.length === k) candidates.push(newSet);
        }
      }
    }
    const newLevel: string[][] = [];
    for (const cand of candidates) {
      const cnt = supportCount(transactions, cand);
      if (cnt >= minSupCount) {
        freqItemsets.set(itemsetKey(cand), cnt);
        newLevel.push(cand);
      }
    }
    prevLevel = newLevel;
    k++;
  }
  return freqItemsets;
}

function getNonEmptySubsets<T>(arr: T[]): T[][] {
  const result: T[][] = [];
  const total = 1 << arr.length;
  for (let i = 1; i < total - 1; i++) {
    const subset: T[] = [];
    for (let j = 0; j < arr.length; j++) {
      if (i & (1 << j)) subset.push(arr[j]);
    }
    result.push(subset);
  }
  return result;
}

function generateRules(
  freqItemsets: Map<string, number>,
  transactions: Transaction[],
  minConf: number,
  minLift: number,
  totalTrans: number
): Rule[] {
  const rules: Rule[] = [];
  for (const [key, supCount] of freqItemsets.entries()) {
    const items = key.split("|");
    if (items.length < 2) continue;
    const subsets = getNonEmptySubsets(items);
    for (const antecedent of subsets) {
      const consequent = items.filter(i => !antecedent.includes(i));
      if (consequent.length === 0) continue;
      const antKey = itemsetKey(antecedent);
      const antSup = freqItemsets.get(antKey);
      if (!antSup) continue;
      const confidence = supCount / antSup;
      if (confidence < minConf) continue;
      const support = supCount / totalTrans;
      const lift = confidence / ((freqItemsets.get(itemsetKey(consequent)) || 0) / totalTrans);
      if (lift < minLift) continue;
      const conv = (1 - ((freqItemsets.get(itemsetKey(consequent)) || 0) / totalTrans)) / (1 - confidence);
      const leverage = support - (antSup / totalTrans) * ((freqItemsets.get(itemsetKey(consequent)) || 0) / totalTrans);
      rules.push({ antecedent, consequent, support, confidence, lift, conviction: conv, leverage });
    }
  }
  const unique = new Map<string, Rule>();
  for (const r of rules) {
    const key = `${itemsetKey(r.antecedent)}→${itemsetKey(r.consequent)}`;
    if (!unique.has(key) || r.confidence > unique.get(key)!.confidence) unique.set(key, r);
  }
  return Array.from(unique.values());
}

// FP‑Growth
class FPNode {
  item: string;
  count: number;
  parent: FPNode | null;
  children: Map<string, FPNode>;
  next: FPNode | null;
  constructor(item: string) {
    this.item = item;
    this.count = 1;
    this.parent = null;
    this.children = new Map();
    this.next = null;
  }
}
function buildFPtree(transactions: Transaction[], minSupCount: number): { root: FPNode; headerTable: Map<string, { count: number; node: FPNode | null }> } {
  const freq = new Map<string, number>();
  for (const tx of transactions) {
    for (const item of tx) {
      freq.set(item, (freq.get(item) || 0) + 1);
    }
  }
  const headerTable = new Map<string, { count: number; node: FPNode | null }>();
  for (const [item, cnt] of freq.entries()) {
    if (cnt >= minSupCount) headerTable.set(item, { count: cnt, node: null });
  }
  const root = new FPNode("null");
  for (const tx of transactions) {
    const sortedItems = Array.from(tx).filter(item => headerTable.has(item)).sort((a, b) => headerTable.get(b)!.count - headerTable.get(a)!.count);
    let currentNode = root;
    for (const item of sortedItems) {
      let child = currentNode.children.get(item);
      if (!child) {
        child = new FPNode(item);
        child.parent = currentNode;
        currentNode.children.set(item, child);
        const header = headerTable.get(item)!;
        if (header.node === null) header.node = child;
        else {
          let n = header.node;
          while (n.next) n = n.next;
          n.next = child;
        }
      } else {
        child.count++;
      }
      currentNode = child;
    }
  }
  return { root, headerTable };
}
function mineFPtree(headerTable: Map<string, { count: number; node: FPNode | null }>, minSupCount: number, prefix: string[], freqItemsets: Map<string, number>) {
  const items = Array.from(headerTable.keys()).sort((a, b) => headerTable.get(b)!.count - headerTable.get(a)!.count);
  for (const item of items) {
    const newPrefix = [item, ...prefix];
    const support = headerTable.get(item)!.count;
    if (support >= minSupCount) {
      freqItemsets.set(itemsetKey(newPrefix), support);
      const condPatterns: string[][] = [];
      let node = headerTable.get(item)!.node;
      while (node) {
        let path: string[] = [];
        let cur = node.parent;
        while (cur && cur.item !== "null") {
          path.push(cur.item);
          cur = cur.parent;
        }
        if (path.length > 0) {
          for (let i = 0; i < node.count; i++) condPatterns.push(path);
        }
        node = node.next;
      }
      if (condPatterns.length > 0) {
        const condTrans = condPatterns.map(p => new Set(p));
        const { headerTable: condHeader } = buildFPtree(condTrans, minSupCount);
        if (condHeader.size > 0) mineFPtree(condHeader, minSupCount, newPrefix, freqItemsets);
      }
    }
  }
}
function fpgrowth(transactions: Transaction[], minSup: number, maxLen: number): Map<string, number> {
  const minSupCount = Math.ceil(minSup * transactions.length);
  const { headerTable } = buildFPtree(transactions, minSupCount);
  const freqItemsets = new Map<string, number>();
  mineFPtree(headerTable, minSupCount, [], freqItemsets);
  const filtered = new Map<string, number>();
  for (const [key, val] of freqItemsets.entries()) {
    if (key.split("|").length <= maxLen) filtered.set(key, val);
  }
  return filtered;
}

// Eclat
function eclat(transactions: Transaction[], minSup: number, maxLen: number): Map<string, number> {
  const minSupCount = Math.ceil(minSup * transactions.length);
  const tidLists = new Map<string, Set<number>>();
  const itemMap = new Map<string, number>();
  for (let i = 0; i < transactions.length; i++) {
    for (const item of transactions[i]) {
      if (!tidLists.has(item)) tidLists.set(item, new Set());
      tidLists.get(item)!.add(i);
      itemMap.set(item, (itemMap.get(item) || 0) + 1);
    }
  }
  for (const [item, cnt] of itemMap.entries()) {
    if (cnt < minSupCount) tidLists.delete(item);
  }
  const freqItemsets = new Map<string, number>();
  const items = Array.from(tidLists.keys()).sort();
  for (const item of items) {
    const tidSet = tidLists.get(item)!;
    freqItemsets.set(itemsetKey([item]), tidSet.size);
  }
  function eclatRecur(prefix: string[], tidSet: Set<number>, candidates: string[]) {
    for (let i = 0; i < candidates.length; i++) {
      const newPrefix = [...prefix, candidates[i]];
      const newTidSet = new Set<number>();
      for (const tid of tidSet) {
        if (tidLists.get(candidates[i])!.has(tid)) newTidSet.add(tid);
      }
      if (newTidSet.size >= minSupCount && newPrefix.length <= maxLen) {
        freqItemsets.set(itemsetKey(newPrefix), newTidSet.size);
        const remaining = candidates.slice(i + 1);
        if (remaining.length > 0 && newPrefix.length < maxLen) {
          eclatRecur(newPrefix, newTidSet, remaining);
        }
      }
    }
  }
  for (let i = 0; i < items.length; i++) {
    const prefix = [items[i]];
    const tidSet = tidLists.get(items[i])!;
    const remaining = items.slice(i + 1);
    eclatRecur(prefix, tidSet, remaining);
  }
  return freqItemsets;
}

function runAssociation(
  transactions: Transaction[],
  algo: Algorithm,
  minSupport: number,
  minConfidence: number,
  minLift: number,
  maxLength: number
): AssociationResult {
  const start = performance.now();
  let freqItemsets: Map<string, number>;
  if (algo === "apriori") freqItemsets = apriori(transactions, minSupport, maxLength);
  else if (algo === "fpgrowth") freqItemsets = fpgrowth(transactions, minSupport, maxLength);
  else freqItemsets = eclat(transactions, minSupport, maxLength);
  const rules = generateRules(freqItemsets, transactions, minConfidence, minLift, transactions.length);
  const end = performance.now();
  const uniqueItems = Array.from(new Set(transactions.flatMap(tx => Array.from(tx)))).sort();
  return {
    rules,
    frequentItemsets: freqItemsets,
    numTransactions: transactions.length,
    uniqueItems,
    params: { minSupport, minConfidence, minLift, maxLength },
    executionTime: end - start,
  };
}

// Data preprocessing
type InputFormat = "single_column" | "multi_binary";
function parseTransactions(rows: DataRow[], format: InputFormat, itemColumn: string, delimiter: string): Transaction[] {
  if (format === "single_column") {
    return rows.map(row => {
      const val = String(row[itemColumn] || "");
      const items = val.split(delimiter).map(s => s.trim()).filter(s => s.length > 0);
      return new Set(items);
    });
  } else {
    const itemCols = Object.keys(rows[0]).filter(col => {
      const sample = rows[0][col];
      return typeof sample === "number" || sample === "0" || sample === "1" || sample === "yes" || sample === "no";
    });
    return rows.map(row => {
      const items = new Set<string>();
      for (const col of itemCols) {
        const val = row[col];
        const isTrue = val === 1 || val === "1" || val === "yes" || val === "true";
        if (isTrue) items.add(col);
      }
      return items;
    });
  }
}

/* ─── Download helpers ─── */
function stripExt(name: string) { return name.replace(/\.[^/.]+$/, ""); }
function triggerDownload(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
function downloadRulesCSV(rules: Rule[], fileName: string) {
  const headers = ["antecedent", "consequent", "support", "confidence", "lift", "conviction", "leverage"];
  const rows = rules.map(r => [
    r.antecedent.join(","),
    r.consequent.join(","),
    r.support.toFixed(4),
    r.confidence.toFixed(4),
    r.lift.toFixed(4),
    r.conviction.toFixed(4),
    r.leverage.toFixed(4),
  ]);
  const csv = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
  triggerDownload(new Blob([csv], { type: "text/csv" }), `${stripExt(fileName)}_rules.csv`);
}
function downloadJSON(result: AssociationResult, fileName: string, algo: Algorithm) {
  const payload = {
    meta: { exported_at: new Date().toISOString(), source_file: fileName, algorithm: algo, num_transactions: result.numTransactions, unique_items: result.uniqueItems },
    parameters: result.params,
    execution_time_ms: result.executionTime,
    rules: result.rules,
    frequent_itemsets: Object.fromEntries(Array.from(result.frequentItemsets.entries()).map(([k, v]) => [k, v])),
  };
  triggerDownload(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `${stripExt(fileName)}_association.json`);
}
function downloadGraphPNG(svgEl: SVGSVGElement, fileName: string) {
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  const scale = 2;
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = (svgEl.clientWidth || 800) * scale;
    canvas.height = (svgEl.clientHeight || 500) * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f8f8f6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob(blob => {
      if (blob) triggerDownload(blob, `${stripExt(fileName)}_graph.png`);
    }, "image/png");
  };
  img.src = url;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT (with Quota & Responsive Mobile)
═══════════════════════════════════════════════════════════════ */
export default function AssociationPage() {
  const router = useRouter();
  const { quota, consume } = useQuota();
  const fileRef = useRef<HTMLInputElement>(null);
  const graphRef = useRef<SVGSVGElement>(null);
  const dlMenuRef = useRef<HTMLDivElement>(null);

  const [rawData, setRawData] = useState<DataRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [format, setFormat] = useState<InputFormat>("single_column");
  const [itemColumn, setItemColumn] = useState("");
  const [delimiter, setDelimiter] = useState(",");
  const [availableCols, setAvailableCols] = useState<string[]>([]);
  const [algo, setAlgo] = useState<Algorithm>("apriori");
  const [minSupport, setMinSupport] = useState(0.02);
  const [minConfidence, setMinConfidence] = useState(0.6);
  const [minLift, setMinLift] = useState(1.0);
  const [maxLength, setMaxLength] = useState(3);
  const [result, setResult] = useState<AssociationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<"rules" | "graph" | "table" | "insight">("rules");
  const [showDlMenu, setShowDlMenu] = useState(false);
  const [insight, setInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState("");
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close download menu
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dlMenuRef.current && !dlMenuRef.current.contains(e.target as Node)) setShowDlMenu(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
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
      setAvailableCols(cols);
      
      // Konsumsi kuota setelah validasi berhasil
      const allowed = await consume();
      if (!allowed) { setShowQuotaModal(true); return; }

      setRawData(rows);
      if (cols.length) setItemColumn(cols[0]);
    } catch (e) {
      setError("Gagal membaca file: " + (e as Error).message);
    }
  }

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

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [consume]);

  function runAssociationMining() {
    if (!rawData.length) return;
    if (format === "single_column" && !itemColumn) {
      setError("Pilih kolom yang berisi item (separator)");
      return;
    }
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      try {
        let transactions: Transaction[];
        if (format === "single_column") {
          transactions = parseTransactions(rawData, "single_column", itemColumn, delimiter);
        } else {
          transactions = parseTransactions(rawData, "multi_binary", "", "");
        }
        transactions = transactions.filter(tx => tx.size > 0);
        if (transactions.length === 0) throw new Error("Tidak ada transaksi yang valid");
        const res = runAssociation(transactions, algo, minSupport, minConfidence, minLift, maxLength);
        setResult(res);
        setActiveTab("rules");
        generateInsight(res);
      } catch (e) {
        setError("Error: " + (e as Error).message);
      }
      setRunning(false);
    }, 50);
  }

  async function generateInsight(res: AssociationResult) {
    setInsight("");
    setInsightError("");
    setInsightLoading(true);
    try {
      const response = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "association",
          result: {
            num_rules: res.rules.length,
            top_rules: res.rules.slice(0, 10).map(r => ({
              antecedent: r.antecedent,
              consequent: r.consequent,
              support: r.support,
              confidence: r.confidence,
              lift: r.lift,
            })),
            params: res.params,
            num_transactions: res.numTransactions,
            algorithm: algo,
          },
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
    } catch (err: any) {
      setInsightError(err.message);
    } finally {
      setInsightLoading(false);
    }
  }

  // D3 Network Graph for top rules (same as original)
  useEffect(() => {
    if (!result || !graphRef.current || activeTab !== "graph") return;
    const svg = d3.select(graphRef.current);
    const width = graphRef.current.clientWidth || 800;
    const height = 500;
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const topRules = result.rules.slice(0, 20);
    const nodesMap = new Map<string, { id: string; count: number }>();
    const links: { source: string; target: string; value: number; lift: number }[] = [];

    for (const rule of topRules) {
      const antKey = rule.antecedent.join(",");
      const conKey = rule.consequent.join(",");
      if (!nodesMap.has(antKey)) nodesMap.set(antKey, { id: antKey, count: 1 });
      else nodesMap.get(antKey)!.count++;
      if (!nodesMap.has(conKey)) nodesMap.set(conKey, { id: conKey, count: 1 });
      else nodesMap.get(conKey)!.count++;
      links.push({ source: antKey, target: conKey, value: rule.confidence, lift: rule.lift });
    }

    const nodes = Array.from(nodesMap.values());
    const simulation = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g").selectAll("line").data(links).enter()
      .append("line").attr("stroke", "#9ca3af").attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => Math.sqrt(d.value) * 3);

    const node = svg.append("g").selectAll("circle").data(nodes).enter()
      .append("circle").attr("r", d => 8 + Math.sqrt(d.count) * 4).attr("fill", "#f59e0b")
      .attr("stroke", "#fff").attr("stroke-width", 2)
      .call(d3.drag<SVGCircleElement, any>()
        .on("start", dragstarted).on("drag", dragged).on("end", dragended));

    const label = svg.append("g").selectAll("text").data(nodes).enter()
      .append("text").text(d => d.id.length > 20 ? d.id.slice(0, 18) + "…" : d.id)
      .attr("font-size", 10).attr("font-family", "'DM Mono',monospace").attr("fill", "#1f2937")
      .attr("dx", 12).attr("dy", 4);

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as any).x).attr("y1", d => (d.source as any).y)
        .attr("x2", d => (d.target as any).x).attr("y2", d => (d.target as any).y);
      node.attr("cx", d => (d as any).x).attr("cy", d => (d as any).y);
      label.attr("x", d => (d as any).x).attr("y", d => (d as any).y);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    function dragged(event: any) { event.subject.fx = event.x; event.subject.fy = event.y; }
    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
  }, [result, activeTab]);

  const dlItems = [
    { label: "Rules (CSV)", sub: "Tabel aturan asosiasi", icon: "📊", action: () => { if (result) downloadRulesCSV(result.rules, fileName); setShowDlMenu(false); }, disabled: !result },
    { label: "Hasil Lengkap (JSON)", sub: "Metrik, frequent itemsets", icon: "📋", action: () => { if (result) downloadJSON(result, fileName, algo); setShowDlMenu(false); }, disabled: !result },
    { label: "Network Graph (PNG)", sub: "Gambar jaringan aturan", icon: "🖼️", action: () => { if (graphRef.current) downloadGraphPNG(graphRef.current, fileName); setShowDlMenu(false); }, disabled: !result || activeTab !== "graph" },
  ];

  /* ─── Sidebar content (used for both desktop and drawer) ─── */
  const sidebarContent = (
    <>
      <div style={s.sideTop}>
        <button style={s.backBtn} onClick={() => router.push("/")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Dashboard
        </button>
        <div style={s.sideTitle}><div style={s.sideDot} /><span>Association Rules</span></div>
        <p style={s.sideDesc}>Market basket analysis & item association.</p>
      </div>

      {/* Quota widget desktop */}
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
              <p style={s.fileRows}>{rawData.length} baris</p>
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

      {/* Format & column selection */}
      {rawData.length > 0 && (
        <div style={s.sideSection}>
          <label style={s.sideLabel}>Format Data</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button style={{ ...s.algoBtn, ...(format === "single_column" ? s.algoBtnActive : {}) }} onClick={() => setFormat("single_column")}>
              <div style={{ ...s.algoRadio, ...(format === "single_column" ? s.algoRadioActive : {}) }} /> Satu kolom
            </button>
            <button style={{ ...s.algoBtn, ...(format === "multi_binary" ? s.algoBtnActive : {}) }} onClick={() => setFormat("multi_binary")}>
              <div style={{ ...s.algoRadio, ...(format === "multi_binary" ? s.algoRadioActive : {}) }} /> Multi kolom (0/1)
            </button>
          </div>
          {format === "single_column" && (
            <>
              <select style={s.select} value={itemColumn} onChange={e => setItemColumn(e.target.value)}>
                {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div style={{ marginTop: 8 }}>
                <label style={s.miniLabel}>Pemisah item</label>
                <select style={s.select} value={delimiter} onChange={e => setDelimiter(e.target.value)}>
                  <option value=",">Koma (,)</option>
                  <option value=";">Titik koma (;)</option>
                  <option value="|">Pipe (|)</option>
                  <option value=" ">Spasi</option>
                </select>
              </div>
            </>
          )}
          {format === "multi_binary" && (
            <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Setiap kolom dengan nilai 1/yes dianggap sebagai item.</p>
          )}
        </div>
      )}

      {/* Algorithm */}
      <div style={s.sideSection}>
        <label style={s.sideLabel}>Algoritma</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { id: "apriori", label: "Apriori", desc: "Candidate generation & pruning" },
            { id: "fpgrowth", label: "FP-Growth", desc: "FP-tree, faster for dense data" },
            { id: "eclat", label: "Eclat", desc: "Vertical tid‑list intersection" },
          ].map(a => (
            <button key={a.id} style={{ ...s.algoBtn, ...(algo === a.id ? s.algoBtnActive : {}) }} onClick={() => setAlgo(a.id as Algorithm)}>
              <div style={{ ...s.algoRadio, ...(algo === a.id ? s.algoRadioActive : {}) }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: algo === a.id ? "#f59e0b" : "#1a1a2e" }}>{a.label}</div>
                <div style={{ fontSize: 10, color: "#9ca3af", fontFamily: "'DM Mono',monospace" }}>{a.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Parameters */}
      <div style={s.sideSection}>
        <label style={s.sideLabel}>Parameter</label>
        <div style={s.paramRow}>
          <span style={s.paramLabel}>Min Support</span>
          <input type="range" min={0.01} max={0.5} step={0.01} value={minSupport} onChange={e => setMinSupport(+e.target.value)} style={s.slider} />
          <span style={s.paramVal}>{minSupport.toFixed(2)}</span>
        </div>
        <div style={s.paramRow}>
          <span style={s.paramLabel}>Min Confidence</span>
          <input type="range" min={0.5} max={1} step={0.01} value={minConfidence} onChange={e => setMinConfidence(+e.target.value)} style={s.slider} />
          <span style={s.paramVal}>{minConfidence.toFixed(2)}</span>
        </div>
        <div style={s.paramRow}>
          <span style={s.paramLabel}>Min Lift</span>
          <input type="range" min={1} max={5} step={0.1} value={minLift} onChange={e => setMinLift(+e.target.value)} style={s.slider} />
          <span style={s.paramVal}>{minLift.toFixed(1)}</span>
        </div>
        <div style={s.paramRow}>
          <span style={s.paramLabel}>Max Itemset Length</span>
          <input type="range" min={2} max={5} step={1} value={maxLength} onChange={e => setMaxLength(+e.target.value)} style={s.slider} />
          <span style={s.paramVal}>{maxLength}</span>
        </div>
      </div>

      <button style={{ ...s.runBtn, ...(!rawData.length || running ? s.runBtnDisabled : {}) }} onClick={runAssociationMining} disabled={!rawData.length || running}>
        {running ? <><div style={s.miniSpinner} /> Memproses...</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Cari Rules</>}
      </button>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      {showQuotaModal && <QuotaModal used={quota.usedToday} limit={quota.dailyLimit} onClose={() => setShowQuotaModal(false)} onUpgrade={() => router.push("/pricing")} />}

      <div style={s.shell}>
        {/* Desktop sidebar */}
        <aside className="desktop-sidebar" style={s.sidebar}>{sidebarContent}</aside>

        {/* Mobile drawer */}
        <SidebarDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>{sidebarContent}</SidebarDrawer>

        <main style={s.main}>
          <div style={s.mainHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button className="mobile-menu-btn" style={s.mobileMenuBtn} onClick={() => setSidebarOpen(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              <div>
                <h1 style={s.mainTitle}>Association Rule Mining</h1>
                <p style={s.mainSub}>{result ? `${result.rules.length} rules · ${result.numTransactions} transaksi · ${algo}` : "Upload data dan cari aturan asosiasi"}</p>
              </div>
            </div>
            {result && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {[
                  { label: "Rules", val: result.rules.length, color: "#6366f1" },
                  { label: "Unique Items", val: result.uniqueItems.length, color: "#a855f7" },
                  { label: "Avg Lift", val: (result.rules.reduce((s, r) => s + r.lift, 0) / (result.rules.length || 1)).toFixed(2), color: "#10b981" },
                  { label: "Runtime", val: result.executionTime.toFixed(0) + "ms", color: "#f59e0b" },
                ].map(m => (
                  <div key={m.label} style={s.metricCard}>
                    <div style={s.metricLabel}>{m.label}</div>
                    <div style={{ ...s.metricVal, color: m.color }}>{m.val}</div>
                  </div>
                ))}
                <div style={{ position: "relative" }} ref={dlMenuRef}>
                  <button style={s.dlBtn} onClick={() => setShowDlMenu(v => !v)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Unduh
                  </button>
                  {showDlMenu && (
                    <div style={s.dlMenu}>
                      <p style={s.dlMenuTitle}>Pilih Format</p>
                      {dlItems.map(item => (
                        <button key={item.label} style={{ ...s.dlMenuItem, ...(item.disabled ? s.dlMenuItemDisabled : {}) }} onClick={item.disabled ? undefined : item.action} disabled={item.disabled}>
                          <span style={s.dlMenuIcon}>{item.icon}</span>
                          <span><span style={s.dlMenuLabel}>{item.label}</span><span style={s.dlMenuSub}>{item.sub}</span></span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
              <div style={s.emptyIcon}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
              </div>
              <p style={s.emptyTitle}>Belum ada data</p>
              <p style={s.emptySub}>Upload file CSV/Excel yang berisi transaksi (satu kolom item atau format basket)</p>
              <button className="mobile-upload-cta" style={s.mobileUploadCta} onClick={() => setSidebarOpen(true)}>Upload Dataset</button>
            </div>
          ) : (
            <div style={s.resultsArea}>
              <div style={s.tabs} className="tabs-scroll">
                {(["rules", "graph", "table", "insight"] as const).map(tab => (
                  <button key={tab} style={{ ...s.tab, ...(activeTab === tab ? s.tabActive : {}) }} onClick={() => setActiveTab(tab)}>
                    {tab === "rules" ? "📋 Rules" : tab === "graph" ? "🔗 Network" : tab === "table" ? "📄 Raw Data" : "✨ Insight"}
                  </button>
                ))}
              </div>

              {activeTab === "rules" && (
                <div style={s.tableWrap}>
                  {!result ? (
                    <div style={s.chartPlaceholder}>Jalankan algoritma untuk melihat aturan</div>
                  ) : result.rules.length === 0 ? (
                    <div style={s.chartPlaceholder}>Tidak ada aturan dengan parameter tersebut. Coba turunkan support/confidence.</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={s.table}>
                        <thead><tr><th style={s.th}>Antecedent</th><th style={s.th}>Consequent</th><th style={s.th}>Support</th><th style={s.th}>Confidence</th><th style={s.th}>Lift</th><th style={s.th}>Conviction</th><th style={s.th}>Leverage</th></tr></thead>
                        <tbody>
                          {result.rules.slice(0, 100).map((r, i) => (
                            <tr key={i} style={s.tr} className="table-row">
                              <td style={s.td}>{r.antecedent.join(", ")}</td>
                              <td style={s.td}>{r.consequent.join(", ")}</td>
                              <td style={s.td}>{r.support.toFixed(4)}</td>
                              <td style={s.td}>{r.confidence.toFixed(4)}</td>
                              <td style={s.td}>{r.lift.toFixed(4)}</td>
                              <td style={s.td}>{r.conviction.toFixed(4)}</td>
                              <td style={s.td}>{r.leverage.toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {result.rules.length > 100 && <p style={{ padding: "12px", fontSize: 11, color: "#9ca3af" }}>Menampilkan 100 dari {result.rules.length} rules</p>}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "graph" && (
                <div style={s.chartBox}>
                  {!result ? <div style={s.chartPlaceholder}>Jalankan algoritma terlebih dahulu</div> : result.rules.length === 0 ? <div style={s.chartPlaceholder}>Tidak ada rules untuk digambarkan</div> : <svg ref={graphRef} style={{ width: "100%", height: 500, background: "#f8f8f6", borderRadius: 12 }} />}
                </div>
              )}

              {activeTab === "table" && (
                <div style={s.tableWrap}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={s.table}>
                      <thead><tr>{availableCols.map(c => <th key={c} style={s.th}>{c}</th>)}</tr></thead>
                      <tbody>
                        {rawData.slice(0, 50).map((row, i) => (
                          <tr key={i} style={s.tr}>{availableCols.map(c => <td key={c} style={s.td}>{String(row[c]).slice(0, 30)}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                    {rawData.length > 50 && <p style={{ padding: "12px", fontSize: 11 }}>Menampilkan 50 dari {rawData.length} baris</p>}
                  </div>
                </div>
              )}

              {activeTab === "insight" && (
                <div style={s.statsWrap}>
                  {!result ? <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: 32 }}>Jalankan algoritma terlebih dahulu</p> : (
                    <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid rgba(0,0,0,0.07)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Analisis Naratif AI</h3>
                        <button style={s.analyzeBtn} onClick={() => generateInsight(result)} disabled={insightLoading}>
                          {insightLoading ? "Sedang Berpikir..." : "🔄 Generate Ulang Insight"}
                        </button>
                      </div>
                      {insightLoading && !insight && <div style={s.miniSpinner} />}
                      {insightError && <div style={{ ...s.errMsg, background: "#fef2f2", padding: 12, borderRadius: 8 }}>⚠️ {insightError}</div>}
                      <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{insight || "Klik tombol di atas untuk menganalisis aturan asosiasi secara mendalam menggunakan AI."}</div>
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
   STYLES (incl. responsive)
═══════════════════════════════════════════════════════════════ */
const s: Record<string, React.CSSProperties> = {
  shell: { display: "flex", minHeight: "100vh", background: "#f8f8f6", fontFamily: "'Outfit',sans-serif", color: "#1a1a2e" },
  sidebar: { width: 280, minWidth: 280, background: "#f0f0ed", borderRight: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", padding: "24px 20px", overflowY: "auto" },
  sideTop: { marginBottom: 20 },
  backBtn: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", marginBottom: 20, fontWeight: 500 },
  sideTitle: { display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, marginBottom: 6 },
  sideDot: { width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" },
  sideDesc: { fontSize: 11.5, color: "#9ca3af", lineHeight: 1.6 },
  quotaWidgetDesktop: { background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 },
  quotaUpgradeBtn: { marginTop: 10, width: "100%", padding: "7px 0", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  sideSection: { borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 16, marginTop: 16 },
  sideLabel: { display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 10 },
  dropzone: { border: "1.5px dashed rgba(0,0,0,0.14)", borderRadius: 12, padding: "20px 12px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: "rgba(255,255,255,0.5)" },
  dropzoneDrag: { borderColor: "#f59e0b", background: "rgba(245,158,11,0.06)" },
  uploadIcon: { width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" },
  dropText: { fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 2 },
  dropSub: { fontSize: 10.5, color: "#9ca3af", fontFamily: "'DM Mono',monospace" },
  fileIcon: { fontSize: 24, marginBottom: 6 },
  fileName: { fontSize: 11.5, fontWeight: 600, wordBreak: "break-all", marginBottom: 3 },
  fileRows: { fontSize: 10.5, color: "#9ca3af", fontFamily: "'DM Mono',monospace" },
  errMsg: { fontSize: 11, color: "#ef4444", marginTop: 6, lineHeight: 1.5 },
  miniLabel: { fontSize: 10, color: "#9ca3af", marginBottom: 4, fontFamily: "'DM Mono',monospace" },
  select: { width: "100%", padding: "7px 10px", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, fontSize: 12, fontFamily: "'Outfit',sans-serif", outline: "none" },
  algoBtn: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, cursor: "pointer", textAlign: "left", width: "100%", marginBottom: 6 },
  algoBtnActive: { background: "rgba(245,158,11,0.07)", borderColor: "rgba(245,158,11,0.3)" },
  algoRadio: { width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", flexShrink: 0 },
  algoRadioActive: { border: "4px solid #f59e0b" },
  paramRow: { marginBottom: 12 },
  paramLabel: { fontSize: 11, color: "#6b7280", marginBottom: 5, display: "block" },
  slider: { flex: 1, accentColor: "#f59e0b", height: 4 },
  paramVal: { fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 600, color: "#f59e0b", minWidth: 32, textAlign: "right" },
  runBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20, padding: "13px 0", background: "linear-gradient(135deg,#f59e0b,#ea580c)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(245,158,11,0.3)" },
  runBtnDisabled: { opacity: 0.5, cursor: "not-allowed", boxShadow: "none" },
  miniSpinner: { width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  mainHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexWrap: "wrap", gap: 12 },
  mainTitle: { fontSize: 18, fontWeight: 800, marginBottom: 2 },
  mainSub: { fontSize: 11, color: "#9ca3af", fontFamily: "'DM Mono',monospace" },
  mobileMenuBtn: { display: "none", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 9, cursor: "pointer", flexShrink: 0 },
  mobileQuotaBar: { display: "none", padding: "10px 20px", background: "rgba(240,240,237,0.6)", borderBottom: "1px solid rgba(0,0,0,0.06)" },
  mobileUploadCta: { display: "none" },
  metricCard: { background: "#fff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, padding: "8px 14px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" },
  metricLabel: { fontSize: 9.5, fontFamily: "'DM Mono',monospace", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 },
  metricVal: { fontSize: 17, fontWeight: 700 },
  dlBtn: { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#1a1a2e", border: "none", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  dlMenu: { position: "absolute", top: "calc(100% + 8px)", right: 0, width: 272, background: "#fff", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.13)", zIndex: 200, padding: "10px 8px" },
  dlMenuTitle: { fontSize: 9.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#9ca3af", padding: "4px 10px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)", marginBottom: 4 },
  dlMenuItem: { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", background: "none", border: "none", borderRadius: 9, cursor: "pointer", textAlign: "left" },
  dlMenuItemDisabled: { opacity: 0.38, cursor: "not-allowed" },
  dlMenuIcon: { fontSize: 18, lineHeight: 1, flexShrink: 0 },
  dlMenuLabel: { display: "block", fontSize: 12.5, fontWeight: 600, color: "#1a1a2e", marginBottom: 1 },
  dlMenuSub: { display: "block", fontSize: 10, color: "#9ca3af" },
  analyzeBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "8px 14px", background: "rgba(245,158,11,0.12)", border: "1.5px solid rgba(245,158,11,0.35)", borderRadius: 9, color: "#d97706", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  emptyState: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyIcon: { width: 72, height: 72, borderRadius: "50%", background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: "#6b7280" },
  emptySub: { fontSize: 12, color: "#9ca3af", textAlign: "center", maxWidth: 320 },
  resultsArea: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  tabs: { display: "flex", gap: 0, borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "0 24px", overflowX: "auto", whiteSpace: "nowrap" },
  tab: { padding: "11px 14px", fontSize: 12, fontWeight: 500, color: "#9ca3af", background: "none", border: "none", borderBottom: "2px solid transparent", cursor: "pointer", fontFamily: "'Outfit',sans-serif", display: "inline-flex", alignItems: "center", gap: 5 },
  tabActive: { color: "#f59e0b", borderBottomColor: "#f59e0b", fontWeight: 700 },
  chartBox: { flex: 1, padding: "20px 24px", overflow: "auto" },
  chartPlaceholder: { height: 380, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px dashed rgba(0,0,0,0.1)", borderRadius: 12, fontSize: 13, color: "#9ca3af" },
  tableWrap: { flex: 1, overflow: "auto", padding: "20px 24px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: { padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9ca3af", background: "#f8f8f6", borderBottom: "1px solid rgba(0,0,0,0.07)", fontFamily: "'DM Mono',monospace" },
  tr: { borderBottom: "1px solid rgba(0,0,0,0.05)", transition: "background 0.15s" },
  td: { padding: "8px 12px", color: "#374151", whiteSpace: "nowrap", fontFamily: "'DM Mono',monospace", fontSize: 11.5 },
  statsWrap: { flex: 1, overflow: "auto", padding: "20px 24px" },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700;800&display=swap');
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes quotaModalIn { from { opacity:0; transform:scale(0.92) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .quota-modal-in { animation: quotaModalIn 0.3s cubic-bezier(.34,1.56,.64,1) both; }
  .run-btn-hover:not(:disabled):hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 8px 20px rgba(245,158,11,0.4) !important; }
  .dl-btn-hover:hover { background: #2d2d4e !important; transform: translateY(-1px); }
  .dl-item-hover:hover { background: rgba(245,158,11,0.08) !important; }
  .table-row:hover { background: rgba(245,158,11,0.03) !important; }
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