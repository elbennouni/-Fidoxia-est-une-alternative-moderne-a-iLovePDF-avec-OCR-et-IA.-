/**
 * Episode assembler using FFmpeg
 * 
 * Pipeline:
 * 1. For each scene: overlay voice audio on video (or image + voice → video)
 * 2. Concatenate all scene clips
 * 3. Mix background music at configured volume
 * 4. Output final MP4 9:16
 */

import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, mkdir, unlink, access } from "fs/promises";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const execAsync = promisify(exec);

const PUBLIC_DIR = path.join(process.cwd(), "public");
const ASSEMBLED_DIR = path.join(PUBLIC_DIR, "assembled");
const TMP_DIR = path.join(process.cwd(), "tmp");

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

async function downloadToFile(url: string, destPath: string): Promise<boolean> {
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const res = await fetch(url);
      if (!res.ok) return false;
      const buffer = Buffer.from(await res.arrayBuffer());
      await writeFile(destPath, buffer);
      return true;
    }
    // Local file
    if (url.startsWith("/")) {
      const srcPath = path.join(PUBLIC_DIR, url);
      const buffer = await readFile(srcPath);
      await writeFile(destPath, buffer);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const episode = await prisma.episode.findFirst({
      where: { id, series: { userId: user.id } },
      include: {
        scenes: { orderBy: { sceneNumber: "asc" } },
        series: true,
      },
    });

    if (!episode) return NextResponse.json({ error: "Épisode non trouvé" }, { status: 404 });

    await ensureDir(ASSEMBLED_DIR);
    await ensureDir(TMP_DIR);

    const sessionId = uuidv4().slice(0, 8);
    const sessionDir = path.join(TMP_DIR, sessionId);
    await ensureDir(sessionDir);

    const sceneClips: string[] = [];

    // Process each scene
    for (const scene of episode.scenes) {
      const sceneNum = scene.sceneNumber;
      const hasVideo = !!scene.videoUrl;
      const hasImage = !!scene.imageUrl;
      const hasVoice = !!scene.voiceUrl;

      let sceneOutputPath = path.join(sessionDir, `scene-${sceneNum}.mp4`);

      if (hasVideo) {
        // Download video
        const videoPath = path.join(sessionDir, `video-${sceneNum}.mp4`);
        const downloaded = await downloadToFile(scene.videoUrl!, videoPath);

        if (downloaded) {
          if (hasVoice) {
            // Download voice
            const voicePath = path.join(sessionDir, `voice-${sceneNum}.wav`);
            const voiceDownloaded = await downloadToFile(scene.voiceUrl!, voicePath);

            if (voiceDownloaded) {
              // Mix voice onto video
              await execAsync(
                `ffmpeg -y -i "${videoPath}" -i "${voicePath}" ` +
                `-filter_complex "[1:a]volume=1.0[voice];[0:a][voice]amix=inputs=2:duration=first:dropout_transition=2[aout]" ` +
                `-map 0:v -map "[aout]" -c:v copy -c:a aac -shortest "${sceneOutputPath}" 2>&1`,
                { timeout: 60000 }
              ).catch(async () => {
                // Fallback: replace audio entirely with voice
                await execAsync(
                  `ffmpeg -y -i "${videoPath}" -i "${voicePath}" ` +
                  `-map 0:v -map 1:a -c:v copy -c:a aac -shortest "${sceneOutputPath}" 2>&1`,
                  { timeout: 60000 }
                );
              });
            } else {
              // Keep video as-is
              sceneOutputPath = videoPath;
            }
          } else {
            // No voice, just use video
            sceneOutputPath = videoPath;
          }

          if (await fileExists(sceneOutputPath)) {
            sceneClips.push(sceneOutputPath);
          }
        }
      } else if (hasImage) {
        // No video — create a clip from image (5s still)
        const imagePath = path.join(sessionDir, `image-${sceneNum}.jpg`);
        const downloaded = await downloadToFile(scene.imageUrl!, imagePath);

        if (downloaded) {
          const duration = hasVoice ? 0 : 5; // duration based on voice or 5s default

          if (hasVoice) {
            const voicePath = path.join(sessionDir, `voice-${sceneNum}.wav`);
            const voiceDownloaded = await downloadToFile(scene.voiceUrl!, voicePath);

            if (voiceDownloaded) {
              // Image + voice → video clip
              await execAsync(
                `ffmpeg -y -loop 1 -i "${imagePath}" -i "${voicePath}" ` +
                `-c:v libx264 -tune stillimage -c:a aac -b:a 128k ` +
                `-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1" ` +
                `-shortest -pix_fmt yuv420p "${sceneOutputPath}" 2>&1`,
                { timeout: 60000 }
              );
            }
          } else {
            // Image only → 5s clip
            await execAsync(
              `ffmpeg -y -loop 1 -i "${imagePath}" -t 5 ` +
              `-c:v libx264 -tune stillimage ` +
              `-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1" ` +
              `-pix_fmt yuv420p "${sceneOutputPath}" 2>&1`,
              { timeout: 30000 }
            );
          }

          if (await fileExists(sceneOutputPath)) {
            sceneClips.push(sceneOutputPath);
          }
        }
      }
    }

    if (sceneClips.length === 0) {
      return NextResponse.json({
        error: "Aucune scène avec vidéo ou image trouvée. Générez d'abord le storyboard et les vidéos."
      }, { status: 400 });
    }

    // Create concat list
    const concatListPath = path.join(sessionDir, "concat.txt");
    const concatContent = sceneClips.map(f => `file '${f}'`).join("\n");
    await writeFile(concatListPath, concatContent);

    // Concatenate all scenes
    const concatenatedPath = path.join(sessionDir, "concatenated.mp4");
    await execAsync(
      `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" ` +
      `-c:v libx264 -c:a aac -b:a 128k -pix_fmt yuv420p "${concatenatedPath}" 2>&1`,
      { timeout: 300000 }
    );

    // Mix background music if available
    const outputFileName = `episode-${id.slice(0, 8)}-${sessionId}.mp4`;
    const outputPath = path.join(ASSEMBLED_DIR, outputFileName);

    if (episode.bgMusicUrl) {
      const musicPath = path.join(sessionDir, "bgmusic.mp3");
      const musicDownloaded = await downloadToFile(episode.bgMusicUrl, musicPath);

      if (musicDownloaded) {
        const musicVolume = episode.bgMusicVolume ?? 0.2;
        // Mix: video audio + looped background music
        await execAsync(
          `ffmpeg -y -i "${concatenatedPath}" -stream_loop -1 -i "${musicPath}" ` +
          `-filter_complex "[1:a]volume=${musicVolume}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=3[aout]" ` +
          `-map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest "${outputPath}" 2>&1`,
          { timeout: 300000 }
        );
      } else {
        // No music download, use concatenated
        await execAsync(`cp "${concatenatedPath}" "${outputPath}"`, { timeout: 30000 });
      }
    } else {
      await execAsync(`cp "${concatenatedPath}" "${outputPath}"`, { timeout: 30000 });
    }

    // Clean up tmp files
    try {
      await execAsync(`rm -rf "${sessionDir}"`);
    } catch {}

    const outputUrl = `/assembled/${outputFileName}`;

    // Save assembled URL to episode
    await prisma.episode.update({
      where: { id },
      data: {
        status: "assembled",
        // Store assembled URL in script field as metadata for now
      } as never,
    });

    return NextResponse.json({
      success: true,
      outputUrl,
      fileName: outputFileName,
      sceneCount: sceneClips.length,
      hasBgMusic: !!episode.bgMusicUrl,
      message: `Épisode assemblé avec ${sceneClips.length} scènes !`,
    });

  } catch (error) {
    console.error("Assemble error:", error);
    const msg = error instanceof Error ? error.message : "Assemblage échoué";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
