import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { runEpisodePipeline } from "@/lib/agents/directorAgent";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const episode = await prisma.episode.findFirst({
      where: { id, series: { userId: user.id } },
    });
    if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

    const result = await runEpisodePipeline(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Pipeline failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
