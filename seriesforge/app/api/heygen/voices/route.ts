import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!HEYGEN_API_KEY) {
      // Return mock voices if no API key
      return NextResponse.json({
        voices: [
          { voice_id: "mock-1", name: "French Male - Pierre", language: "fr", gender: "male" },
          { voice_id: "mock-2", name: "French Female - Marie", language: "fr", gender: "female" },
          { voice_id: "mock-3", name: "English Male - James", language: "en", gender: "male" },
          { voice_id: "mock-4", name: "English Female - Emma", language: "en", gender: "female" },
          { voice_id: "mock-5", name: "Energetic Host - Alex", language: "en", gender: "male" },
        ],
        note: "Add HEYGEN_API_KEY to .env for real voices"
      });
    }

    const res = await fetch("https://api.heygen.com/v2/voices", {
      headers: { "X-Api-Key": HEYGEN_API_KEY },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch voices" }, { status: 500 });
  }
}
