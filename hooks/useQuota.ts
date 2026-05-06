/**
 * hooks/useQuota.ts
 * Custom hook untuk StatisticsPage — menggantikan localStorage quota.
 *
 * Usage:
 *   const { quotaData, checkAndConsume, isExceeded } = useQuota();
 */

"use client";

import { useCallback, useEffect, useState } from "react";

export type QuotaData = {
  allowed:    boolean;
  usedToday:  number;
  dailyLimit: number;
  remaining:  number;
  role:       string;
  resetAt:    string;
};

const FALLBACK: QuotaData = {
  allowed:    true,
  usedToday:  0,
  dailyLimit: 3,
  remaining:  3,
  role:       "free",
  resetAt:    "",
};

export function useQuota() {
  const [quotaData, setQuotaData] = useState<QuotaData>(FALLBACK);
  const [loading,   setLoading]   = useState(true);

  /* Ambil status saat mount */
  useEffect(() => {
    fetch("/api/quota")
      .then(r => r.json())
      .then((data: QuotaData) => setQuotaData(data))
      .catch(() => {/* pakai fallback */})
      .finally(() => setLoading(false));
  }, []);

  /**
   * Panggil sebelum memulai analisis.
   * Kembalikan true  → boleh lanjut
   * Kembalikan false → quota habis (tampilkan modal)
   */
  const checkAndConsume = useCallback(
    async (action = "file_analysis"): Promise<boolean> => {
      try {
        const res = await fetch("/api/quota", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action }),
        });

        const data: QuotaData & { error?: string } = await res.json();

        if (res.status === 429 || data.error === "QUOTA_EXCEEDED") {
          setQuotaData(prev => ({ ...prev, ...data, allowed: false }));
          return false;
        }

        if (!res.ok) return false;

        setQuotaData(data);
        return true;
      } catch {
        return true; // fail-open: jangan blokir user kalau network error
      }
    },
    []
  );

  const isExceeded = !quotaData.allowed;

  return { quotaData, loading, isExceeded, checkAndConsume };
}