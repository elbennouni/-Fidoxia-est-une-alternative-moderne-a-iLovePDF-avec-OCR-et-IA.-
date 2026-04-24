import { NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";
import { badRequest, ok, parseJsonBody, serverError, unauthorized } from "@/lib/http";
import { generateAudioSchema, validateAudioSchema } from "@/lib/schemas";
import { generateAudioTakes, validateAudioForEpisode } from "@/lib/pipeline-service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ seriesId: string; episodeId: string }> },
) {
  try {
    const userId = await getAuthenticatedUserId().catch(() => null);
    if (!userId) {
      return unauthorized();
    }
    const body = await parseJsonBody(request);
    const params = await context.params;
    const parsed = generateAudioSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Payload invalide pour generation audio.", parsed.error.flatten());
    }
    const result = await generateAudioTakes(
      userId,
      params.seriesId,
      params.episodeId,
      parsed.data,
    );
    return ok(result);
  } catch (error) {
    return serverError("Erreur generation audio.", error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ seriesId: string; episodeId: string }> },
) {
  try {
    const userId = await getAuthenticatedUserId().catch(() => null);
    if (!userId) {
      return unauthorized();
    }
    const body = await parseJsonBody(request);
    const params = await context.params;
    const parsed = validateAudioSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Payload invalide pour validation audio.", parsed.error.flatten());
    }
    const result = await validateAudioForEpisode(
      userId,
      params.seriesId,
      params.episodeId,
      parsed.data,
    );
    return ok(result);
  } catch (error) {
    return serverError("Erreur validation audio.", error);
  }
}
