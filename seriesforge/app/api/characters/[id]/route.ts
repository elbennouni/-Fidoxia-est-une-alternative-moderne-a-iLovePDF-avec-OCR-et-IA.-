import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const data = await req.json();

    const character = await prisma.character.findFirst({
      where: { id, series: { userId: user.id } },
    });
    if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.character.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await prisma.character.deleteMany({ where: { id, series: { userId: user.id } } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
