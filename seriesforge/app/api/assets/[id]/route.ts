import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const data = await req.json() as {
      name?: string;
      url?: string | null;
      prompt?: string | null;
      reusable?: boolean;
    };

    const asset = await prisma.asset.findFirst({
      where: { id, series: { userId: user.id } },
    });
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

    const updated = await prisma.asset.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.url !== undefined ? { url: data.url } : {}),
        ...(data.prompt !== undefined ? { prompt: data.prompt } : {}),
        ...(data.reusable !== undefined ? { reusable: data.reusable } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update asset" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const deleted = await prisma.asset.deleteMany({
      where: { id, series: { userId: user.id } },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
  }
}
