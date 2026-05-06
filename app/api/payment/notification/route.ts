import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "../../../../generated/prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY!;

// Mapping planId ke role & dailyLimit (hanya 2 paket)
const PLAN_UPGRADE: Record<string, { role: string; dailyLimit: number }> = {
  pro: { role: "paid", dailyLimit: 50 },
  // free tidak perlu upgrade
};

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const {
    order_id: orderId,
    transaction_status: txStatus,
    fraud_status: fraudStatus,
    status_code: statusCode,
    gross_amount: grossAmount,
    signature_key: signature,
  } = body;

  // 1. Verifikasi signature Midtrans
  function verifySignature(): boolean {
    const raw = orderId + statusCode + grossAmount + MIDTRANS_SERVER_KEY;
    const hash = crypto.createHash("sha512").update(raw).digest("hex");
    return hash === signature;
  }

  if (!verifySignature()) {
    console.warn("[Midtrans Webhook] Invalid signature", orderId);
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  // 2. Cari order di database
  const order = await prisma.paymentOrder.findUnique({
    where: { orderId },
  });
  if (!order) {
    console.warn("[Midtrans Webhook] Order not found", orderId);
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // 3. Tentukan status final
  let finalStatus: "paid" | "pending" | "failed" | "cancelled" = "pending";
  if (txStatus === "capture") {
    finalStatus = fraudStatus === "accept" ? "paid" : "failed";
  } else if (txStatus === "settlement") {
    finalStatus = "paid";
  } else if (["cancel", "deny", "expire"].includes(txStatus)) {
    finalStatus = txStatus === "cancel" ? "cancelled" : "failed";
  } else if (txStatus === "pending") {
    finalStatus = "pending";
  }

  // 4. Update status order
  await prisma.paymentOrder.update({
    where: { orderId },
    data: {
      status: finalStatus,
      paidAt: finalStatus === "paid" ? new Date() : undefined,
    },
  });

  // 5. Jika status PAID, upgrade role user
  if (finalStatus === "paid") {
    const upgrade = PLAN_UPGRADE[order.planId];
    if (upgrade) {
      // Update atau buat UserQuota
      await prisma.userQuota.upsert({
        where: { userId: order.userId },
        create: {
          userId: order.userId,
          role: upgrade.role,
          dailyLimit: upgrade.dailyLimit,
          usedToday: 0,
          lastResetDate: new Date(),
        },
        update: {
          role: upgrade.role,
          dailyLimit: upgrade.dailyLimit,
        },
      });

      // Catat log upgrade
      await prisma.usageLog.create({
        data: {
          userId: order.userId,
          action: `plan_upgraded_to_${order.planId}`,
          success: true,
          timestamp: new Date(),
        },
      });

      console.log(`[Midtrans] User ${order.userId} upgraded to ${order.planId}`);
    }
  }

  return NextResponse.json({ received: true, status: finalStatus });
}

// Gunakan runtime Node.js agar crypto tersedia
export const runtime = "nodejs";