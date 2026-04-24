import { NextRequest } from "next/server";
import { assertOwnerSeries, ensureEpisodeBelongsToSeries, generateStoryForEpisode } from "@/lib/pipeline-service";
import { badRequest, serverError, unauthorized } from "@/lib/http";
import { generateStorySchema } from "@/lib/schemas";
import { getAuthUserFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ seriesId: string; episodeId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return unauthorized();
    }

    const { seriesId, episodeId } = await params;
    await assertOwnerSeries(user.id, seriesId);
    await ensureEpisodeBelongsToSeries(seriesId, episodeId);

    const json = await request.json();
    const parsed = generateStorySchema.safeParse(json);
    if (!parsed.success) {
      return badRequest("Payload invalide pour generation de story.", parsed.error.flatten());
    }

    const result = await generateStoryForEpisode(seriesId, episodeId, parsed.data);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return serverError("Erreur generation story.", error);
  }
}
