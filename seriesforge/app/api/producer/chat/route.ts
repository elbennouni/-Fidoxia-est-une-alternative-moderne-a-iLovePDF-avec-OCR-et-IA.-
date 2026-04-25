import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  buildProducerChatTurn,
  type ProducerAttachment,
  type ProducerChatScope,
} from "@/lib/chatbot/producerChat";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      scope?: ProducerChatScope;
      message?: string;
      attachments?: ProducerAttachment[];
      seriesName?: string;
      episodeTitle?: string;
      seriesId?: string;
      episodeId?: string;
    };

    const scope = body.scope || "episode";
    const turn = buildProducerChatTurn({
      scope: body.scope || "episode",
      preferredMode: "brief",
      approvalMode: scope === "episode" ? "semi-auto" : "automatic",
      toolInput: "",
      message: body.message || "",
      attachments: body.attachments || [],
      seriesName: body.seriesName || "Konanta",
      episodeTitle: body.episodeTitle,
    });

    return NextResponse.json({
      success: true,
      reply: turn.reply,
      plan: turn.plan,
      canvas: turn.canvas,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Producer chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
