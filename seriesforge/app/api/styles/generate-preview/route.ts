import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { VISUAL_STYLE_PRESETS } from "@/lib/visualStyles";

// Cache previews in DB using Asset model
async function getCachedPreview(styleId: string, userId: string): Promise<string | null> {
  const asset = await prisma.asset.findFirst({
    where: { name: `style-preview-${styleId}`, series: { userId } },
  });
  return asset?.url || null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { styleId, seriesId } = await req.json();

    const style = VISUAL_STYLE_PRESETS.find(s => s.id === styleId);
    if (!style) return NextResponse.json({ error: "Style not found" }, { status: 404 });

    // Check cache first
    const series = await prisma.series.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    if (series) {
      const cached = await getCachedPreview(styleId, user.id);
      if (cached) return NextResponse.json({ imageUrl: cached, cached: true });
    }

    // Generate with Fal.ai FLUX Schnell (cheapest, fastest)
    const falKey = process.env.FAL_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    const previewPrompt = `${style.promptKeywords}. Scene: a young person standing in a beautiful landscape, cinematic composition, 9:16 vertical format, showcase of the art style, example scene. High quality sample image.`;

    let imageUrl = "";

    if (falKey) {
      // Use FLUX Schnell (~$0.001)
      const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
        method: "POST",
        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: previewPrompt.slice(0, 2000),
          image_size: { width: 320, height: 568 }, // small 9:16 for preview
          num_images: 1,
          sync_mode: true,
          enable_safety_checker: false,
          num_inference_steps: 4,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        imageUrl = data.images?.[0]?.url || "";
      }
    } else if (openaiKey) {
      // Fallback to DALL-E 3
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: openaiKey });
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: previewPrompt.slice(0, 4000),
        n: 1,
        size: "1024x1792",
        quality: "standard",
      });
      imageUrl = (response.data ?? [])[0]?.url || "";
    }

    if (!imageUrl) {
      return NextResponse.json({ error: "No API key available for preview generation" }, { status: 400 });
    }

    // Cache the preview in the DB
    if (series) {
      await prisma.asset.create({
        data: {
          seriesId: series.id,
          type: "style_preview",
          name: `style-preview-${styleId}`,
          url: imageUrl,
          prompt: previewPrompt,
          reusable: true,
        },
      });
    }

    return NextResponse.json({ imageUrl, cached: false, styleId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Preview generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
