import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";               // ← gunakan auth langsung
import { PrismaClient } from "../../../../generated/prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

/* ─── Midtrans config ─── */
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY!;
const MIDTRANS_CLIENT_KEY = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!;
const IS_PRODUCTION       = process.env.MIDTRANS_ENV === "production";

const MIDTRANS_BASE_URL = IS_PRODUCTION
  ? "https://app.midtrans.com/snap/v1/transactions"
  : "https://app.sandbox.midtrans.com/snap/v1/transactions";

function midtransAuthHeader(): string {
  return "Basic " + Buffer.from(MIDTRANS_SERVER_KEY + ":").toString("base64");
}

export async function POST(req: NextRequest) {
  const session = await auth();   // ← gunakan auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { planId?: string; planName?: string; price?: number; period?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const { planId, planName, price, period } = body;

  if (!planId || !planName || typeof price !== "number" || !period) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (planId === "free") {
    return NextResponse.json({ error: "Free plan tidak memerlukan pembayaran" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const orderId = `DLYTX-${session.user.id.slice(0,8)}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

  await prisma.paymentOrder.create({
    data: {
      orderId,
      userId:  session.user.id,
      planId,
      planName,
      price,
      period,
      status:  "pending",
    },
  });

  const snapPayload = {
    transaction_details: {
      order_id:     orderId,
      gross_amount: price,
    },
    customer_details: {
      first_name: user.name ?? "User",
      email:      user.email,
    },
    item_details: [
      {
        id:       planId,
        price,
        quantity: 1,
        name:     `Datalytics ${planName} (${period})`,
      },
    ],
    callbacks: {
      finish: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?upgraded=1`,
    },
  };

  const midtransRes = await fetch(MIDTRANS_BASE_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": midtransAuthHeader(),
    },
    body: JSON.stringify(snapPayload),
  });

  if (!midtransRes.ok) {
    const errText = await midtransRes.text();
    console.error("[Midtrans]", errText);
    return NextResponse.json({ error: "Gagal membuat transaksi Midtrans", detail: errText }, { status: 502 });
  }

  const { token } = await midtransRes.json();

  return NextResponse.json({
    snapToken: token,
    orderId,
    clientKey: MIDTRANS_CLIENT_KEY,
  });
}