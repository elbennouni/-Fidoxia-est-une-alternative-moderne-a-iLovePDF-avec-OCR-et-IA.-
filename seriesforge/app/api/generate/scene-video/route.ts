/**
 * Video generation for a scene
 * Supported engines: Kling AI (via Fal.ai), Runway (via Replicate), MiniMax (via Fal.ai), Wan (via Replicate)
 * Uses: scene image as first frame + video prompt
 */

import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

async function toPublicUrl(imageUrl: string, falKey: string): Promise<string | null> {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("https://") || imageUrl.startsWith("http://")) return imageUrl;
  if (!imageUrl.startsWith("/")) return null;

  try {
    const filePath = path.join(process.cwd(), "public", imageUrl);
    const buffer = await readFile(filePath);
    const ext = imageUrl.split(".").pop()?.toLowerCase() || "jpg";
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    const blob = new Blob([new Uint8Array(buffer)], { type: mime });
    const formData = new FormData();
    formData.append("file", blob, `frame-${Date.now()}.${ext}`);

    const res = await fetch("https://fal.run/fal-ai/storage/upload", {
      method: "POST",
      headers: { "Authorization": `Key ${falKey}` },
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.url) return data.url;
    }
    // Fallback: base64
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch { return null; }
}

function extractReplicateUrl(output: unknown): string {
  if (Array.isArray(output) && output.length > 0) return String(output[0]);
  if (typeof output === "string") return output;
  if (output && typeof output === "object") return String(output);
  return "";
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sceneId, generatorId = "kling-15-std", duration = 5 } = await req.json();

    const scene = await prisma.scene.findFirst({
      where: { id: sceneId, episode: { series: { userId: user.id } } },
      include: {
        episode: {
          include: { series: true },
        },
      },
    });

    if (!scene) return NextResponse.json({ error: "Scène non trouvée" }, { status: 404 });

    const { series } = scene.episode;
    const falKey = process.env.FAL_API_KEY;
    const replicateKey = process.env.REPLICATE_API_TOKEN;

    // Build video prompt
    const videoPrompt = scene.videoPrompt ||
      `${series.visualStyle}, ${scene.action || "cinematic animated scene"}, ${scene.emotion || "dramatic"}, smooth motion, 9:16 vertical format`;

    // Get scene image as first frame (img2video)
    const imageUrl = scene.imageUrl;
    const publicImageUrl = imageUrl && falKey ? await toPublicUrl(imageUrl, falKey) : null;

    let videoUrl = "";
    let generatorUsed = "";

    // ─── KLING AI via Fal.ai ─────────────────────────────────────────
    if ((generatorId === "kling-15-std" || generatorId === "kling-15-pro") && falKey) {
      // Use Kling 2.1 (latest) instead of 1.5
      generatorUsed = generatorId === "kling-15-pro" ? "Kling AI 2.1 Pro" : "Kling AI 2.1 Standard";
      const model = generatorId === "kling-15-pro"
        ? "fal-ai/kling-video/v2.1/pro/image-to-video"
        : "fal-ai/kling-video/v2.1/standard/image-to-video";

      const body: Record<string, unknown> = {
        prompt: videoPrompt.slice(0, 2000),
        duration: String(duration === 5 ? "5" : "10"),
        aspect_ratio: "9:16",
        cfg_scale: 0.5,
      };
      if (publicImageUrl) body.image_url = publicImageUrl;

      const res = await fetch(`https://fal.run/${model}`, {
        method: "POST",
        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Kling AI ${res.status}: ${err.slice(0, 300)}`);
      }
      const data = await res.json();
      videoUrl = data.video?.url || data.videos?.[0]?.url || data.url || "";

    // ─── MINIMAX VIDEO via Fal.ai ─────────────────────────────────────
    } else if (generatorId === "minimax-video" && falKey) {
      generatorUsed = "MiniMax Video-01";
      const body: Record<string, unknown> = {
        prompt: videoPrompt.slice(0, 2000),
      };
      if (publicImageUrl) body.first_frame_image = publicImageUrl;

      const res = await fetch("https://fal.run/fal-ai/minimax/video-01/image-to-video", {
        method: "POST",
        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`MiniMax Video ${res.status}: ${err.slice(0, 300)}`);
      }
      const data = await res.json();
      videoUrl = data.video?.url || data.url || "";

    // ─── SEEDANCE 2.0 via Fal.ai ─────────────────────────────────────
    } else if (generatorId === "seedance-1" && falKey) {
      generatorUsed = "Seedance 2.0";
      const body: Record<string, unknown> = {
        prompt: videoPrompt.slice(0, 2000),
        resolution: "720p",
        duration: String(Math.min(Math.max(duration, 4), 15)), // 4-15s
        aspect_ratio: "9:16",
        generate_audio: true,
      };
      if (publicImageUrl) body.image_url = publicImageUrl;

      const res = await fetch("https://fal.run/bytedance/seedance-2.0/image-to-video", {
        method: "POST",
        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Seedance 2.0 ${res.status}: ${err.slice(0, 300)}`);
      }
      const data = await res.json();
      videoUrl = data.video?.url || data.url || "";

    // ─── RUNWAY via Replicate ──────────────────────────────────────────
    } else if (generatorId === "runway-gen3" && replicateKey) {
      generatorUsed = "Runway Gen-3 Alpha";
      const input: Record<string, unknown> = {
        prompt_text: videoPrompt.slice(0, 1000),
        duration: duration <= 5 ? 5 : 10,
        ratio: "768:1344",
        watermark: false,
      };
      if (publicImageUrl) input.prompt_image = publicImageUrl;

      const output = await replicate.run("runway-ai/gen-3-alpha-turbo" as `${string}/${string}`, { input });
      videoUrl = extractReplicateUrl(output);

    // ─── WAN via Replicate ────────────────────────────────────────────
    } else if (generatorId === "wan-replicate" && replicateKey) {
      generatorUsed = "Wan 2.1";
      const input: Record<string, unknown> = {
        prompt: videoPrompt.slice(0, 2000),
        num_frames: duration <= 5 ? 81 : 161,
        aspect_ratio: "9:16",
        sample_shift: 8,
      };
      if (publicImageUrl) input.image = publicImageUrl;

      const output = await replicate.run("wan-video/wan-2.1-i2v-480p" as `${string}/${string}`, { input });
      videoUrl = extractReplicateUrl(output);

    // ─── LUMA RAY 2 via Fal.ai ────────────────────────────────────────
    } else if (generatorId === "luma-ray2" && falKey) {
      generatorUsed = "Luma Dream Machine";
      const body: Record<string, unknown> = {
        prompt: videoPrompt.slice(0, 2000),
        aspect_ratio: "9:16",
        loop: false,
        duration: `${duration}s`,
      };
      if (publicImageUrl) {
        body.keyframes = {
          frame0: { type: "image", url: publicImageUrl },
        };
      }

      const res = await fetch("https://fal.run/fal-ai/luma-dream-machine/ray-2/image-to-video", {
        method: "POST",
        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Luma Ray 2 ${res.status}: ${err.slice(0, 300)}`);
      }
      const data = await res.json();
      videoUrl = data.video?.url || data.url || "";

    } else {
      throw new Error(`Moteur "${generatorId}" non supporté ou clé API manquante`);
    }

    if (!videoUrl) throw new Error(`Aucune vidéo générée avec ${generatorUsed}`);

    // Save to scene
    await prisma.scene.update({
      where: { id: sceneId },
      data: { videoUrl },
    });

    return NextResponse.json({
      videoUrl,
      sceneId,
      generatorUsed,
      duration,
      usedFirstFrame: !!publicImageUrl,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Génération vidéo échouée";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
