import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient();

/* ─── Konstanta ─── */
export const PLAN_LIMITS: Record<string, number> = {
  free:  3,    // user gratis: maksimal 3 analisis/hari
  paid:  20,  // user berbayar: maksimal 50 analisis/hari (bisa diubah sesuai kebutuhan)
};

/* ─── Types ─── */
export type QuotaStatus = {
  allowed:      boolean;
  usedToday:    number;
  dailyLimit:   number;
  remaining:    number;
  role:         string;   // "free" atau "paid"
  resetAt:      string;   // ISO date string besok pukul 00:00
};

/* ─── Helper: apakah lastResetDate sudah melewati hari ini? ─── */
function isNewDay(lastResetDate: Date): boolean {
  const now   = new Date();
  const reset = new Date(lastResetDate);

  return (
    now.getFullYear() !== reset.getFullYear() ||
    now.getMonth()    !== reset.getMonth()    ||
    now.getDate()     !== reset.getDate()
  );
}

function getTomorrowMidnight(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/* ─── Pastikan UserQuota ada untuk user ─── */
async function ensureQuota(userId: string) {
  // Ambil role user dari tabel User (pastikan field 'role' ada, default "free")
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  // Role yang valid: "free" atau "paid". Selain itu dianggap "free".
  let role = user?.role ?? "free";
  if (role !== "free" && role !== "paid") role = "free";

  const dailyLimit = PLAN_LIMITS[role] ?? PLAN_LIMITS.free;

  return prisma.userQuota.upsert({
    where:  { userId },
    create: { userId, role, dailyLimit, usedToday: 0, lastResetDate: new Date() },
    update: {},
  });
}

/* ─── Reset harian jika perlu ─── */
async function maybeResetDaily(userId: string) {
  const quota = await prisma.userQuota.findUnique({ where: { userId } });
  if (!quota) return;

  if (isNewDay(quota.lastResetDate)) {
    await prisma.userQuota.update({
      where: { userId },
      data:  { usedToday: 0, lastResetDate: new Date() },
    });
  }
}

/* ══════════════════════════════════════
   PUBLIC API
══════════════════════════════════════ */

/**
 * Cek status quota user tanpa mengubah data.
 */
export async function getQuotaStatus(userId: string): Promise<QuotaStatus> {
  await ensureQuota(userId);
  await maybeResetDaily(userId);

  const quota = await prisma.userQuota.findUnique({ where: { userId } });

  const usedToday  = quota?.usedToday  ?? 0;
  const dailyLimit = quota?.dailyLimit ?? PLAN_LIMITS.free;
  const role       = quota?.role       ?? "free";
  const remaining  = Math.max(0, dailyLimit - usedToday);

  return {
    allowed:   usedToday < dailyLimit,
    usedToday,
    dailyLimit,
    remaining,
    role,
    resetAt: getTomorrowMidnight(),
  };
}

/**
 * Catat satu penggunaan analisis.
 * Kembalikan QuotaStatus terbaru setelah increment.
 * Lempar Error dengan code "QUOTA_EXCEEDED" jika kuota habis.
 */
export async function consumeQuota(
  userId: string,
  action = "file_analysis"
): Promise<QuotaStatus> {
  await ensureQuota(userId);
  await maybeResetDaily(userId);

  const quota = await prisma.userQuota.findUnique({ where: { userId } });
  const usedToday  = quota?.usedToday  ?? 0;
  const dailyLimit = quota?.dailyLimit ?? PLAN_LIMITS.free;
  const role       = quota?.role       ?? "free";

  if (usedToday >= dailyLimit) {
    // Catat percobaan gagal
    await prisma.usageLog.create({
      data: { userId, action, success: false, timestamp: new Date() },
    });

    const err = new Error("QUOTA_EXCEEDED") as Error & { code: string };
    err.code = "QUOTA_EXCEEDED";
    throw err;
  }

  // Increment usedToday + catat log sukses dalam transaksi
  await prisma.$transaction([
    prisma.userQuota.update({
      where: { userId },
      data:  { usedToday: { increment: 1 } },
    }),
    prisma.usageLog.create({
      data: { userId, action, success: true, timestamp: new Date() },
    }),
  ]);

  const newUsed = usedToday + 1;
  const remaining = dailyLimit - newUsed;

  return {
    allowed:   newUsed < dailyLimit,
    usedToday: newUsed,
    dailyLimit,
    remaining,
    role,
    resetAt: getTomorrowMidnight(),
  };
}

/**
 * Ambil riwayat penggunaan user (optional, untuk dashboard admin).
 */
export async function getUsageLogs(userId: string, limit = 50) {
  return prisma.usageLog.findMany({
    where:   { userId },
    orderBy: { timestamp: "desc" },
    take:    limit,
  });
}