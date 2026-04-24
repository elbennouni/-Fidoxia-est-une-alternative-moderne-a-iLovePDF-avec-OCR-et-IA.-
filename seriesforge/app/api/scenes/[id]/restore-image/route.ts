import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { imageUrl: restoreUrl, historyIndex } = await req.json();

    const scene = await prisma.scene.findFirst({
      where: { id, episode: { series: { userId: user.id } } },
    });
    if (!scene) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let history: Array<{ url: string; generator: string; createdAt: string }> = [];
    try { history = JSON.parse(scene.imageHistory || "[]"); } catch {}

    const currentUrl = scene.imageUrl;

    // Swap: put current in history, restore the selected one
    if (currentUrl && restoreUrl) {
      // Remove the restored one from history
      history.splice(historyIndex, 1);
      // Add current to history at position 0
      history.unshift({ url: currentUrl, generator: "restored-from", createdAt: new Date().toISOString() });
      if (history.length > 10) history = history.slice(0, 10);
    }

    await prisma.scene.update({
      where: { id },
      data: { imageUrl: restoreUrl, imageHistory: JSON.stringify(history) },
    });

    return NextResponse.json({ success: true, imageUrl: restoreUrl });
  } catch (error) {
    return NextResponse.json({ error: "Restore failed" }, { status: 500 });
  }
}

// Delete a specific image from history
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { historyIndex } = await req.json();

    const scene = await prisma.scene.findFirst({
      where: { id, episode: { series: { userId: user.id } } },
    });
    if (!scene) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let history: Array<{ url: string; generator: string; createdAt: string }> = [];
    try { history = JSON.parse(scene.imageHistory || "[]"); } catch {}

    history.splice(historyIndex, 1);

    await prisma.scene.update({ where: { id }, data: { imageHistory: JSON.stringify(history) } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
