import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildProducerPlan, type ProducerPlan } from "@/lib/chatbot/producerMode";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      mode?: ProducerPlan["mode"];
      input?: string;
    };

    const mode = body.mode || "brief";
    const input = body.input?.trim() || "";

    const plan = buildProducerPlan({ mode, input });

    return NextResponse.json({
      success: true,
      plan,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Producer planning failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
