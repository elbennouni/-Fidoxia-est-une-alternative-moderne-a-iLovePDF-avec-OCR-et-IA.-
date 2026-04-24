// Real API pricing as of 2026
export const COSTS = {
  // DALL-E 3
  "dalle3-standard-1024": 0.040,      // 1024x1024
  "dalle3-standard-portrait": 0.080,  // 1024x1792 (9:16)
  "dalle3-standard-landscape": 0.080, // 1792x1024 (16:9)
  "dalle3-hd-1024": 0.080,
  "dalle3-hd-portrait": 0.120,
  "dalle3-hd-landscape": 0.120,

  // GPT-4o (per 1K tokens approx)
  "gpt4o-script": 0.015,       // ~1500 tokens avg script gen
  "gpt4o-qc": 0.003,           // ~300 tokens per scene QC
  "gpt4o-fix": 0.010,          // ~1000 tokens per fix
  "gpt4o-import": 0.020,       // ~2000 tokens to analyze scenario
  "gpt4o-artistic": 0.008,     // ~800 tokens artistic direction

  // HeyGen TTS (per 1000 chars)
  "heygen-tts": 0.008,

  // Video generation (estimated credits)
  "kling-5s": 0.35,
  "kling-10s": 0.70,
  "runway-5s": 0.25,
  "runway-10s": 0.50,
  "replicate-video": 0.20,
};

export function getImageCost(format: string, quality: "standard" | "hd" = "standard"): number {
  if (format === "9:16") return quality === "hd" ? COSTS["dalle3-hd-portrait"] : COSTS["dalle3-standard-portrait"];
  if (format === "16:9") return quality === "hd" ? COSTS["dalle3-hd-landscape"] : COSTS["dalle3-standard-landscape"];
  return quality === "hd" ? COSTS["dalle3-hd-1024"] : COSTS["dalle3-standard-1024"];
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return `~$${(usd * 100).toFixed(2)}¢`;
  return `~$${usd.toFixed(3)}`;
}

export function formatCostFr(usd: number): string {
  if (usd >= 1) return `~${usd.toFixed(2)} $`;
  if (usd >= 0.01) return `~${usd.toFixed(3)} $`;
  return `~${(usd * 100).toFixed(1)}¢`;
}
