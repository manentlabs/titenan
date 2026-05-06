import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PrismaClient } from "../../../../generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json();
  const { name, email, password } = body;

  if (!name || !email) {
    return NextResponse.json({ error: "Nama dan email wajib diisi" }, { status: 400 });
  }

  // Cek apakah email sudah digunakan oleh user lain
  const existingUser = await prisma.user.findFirst({
    where: { email, NOT: { id: userId } },
  });
  if (existingUser) {
    return NextResponse.json({ error: "Email sudah terdaftar oleh akun lain" }, { status: 400 });
  }

  const updateData: any = { name, email };
  if (password && password.length >= 6) {
    const hashedPassword = await bcrypt.hash(password, 10);
    updateData.password = hashedPassword;
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update user error:", err);
    return NextResponse.json({ error: "Gagal update profil" }, { status: 500 });
  }
}