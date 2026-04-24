import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

// Update any scene field
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const data = await req.json();

    const scene = await prisma.scene.findFirst({
      where: { id, episode: { series: { userId: user.id } } },
    });
    if (!scene) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // If text fields changed, reset voice URL
    const textFields = ["narration", "dialogue", "action", "emotion", "soundDesign"];
    const hasTextChange = textFields.some(f => data[f] !== undefined && data[f] !== (scene as Record<string, unknown>)[f]);

    const updateData: Record<string, unknown> = { ...data };
    if (hasTextChange && !("voiceUrl" in data)) {
      updateData.voiceUrl = null; // reset voice when text changes
    }

    const updated = await prisma.scene.update({ where: { id }, data: updateData });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
