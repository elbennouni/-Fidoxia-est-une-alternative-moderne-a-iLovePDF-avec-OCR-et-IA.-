"""Thin wrapper around the OpenAI Python SDK used by Fidoxia.

Provides helpers for:
- Chat completions  (text generation, summarisation, …)
- Vision / image analysis  (used by the OCR pipeline)
- Embeddings
"""

from __future__ import annotations

import base64
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from openai import AsyncOpenAI, OpenAI
from openai.types.chat import ChatCompletion


DEFAULT_MODEL = "gpt-4o"
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"


@dataclass(frozen=True)
class ClientConfig:
    """Immutable configuration for the OpenAI client."""

    api_key: str = ""
    model: str = DEFAULT_MODEL
    embedding_model: str = DEFAULT_EMBEDDING_MODEL
    temperature: float = 0.2
    max_tokens: int = 4096
    base_url: str | None = None
    extra_headers: dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_env(cls) -> ClientConfig:
        """Build a config from environment variables."""
        return cls(
            api_key=os.environ.get("OPENAI_API_KEY", ""),
            model=os.environ.get("FIDOXIA_MODEL", DEFAULT_MODEL),
            base_url=os.environ.get("OPENAI_BASE_URL"),
        )


class FidoxiaOpenAIClient:
    """Synchronous OpenAI client for Fidoxia."""

    def __init__(self, config: ClientConfig | None = None) -> None:
        self._cfg = config or ClientConfig.from_env()
        self._client = OpenAI(
            api_key=self._cfg.api_key,
            base_url=self._cfg.base_url,
            default_headers=self._cfg.extra_headers or None,
        )

    @property
    def config(self) -> ClientConfig:
        return self._cfg

    def chat(
        self,
        prompt: str,
        *,
        system: str = "You are a helpful assistant.",
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> ChatCompletion:
        """Send a simple user prompt and return the raw ChatCompletion."""
        return self._client.chat.completions.create(
            model=model or self._cfg.model,
            temperature=temperature if temperature is not None else self._cfg.temperature,
            max_tokens=max_tokens or self._cfg.max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        )

    def chat_text(self, prompt: str, **kwargs: Any) -> str:
        """Convenience: return only the assistant's text reply."""
        completion = self.chat(prompt, **kwargs)
        return completion.choices[0].message.content or ""

    def analyse_image(
        self,
        image_path: str | Path,
        prompt: str = "Describe this image in detail.",
        *,
        model: str | None = None,
    ) -> str:
        """Send an image to a vision model and return the text response."""
        image_path = Path(image_path)
        mime = _guess_mime(image_path)
        b64 = base64.b64encode(image_path.read_bytes()).decode()

        completion = self._client.chat.completions.create(
            model=model or self._cfg.model,
            max_tokens=self._cfg.max_tokens,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime};base64,{b64}"},
                        },
                    ],
                }
            ],
        )
        return completion.choices[0].message.content or ""

    def embed(
        self,
        texts: list[str],
        *,
        model: str | None = None,
    ) -> list[list[float]]:
        """Return embedding vectors for a list of texts."""
        resp = self._client.embeddings.create(
            model=model or self._cfg.embedding_model,
            input=texts,
        )
        return [item.embedding for item in resp.data]


class AsyncFidoxiaOpenAIClient:
    """Async counterpart of FidoxiaOpenAIClient."""

    def __init__(self, config: ClientConfig | None = None) -> None:
        self._cfg = config or ClientConfig.from_env()
        self._client = AsyncOpenAI(
            api_key=self._cfg.api_key,
            base_url=self._cfg.base_url,
            default_headers=self._cfg.extra_headers or None,
        )

    @property
    def config(self) -> ClientConfig:
        return self._cfg

    async def chat(
        self,
        prompt: str,
        *,
        system: str = "You are a helpful assistant.",
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> ChatCompletion:
        return await self._client.chat.completions.create(
            model=model or self._cfg.model,
            temperature=temperature if temperature is not None else self._cfg.temperature,
            max_tokens=max_tokens or self._cfg.max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        )

    async def chat_text(self, prompt: str, **kwargs: Any) -> str:
        completion = await self.chat(prompt, **kwargs)
        return completion.choices[0].message.content or ""

    async def embed(
        self,
        texts: list[str],
        *,
        model: str | None = None,
    ) -> list[list[float]]:
        resp = await self._client.embeddings.create(
            model=model or self._cfg.embedding_model,
            input=texts,
        )
        return [item.embedding for item in resp.data]


def _guess_mime(path: Path) -> str:
    suffix = path.suffix.lower()
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
    }.get(suffix, "application/octet-stream")
