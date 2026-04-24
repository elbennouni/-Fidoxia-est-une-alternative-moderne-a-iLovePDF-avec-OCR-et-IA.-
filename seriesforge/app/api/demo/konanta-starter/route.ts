import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createKonantaStarterSeries } from "@/lib/demo/konantaTemplate";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const series = await createKonantaStarterSeries(user.id);

    return NextResponse.json({
      message: "Konanta starter restored successfully!",
      seriesId: series.id,
      episodeCount: series.episodes.length,
      characterCount: series.characters.length,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "Konanta starter restore failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
