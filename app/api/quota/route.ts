import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getQuotaStatus, consumeQuota } from "@/lib/quota";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const status = await getQuotaStatus(session.user.id);
    return NextResponse.json(status);
  } catch (err) {
    console.error("[GET /api/quota]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let action = "file_analysis";
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.action === "string") action = body.action;
  } catch {
    /* body kosong — tidak apa-apa */
  }

  try {
    const status = await consumeQuota(session.user.id, action);
    return NextResponse.json(status, { status: 200 });
  } catch (err: unknown) {
    const e = err as Error & { code?: string };
    if (e.code === "QUOTA_EXCEEDED") {
      const current = await getQuotaStatus(session.user.id);
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: "Kuota harian habis.", ...current },
        { status: 429 }
      );
    }
    console.error("[POST /api/quota]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}