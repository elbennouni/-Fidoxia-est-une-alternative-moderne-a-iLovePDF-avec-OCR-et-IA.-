import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const DURABLE_REMOTE_HOSTS = ["fal.run", "fal.media", "catbox.moe"];

function getExtensionFromMimeType(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  return "jpg";
}

function getMimeTypeFromExtension(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}

function getExtensionFromUrl(url: string): string | null {
  try {
    const pathname = url.startsWith("http") ? new URL(url).pathname : url;
    const ext = pathname.split(".").pop()?.toLowerCase();
    if (!ext) return null;
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
      return ext === "jpeg" ? "jpg" : ext;
    }
    return null;
  } catch {
    return null;
  }
}

function buildFileName(prefix: string, ext: string): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "image";
  return `${safePrefix}-${uuidv4().slice(0, 8)}.${ext}`;
}

export function isDurableImageUrl(imageUrl: string): boolean {
  if (!imageUrl) return false;
  if (imageUrl.startsWith("/uploads/")) return false;
  if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) return false;

  try {
    const { host } = new URL(imageUrl);
    return DURABLE_REMOTE_HOSTS.some((durableHost) => host.includes(durableHost));
  } catch {
    return false;
  }
}

function isLikelyTemporaryRemoteUrl(imageUrl: string): boolean {
  if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) return false;

  try {
    const parsed = new URL(imageUrl);
    const hasSignedQuery = ["sig", "se", "sp", "sv"].some((key) => parsed.searchParams.has(key));
    const host = parsed.host.toLowerCase();
    return (
      hasSignedQuery ||
      host.includes("tmpfiles.org") ||
      host.includes("blob.core.windows.net") ||
      host.includes("oaiusercontent.com") ||
      host.includes("openai")
    );
  } catch {
    return false;
  }
}

async function uploadBufferToFalStorage(buffer: Buffer, fileName: string, mimeType: string): Promise<string | null> {
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

async function uploadBufferToCatboxStorage(buffer: Buffer, fileName: string, mimeType: string): Promise<string | null> {
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

async function saveBufferLocally(buffer: Buffer, folder: string, ext: string): Promise<string> {
  const fileName = buildFileName(folder, ext);
  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), buffer);
  return `/uploads/${folder}/${fileName}`;
}

async function readLocalImage(localPath: string): Promise<{ buffer: Buffer; ext: string; mimeType: string }> {
  const filePath = path.join(process.cwd(), "public", localPath);
  const buffer = await readFile(filePath);
  const ext = getExtensionFromUrl(localPath) || "jpg";
  return { buffer, ext, mimeType: getMimeTypeFromExtension(ext) };
}

async function downloadRemoteImage(imageUrl: string): Promise<{ buffer: Buffer; ext: string; mimeType: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image (${response.status})`);
  }

  const mimeTypeHeader = response.headers.get("content-type") || "";
  const mimeType = mimeTypeHeader.startsWith("image/") ? mimeTypeHeader : "";
  const ext = getExtensionFromUrl(imageUrl) || (mimeType ? getExtensionFromMimeType(mimeType) : "jpg");
  const finalMimeType = mimeType || getMimeTypeFromExtension(ext);
  const buffer = Buffer.from(await response.arrayBuffer());

  return { buffer, ext, mimeType: finalMimeType };
}

async function persistImageBuffer(buffer: Buffer, folder: string, fileNamePrefix: string, ext: string, mimeType: string): Promise<string> {
  const fileName = buildFileName(fileNamePrefix, ext);
  const falUrl = await uploadBufferToFalStorage(buffer, fileName, mimeType);
  if (falUrl) return falUrl;
  const catboxUrl = await uploadBufferToCatboxStorage(buffer, fileName, mimeType);
  if (catboxUrl) return catboxUrl;
  return saveBufferLocally(buffer, folder, ext);
}

export async function ensureDurableImageUrl(
  imageUrl: string,
  options: { folder: string; fileNamePrefix: string; forceRehostRemote?: boolean }
): Promise<string> {
  if (!imageUrl) throw new Error("Missing image URL");
  const { folder, fileNamePrefix, forceRehostRemote = false } = options;

  if (isDurableImageUrl(imageUrl)) return imageUrl;

  if (imageUrl.startsWith("/")) {
    const { buffer, ext, mimeType } = await readLocalImage(imageUrl);
    return persistImageBuffer(buffer, folder, fileNamePrefix, ext, mimeType);
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    const { buffer, ext, mimeType } = await downloadRemoteImage(imageUrl);
    return persistImageBuffer(buffer, folder, fileNamePrefix, ext, mimeType);
  }

  return imageUrl;
}

export async function tryEnsureDurableImageUrl(
  imageUrl: string,
  options: { folder: string; fileNamePrefix: string; forceRehostRemote?: boolean }
): Promise<string | null> {
  try {
    return await ensureDurableImageUrl(imageUrl, options);
  } catch {
    return null;
  }
}

export async function persistGeneratedImageUrl(
  imageUrl: string,
  options: { folder: string; fallbackName: string }
): Promise<string> {
  return ensureDurableImageUrl(imageUrl, {
    folder: options.folder,
    fileNamePrefix: options.fallbackName,
    forceRehostRemote: true,
  });
}
