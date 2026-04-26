import type { NextRequest } from "next/server";

export const API_KEY_HEADER_MAP = {
  OPENAI_API_KEY: "x-sf-openai-api-key",
  REPLICATE_API_TOKEN: "x-sf-replicate-api-token",
  FAL_API_KEY: "x-sf-fal-api-key",
  HEYGEN_API_KEY: "x-sf-heygen-api-key",
  TOGETHER_API_KEY: "x-sf-together-api-key",
  HUGGINGFACE_API_KEY: "x-sf-huggingface-api-key",
  STABILITY_API_KEY: "x-sf-stability-api-key",
  NANOBANA_API_KEY: "x-sf-nanobana-api-key",
  ELEVENLABS_API_KEY: "x-sf-elevenlabs-api-key",
} as const;

export type SupportedApiKeyName = keyof typeof API_KEY_HEADER_MAP;

export function getApiKeyOverride(req: NextRequest, key: SupportedApiKeyName): string | null {
  const headerName = API_KEY_HEADER_MAP[key];
  const value = req.headers.get(headerName)?.trim();
  return value || null;
}

export function getApiKey(req: NextRequest, key: SupportedApiKeyName): string | null {
  return getApiKeyOverride(req, key) || process.env[key] || null;
}
