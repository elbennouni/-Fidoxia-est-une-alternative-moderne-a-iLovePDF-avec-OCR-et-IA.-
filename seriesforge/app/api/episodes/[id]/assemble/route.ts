/**
 * Episode assembler using FFmpeg
 * Fixes:
 * - Audio not cutting off at 18s
 * - Background music looping for full duration
 * - Proper audio track handling per scene
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
    if (!url) return false;
    if (url.startsWith("data:")) {
      const base64Data = url.split(",")[1];
      if (!base64Data) return false;
      await writeFile(destPath, Buffer.from(base64Data, "base64"));
      return true;
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const res = await fetch(url);
      if (!res.ok) return false;
      await writeFile(destPath, Buffer.from(await res.arrayBuffer()));
      return true;
    }
    if (url.startsWith("/")) {
      await writeFile(destPath, await readFile(path.join(PUBLIC_DIR, url)));
      return true;
    }
    return false;
  } catch { return false; }
}

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { timeout: 10000 }
    );
    return parseFloat(stdout.trim()) || 0;
  } catch { return 0; }
}

async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { timeout: 10000 }
    );
    return parseFloat(stdout.trim()) || 0;
  } catch { return 0; }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const episode = await prisma.episode.findFirst({
      where: { id, series: { userId: user.id } },
      include: { scenes: { orderBy: { sceneNumber: "asc" } }, series: true },
    });

    if (!episode) return NextResponse.json({ error: "Épisode non trouvé" }, { status: 404 });

    await ensureDir(ASSEMBLED_DIR);
    await ensureDir(TMP_DIR);

    const sessionId = uuidv4().slice(0, 8);
    const sessionDir = path.join(TMP_DIR, sessionId);
    await ensureDir(sessionDir);

    const sceneClips: string[] = [];

    // ─── PROCESS EACH SCENE ──────────────────────────────────────────
    for (const scene of episode.scenes) {
      const n = scene.sceneNumber;
      const hasVideo = !!scene.videoUrl;
      const hasImage = !!scene.imageUrl;
      const hasVoice = !!scene.voiceUrl;
      const sceneOutPath = path.join(sessionDir, `scene-${n}.mp4`);

      if (hasVideo) {
        const videoPath = path.join(sessionDir, `video-${n}.mp4`);
        const vidOk = await downloadToFile(scene.videoUrl!, videoPath);
        if (!vidOk) continue;

        if (hasVoice) {
          const voicePath = path.join(sessionDir, `voice-${n}.mp3`);
          const voiceOk = await downloadToFile(scene.voiceUrl!, voicePath);

          if (voiceOk) {
            const vidDur = await getVideoDuration(videoPath);
            const voiceDur = await getAudioDuration(voicePath);
            // Use the LONGER of video vs voice duration so nothing gets cut
            const finalDur = Math.max(vidDur, voiceDur);

            // Encode video (loop if shorter than voice), mix voice on top
            await execAsync(
              `ffmpeg -y ` +
              `-stream_loop -1 -t ${finalDur} -i "${videoPath}" ` +
              `-i "${voicePath}" ` +
              `-filter_complex ` +
              `"[0:a]volume=0.3[origvol];[1:a]volume=1.0[voicevol];[origvol][voicevol]amix=inputs=2:duration=longest:dropout_transition=0[aout]" ` +
              `-map 0:v -map "[aout]" ` +
              `-c:v libx264 -c:a aac -b:a 192k -t ${finalDur} -pix_fmt yuv420p ` +
              `"${sceneOutPath}" 2>&1`,
              { timeout: 120000 }
            ).catch(async (e) => {
              console.error(`Scene ${n} video+voice error:`, e.stderr?.slice(0, 200));
              // Fallback: video only with voice replacing audio
              await execAsync(
                `ffmpeg -y -i "${videoPath}" -i "${voicePath}" ` +
                `-map 0:v -map 1:a -c:v libx264 -c:a aac -b:a 192k ` +
                `-t ${Math.max(vidDur, voiceDur)} -pix_fmt yuv420p "${sceneOutPath}" 2>&1`,
                { timeout: 120000 }
              ).catch(() => {});
            });
          } else {
            // Voice download failed — use video as-is but re-encode
            await execAsync(
              `ffmpeg -y -i "${videoPath}" -c:v libx264 -c:a aac -pix_fmt yuv420p "${sceneOutPath}" 2>&1`,
              { timeout: 60000 }
            ).catch(() => {});
          }
        } else {
          // No voice — re-encode video for consistent codec
          await execAsync(
            `ffmpeg -y -i "${videoPath}" -c:v libx264 -c:a aac -pix_fmt yuv420p "${sceneOutPath}" 2>&1`,
            { timeout: 60000 }
          ).catch(() => {});
        }

        if (await fileExists(sceneOutPath)) sceneClips.push(sceneOutPath);

      } else if (hasImage) {
        const imagePath = path.join(sessionDir, `image-${n}.jpg`);
        const imgOk = await downloadToFile(scene.imageUrl!, imagePath);
        if (!imgOk) continue;

        if (hasVoice) {
          const voicePath = path.join(sessionDir, `voice-${n}.mp3`);
          const voiceOk = await downloadToFile(scene.voiceUrl!, voicePath);

          if (voiceOk) {
            const voiceDur = await getAudioDuration(voicePath);
            const duration = voiceDur > 0 ? voiceDur : 5;

            // Image + voice → video (image shown for full voice duration)
            await execAsync(
              `ffmpeg -y -loop 1 -i "${imagePath}" -i "${voicePath}" ` +
              `-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=24" ` +
              `-c:v libx264 -tune stillimage -c:a aac -b:a 192k ` +
              `-t ${duration + 0.5} -pix_fmt yuv420p "${sceneOutPath}" 2>&1`,
              { timeout: 120000 }
            ).catch((e) => console.error(`Scene ${n} image+voice error:`, e.stderr?.slice(0, 200)));
          } else {
            // Image only 5s
            await execAsync(
              `ffmpeg -y -loop 1 -i "${imagePath}" -t 5 ` +
              `-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=24" ` +
              `-c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p "${sceneOutPath}" 2>&1`,
              { timeout: 60000 }
            ).catch(() => {});
          }
        } else {
          // Image only 5s
          await execAsync(
            `ffmpeg -y -loop 1 -i "${imagePath}" -t 5 ` +
            `-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=24" ` +
            `-c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p "${sceneOutPath}" 2>&1`,
            { timeout: 60000 }
          ).catch(() => {});
        }

        if (await fileExists(sceneOutPath)) sceneClips.push(sceneOutPath);
      }
    }

    if (sceneClips.length === 0) {
      return NextResponse.json({
        error: "Aucune scène assemblée. Vérifiez que les images ou vidéos sont générées."
      }, { status: 400 });
    }

    // ─── CONCATENATE ALL SCENES ───────────────────────────────────────
    const concatListPath = path.join(sessionDir, "concat.txt");
    await writeFile(concatListPath, sceneClips.map(f => `file '${f}'`).join("\n"));

    const concatenatedPath = path.join(sessionDir, "concatenated.mp4");
    await execAsync(
      // Re-encode during concat to ensure consistent audio/video streams
      `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" ` +
      `-c:v libx264 -c:a aac -b:a 192k -pix_fmt yuv420p "${concatenatedPath}" 2>&1`,
      { timeout: 600000 }
    );

    const totalDuration = await getVideoDuration(concatenatedPath);

    // ─── MIX BACKGROUND MUSIC ─────────────────────────────────────────
    const outputFileName = `episode-${id.slice(0, 8)}-${sessionId}.mp4`;
    const outputPath = path.join(ASSEMBLED_DIR, outputFileName);

    if (episode.bgMusicUrl) {
      const musicPath = path.join(sessionDir, "bgmusic.mp3");
      const musicOk = await downloadToFile(episode.bgMusicUrl, musicPath);

      if (musicOk && totalDuration > 0) {
        const musicVolume = episode.bgMusicVolume ?? 0.2;
        // Loop music for the FULL duration of the episode, then mix at configured volume
        await execAsync(
          `ffmpeg -y ` +
          `-i "${concatenatedPath}" ` +
          `-stream_loop -1 -t ${totalDuration} -i "${musicPath}" ` +
          `-filter_complex ` +
          `"[0:a]volume=1.0[speech];[1:a]volume=${musicVolume}[music];[speech][music]amix=inputs=2:duration=first:dropout_transition=0[aout]" ` +
          `-map 0:v -map "[aout]" ` +
          `-c:v copy -c:a aac -b:a 192k -t ${totalDuration} ` +
          `"${outputPath}" 2>&1`,
          { timeout: 600000 }
        );
      } else {
        await execAsync(`cp "${concatenatedPath}" "${outputPath}"`, { timeout: 30000 });
      }
    } else {
      await execAsync(`cp "${concatenatedPath}" "${outputPath}"`, { timeout: 30000 });
    }

    // Verify output exists
    if (!await fileExists(outputPath)) {
      throw new Error("Le fichier de sortie n'a pas été créé");
    }

    // Get final duration for confirmation
    const finalDuration = await getVideoDuration(outputPath);

    // Cleanup
    try { await execAsync(`rm -rf "${sessionDir}"`, { timeout: 10000 }); } catch {}

    const outputUrl = `/assembled/${outputFileName}`;

    return NextResponse.json({
      success: true,
      outputUrl,
      fileName: outputFileName,
      sceneCount: sceneClips.length,
      totalScenes: episode.scenes.length,
      hasBgMusic: !!episode.bgMusicUrl,
      durationSeconds: Math.round(finalDuration),
      message: `Épisode assemblé : ${sceneClips.length} scènes · ${Math.round(finalDuration)}s · ${episode.bgMusicUrl ? "avec musique de fond" : "sans musique"}`,
    });

  } catch (error) {
    console.error("Assemble error:", error);
    const msg = error instanceof Error ? error.message : "Assemblage échoué";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
