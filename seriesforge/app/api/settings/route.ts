import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";

const ENV_PATH = path.join(process.cwd(), ".env");

async function readEnv(): Promise<Record<string, string>> {
  try {
    const content = await readFile(ENV_PATH, "utf-8");
    const result: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const match = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
      if (match) result[match[1]] = match[2];
    }
    return result;
  } catch {
    return {};
  }
}

async function writeEnv(vars: Record<string, string>) {
  const lines = Object.entries(vars).map(([k, v]) => `${k}="${v}"`);
  await writeFile(ENV_PATH, lines.join("\n") + "\n", "utf-8");
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const env = await readEnv();
    // Return masked values
    const masked: Record<string, string> = {};
    for (const [k, v] of Object.entries(env)) {
      if (k === "DATABASE_URL" || k === "JWT_SECRET" || k === "NEXT_PUBLIC_APP_URL") continue;
      masked[k] = v ? `${v.slice(0, 8)}${"*".repeat(Math.max(0, v.length - 8))}` : "";
    }
    return NextResponse.json({ keys: masked });
  } catch (error) {
    return NextResponse.json({ error: "Failed to read settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const env = await readEnv();

    const allowed = ["OPENAI_API_KEY", "REPLICATE_API_TOKEN", "FAL_API_KEY", "HEYGEN_API_KEY", "TOGETHER_API_KEY", "HUGGINGFACE_API_KEY", "STABILITY_API_KEY", "NANOBANA_API_KEY", "ELEVENLABS_API_KEY"];
    for (const key of allowed) {
      if (body[key] !== undefined && body[key] !== "") {
        env[key] = body[key];
      }
    }

    // Ensure required keys exist
    if (!env.DATABASE_URL) env.DATABASE_URL = "file:./dev.db";
    if (!env.JWT_SECRET) env.JWT_SECRET = "seriesforge-super-secret-jwt-key-2024";
    if (!env.NEXT_PUBLIC_APP_URL) env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    await writeEnv(env);

    // Update process.env immediately so current process uses them
    for (const key of allowed) {
      if (body[key]) process.env[key] = body[key];
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
