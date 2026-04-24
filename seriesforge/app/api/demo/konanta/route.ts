import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runEpisodePipeline } from "@/lib/agents/directorAgent";
import { createKonantaStarterSeries } from "@/lib/demo/konantaTemplate";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const series = await createKonantaStarterSeries(user.id, { episodeCount: 1 });
    const episode = series.episodes[0];
    if (!episode) {
      throw new Error("Konanta starter episode was not created");
    }

    // Run the full AI pipeline
    const result = await runEpisodePipeline(episode.id);

    return NextResponse.json({
      message: "Konanta Demo generated successfully!",
      seriesId: series.id,
      episodeId: episode.id,
      success: result.success,
      sceneCount: result.sceneCount,
      averageQualityScore: result.averageQualityScore,
      fixedScenes: result.fixedScenes,
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Demo generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
