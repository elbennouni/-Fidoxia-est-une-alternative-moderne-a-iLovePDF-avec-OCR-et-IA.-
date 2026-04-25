import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

function guessMimeType(ext: string): string {
  switch (ext.toLowerCase()) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    default:
      return "image/jpeg";
  }
}

async function uploadToFalStorage(buffer: Buffer, fileName: string, mimeType: string): Promise<string | null> {
  const falKey = process.env.FAL_API_KEY;
  if (!falKey) return null;

  try {
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    const formData = new FormData();
    formData.append("file", blob, fileName);

    const res = await fetch("https://fal.run/fal-ai/storage/upload", {
      method: "POST",
      headers: { Authorization: `Key ${falKey}` },
      body: formData,
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  } catch {
    return null;
  }
}

async function uploadToCatbox(buffer: Buffer, fileName: string, mimeType: string): Promise<string | null> {
  try {
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    const formData = new FormData();
    formData.append("reqtype", "fileupload");
    formData.append("fileToUpload", blob, fileName);

    const res = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) return null;
    const text = (await res.text()).trim();
    return text.startsWith("http://") || text.startsWith("https://") ? text : null;
  } catch {
    return null;
  }
}

async function saveLocally(buffer: Buffer, folder: string, ext: string): Promise<string> {
  const fileName = `${uuidv4()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), buffer);
  return `/uploads/${folder}/${fileName}`;
}

export async function persistPublicAsset(params: {
  buffer: Buffer;
  folder: string;
  ext: string;
  fileNamePrefix?: string;
  mimeType?: string;
}): Promise<{ url: string; storage: "fal" | "catbox" | "local" }> {
  const { buffer, folder, ext, fileNamePrefix = folder, mimeType = guessMimeType(ext) } = params;
  const fileName = `${fileNamePrefix}-${uuidv4().slice(0, 8)}.${ext}`;

  const falUrl = await uploadToFalStorage(buffer, fileName, mimeType);
  if (falUrl) return { url: falUrl, storage: "fal" };

  const catboxUrl = await uploadToCatbox(buffer, fileName, mimeType);
  if (catboxUrl) return { url: catboxUrl, storage: "catbox" };

  const localUrl = await saveLocally(buffer, folder, ext);
  return { url: localUrl, storage: "local" };
}

export async function persistUserUpload(params: {
  buffer: Buffer;
  folder: string;
  originalFileName: string;
}): Promise<{ url: string; fileName: string; storage: "fal" | "catbox" | "local" }> {
  const ext = params.originalFileName.split(".").pop()?.toLowerCase() || "jpg";
  const fileNamePrefix = params.folder;
  const fileName = `${fileNamePrefix}-${uuidv4().slice(0, 8)}.${ext}`;
  const mimeType = guessMimeType(ext);

  const falUrl = await uploadToFalStorage(params.buffer, fileName, mimeType);
  if (falUrl) return { url: falUrl, fileName, storage: "fal" };

  const catboxUrl = await uploadToCatbox(params.buffer, fileName, mimeType);
  if (catboxUrl) return { url: catboxUrl, fileName, storage: "catbox" };

  const localUrl = await saveLocally(params.buffer, params.folder, ext);
  return { url: localUrl, fileName, storage: "local" };
}
