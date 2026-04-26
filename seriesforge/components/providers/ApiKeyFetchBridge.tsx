"use client";

import { useEffect } from "react";

const API_KEYS = [
  "OPENAI_API_KEY",
  "REPLICATE_API_TOKEN",
  "FAL_API_KEY",
  "HEYGEN_API_KEY",
  "TOGETHER_API_KEY",
  "HUGGINGFACE_API_KEY",
  "STABILITY_API_KEY",
  "NANOBANA_API_KEY",
  "ELEVENLABS_API_KEY",
] as const;

function toHeaderName(key: string): string {
  return `x-sf-${key.toLowerCase().replace(/_/g, "-")}`;
}

function isSameOriginApiRequest(input: RequestInfo | URL): boolean {
  if (typeof input === "string") {
    return input.startsWith("/api/") || input.startsWith(`${window.location.origin}/api/`);
  }
  if (input instanceof URL) {
    return input.origin === window.location.origin && input.pathname.startsWith("/api/");
  }
  return input.url.startsWith(`${window.location.origin}/api/`) || new URL(input.url, window.location.origin).pathname.startsWith("/api/");
}

export default function ApiKeyFetchBridge() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!isSameOriginApiRequest(input)) {
        return originalFetch(input, init);
      }

      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      if (init?.headers) {
        new Headers(init.headers).forEach((value, key) => headers.set(key, value));
      }

      for (const key of API_KEYS) {
        const value = window.localStorage.getItem(key);
        if (value?.trim()) {
          headers.set(toHeaderName(key), value.trim());
        }
      }

      if (input instanceof Request) {
        return originalFetch(new Request(input, { ...init, headers }));
      }

      return originalFetch(input, { ...init, headers });
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
