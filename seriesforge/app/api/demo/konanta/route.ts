import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createKonantaStarterSeries } from "@/lib/demo/konantaStarter";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await createKonantaStarterSeries(user.id);

    return NextResponse.json({
      message: "Konanta starter restored successfully!",
      seriesId: result.seriesId,
      episodeId: result.episodeId,
      success: true,
      sceneCount: result.sceneCount,
      characterCount: result.characterCount,
      environmentCount: result.environmentCount,
      seriesTitle: result.seriesTitle,
      episodeTitle: result.episodeTitle,
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Demo restore failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
