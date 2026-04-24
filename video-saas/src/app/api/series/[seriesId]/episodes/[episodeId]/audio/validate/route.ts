import { NextRequest } from "next/server";
import { validateAudioSchema } from "@/lib/schemas";
import { getCurrentUserId } from "@/lib/auth";
import { badRequest, serverError, unauthorized } from "@/lib/http";
import { runAudioValidation } from "@/lib/pipeline-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string; episodeId: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorized();
    }

    const { seriesId, episodeId } = await params;
    const payload = await request.json().catch(() => null);
    const parsed = validateAudioSchema.safeParse(payload ?? {});
    if (!parsed.success) {
      return badRequest("Payload invalide pour validation audio.", parsed.error.flatten());
    }

    const result = await runAudioValidation({
      userId,
      seriesId,
      episodeId,
      payload: parsed.data,
    });
    return Response.json(result, { status: 200 });
  } catch (error) {
    return serverError("Erreur validation audio", error);
  }
}
