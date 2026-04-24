import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

// Delete voice audio from a scene
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const scene = await prisma.scene.findFirst({
      where: { id, episode: { series: { userId: user.id } } },
    });
    if (!scene) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.scene.update({
      where: { id },
      data: { voiceUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
