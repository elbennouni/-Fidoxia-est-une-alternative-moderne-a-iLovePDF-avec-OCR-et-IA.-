import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { badRequest, ok, serverError, unauthorized } from "@/lib/http";
import { generateVideoSchema } from "@/lib/schemas";
import { runVideoPipeline } from "@/lib/pipeline-service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ seriesId: string; episodeId: string }> },
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return unauthorized();
    }
    const { seriesId, episodeId } = await context.params;
    const body = await request.json();
    const parsed = generateVideoSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Payload invalide", parsed.error.flatten());
    }

    const result = await runVideoPipeline(
      user.id,
      seriesId,
      episodeId,
      parsed.data.provider,
      parsed.data.durationSecPerScene,
      parsed.data.format,
    );
    return ok(result);
  } catch (error) {
    return serverError("Echec generation video", error);
  }
}
