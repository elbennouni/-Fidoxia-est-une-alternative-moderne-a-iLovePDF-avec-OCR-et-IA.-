"""Tests for fidoxia.openai_client.

All tests run **without** a real OpenAI key: the SDK's HTTP transport is
replaced by `respx` (for httpx) so every request is intercepted and answered
with a canned JSON payload.
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock, patch

import httpx
import pytest
import respx

from fidoxia.openai_client import (
    AsyncFidoxiaOpenAIClient,
    ClientConfig,
    DEFAULT_EMBEDDING_MODEL,
    DEFAULT_MODEL,
    FidoxiaOpenAIClient,
    _guess_mime,
)


# ---------------------------------------------------------------------------
# Helpers – canned OpenAI-shaped JSON responses
# ---------------------------------------------------------------------------

def _chat_completion_json(content: str = "Hello!", model: str = DEFAULT_MODEL) -> dict:
    return {
        "id": "chatcmpl-test123",
        "object": "chat.completion",
        "created": 1700000000,
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
    }


def _embedding_json(vectors: list[list[float]] | None = None) -> dict:
    vectors = vectors or [[0.1, 0.2, 0.3]]
    return {
        "object": "list",
        "model": DEFAULT_EMBEDDING_MODEL,
        "data": [
            {"object": "embedding", "index": i, "embedding": vec}
            for i, vec in enumerate(vectors)
        ],
        "usage": {"prompt_tokens": 5, "total_tokens": 5},
    }


TEST_CONFIG = ClientConfig(
    api_key="sk-test-key-not-real",
    base_url="https://api.openai.test/v1",
)


# ---------------------------------------------------------------------------
# ClientConfig
# ---------------------------------------------------------------------------

class TestClientConfig:
    def test_defaults(self):
        cfg = ClientConfig(api_key="k")
        assert cfg.model == DEFAULT_MODEL
        assert cfg.embedding_model == DEFAULT_EMBEDDING_MODEL
        assert cfg.temperature == 0.2
        assert cfg.max_tokens == 4096
        assert cfg.base_url is None

    def test_from_env(self, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-env")
        monkeypatch.setenv("FIDOXIA_MODEL", "gpt-3.5-turbo")
        monkeypatch.setenv("OPENAI_BASE_URL", "https://custom.api/v1")
        cfg = ClientConfig.from_env()
        assert cfg.api_key == "sk-env"
        assert cfg.model == "gpt-3.5-turbo"
        assert cfg.base_url == "https://custom.api/v1"

    def test_from_env_defaults(self, monkeypatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.delenv("FIDOXIA_MODEL", raising=False)
        monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
        cfg = ClientConfig.from_env()
        assert cfg.api_key == ""
        assert cfg.model == DEFAULT_MODEL
        assert cfg.base_url is None

    def test_frozen(self):
        cfg = ClientConfig(api_key="k")
        with pytest.raises(AttributeError):
            cfg.api_key = "other"  # type: ignore[misc]

    def test_custom_extra_headers(self):
        cfg = ClientConfig(api_key="k", extra_headers={"X-Custom": "val"})
        assert cfg.extra_headers == {"X-Custom": "val"}


# ---------------------------------------------------------------------------
# Sync client – chat
# ---------------------------------------------------------------------------

class TestSyncChat:
    @respx.mock
    def test_chat_returns_completion(self):
        route = respx.post("https://api.openai.test/v1/chat/completions").mock(
            return_value=httpx.Response(200, json=_chat_completion_json("Bonjour"))
        )
        client = FidoxiaOpenAIClient(TEST_CONFIG)
        completion = client.chat("Say hello")
        assert route.called
        assert completion.choices[0].message.content == "Bonjour"

    @respx.mock
    def test_chat_text_returns_string(self):
        respx.post("https://api.openai.test/v1/chat/completions").mock(
            return_value=httpx.Response(200, json=_chat_completion_json("World"))
        )
        client = FidoxiaOpenAIClient(TEST_CONFIG)
        assert client.chat_text("Hi") == "World"

    @respx.mock
    def test_chat_custom_params(self):
        respx.post("https://api.openai.test/v1/chat/completions").mock(
            return_value=httpx.Response(200, json=_chat_completion_json("ok"))
        )
        client = FidoxiaOpenAIClient(TEST_CONFIG)
        result = client.chat_text(
            "test",
            model="gpt-3.5-turbo",
            temperature=0.9,
            max_tokens=100,
            system="You are a pirate.",
        )
        assert result == "ok"

    @respx.mock
    def test_chat_sends_correct_body(self):
        route = respx.post("https://api.openai.test/v1/chat/completions").mock(
            return_value=httpx.Response(200, json=_chat_completion_json())
        )
        client = FidoxiaOpenAIClient(TEST_CONFIG)
        client.chat("ping", system="sys")

        body = json.loads(route.calls[0].request.content)
        assert body["model"] == DEFAULT_MODEL
        assert body["messages"][0] == {"role": "system", "content": "sys"}
        assert body["messages"][1] == {"role": "user", "content": "ping"}

    @respx.mock
    def test_chat_none_content_returns_empty(self):
        payload = _chat_completion_json()
        payload["choices"][0]["message"]["content"] = None
        respx.post("https://api.openai.test/v1/chat/completions").mock(
            return_value=httpx.Response(200, json=payload)
        )
        client = FidoxiaOpenAIClient(TEST_CONFIG)
        assert client.chat_text("hi") == ""


# ---------------------------------------------------------------------------
# Sync client – embeddings
# ---------------------------------------------------------------------------

class TestSyncEmbeddings:
    @respx.mock
    def test_embed_single(self):
        respx.post("https://api.openai.test/v1/embeddings").mock(
            return_value=httpx.Response(200, json=_embedding_json([[1.0, 2.0]]))
        )
        client = FidoxiaOpenAIClient(TEST_CONFIG)
        vecs = client.embed(["hello"])
        assert vecs == [[1.0, 2.0]]

    @respx.mock
    def test_embed_multiple(self):
        respx.post("https://api.openai.test/v1/embeddings").mock(
            return_value=httpx.Response(
                200,
                json=_embedding_json([[0.1, 0.2], [0.3, 0.4]]),
            )
        )
        client = FidoxiaOpenAIClient(TEST_CONFIG)
        vecs = client.embed(["a", "b"])
        assert len(vecs) == 2

    @respx.mock
    def test_embed_custom_model(self):
        route = respx.post("https://api.openai.test/v1/embeddings").mock(
            return_value=httpx.Response(200, json=_embedding_json())
        )
        client = FidoxiaOpenAIClient(TEST_CONFIG)
        client.embed(["x"], model="text-embedding-ada-002")
        body = json.loads(route.calls[0].request.content)
        assert body["model"] == "text-embedding-ada-002"


# ---------------------------------------------------------------------------
# Sync client – image analysis
# ---------------------------------------------------------------------------

class TestSyncImageAnalysis:
    @respx.mock
    def test_analyse_image_png(self, tmp_path):
        img = tmp_path / "test.png"
        img.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 16)

        respx.post("https://api.openai.test/v1/chat/completions").mock(
            return_value=httpx.Response(
                200, json=_chat_completion_json("A white square")
            )
        )
        client = FidoxiaOpenAIClient(TEST_CONFIG)
        result = client.analyse_image(img)
        assert result == "A white square"

    @respx.mock
    def test_analyse_image_sends_base64(self, tmp_path):
        img = tmp_path / "photo.jpg"
        img.write_bytes(b"\xff\xd8\xff" + b"\x00" * 10)

        route = respx.post("https://api.openai.test/v1/chat/completions").mock(
            return_value=httpx.Response(200, json=_chat_completion_json("ok"))
        )
        client = FidoxiaOpenAIClient(TEST_CONFIG)
        client.analyse_image(img, prompt="What is this?")

        body = json.loads(route.calls[0].request.content)
        user_content = body["messages"][0]["content"]
        assert user_content[0]["text"] == "What is this?"
        assert user_content[1]["image_url"]["url"].startswith("data:image/jpeg;base64,")

    @respx.mock
    def test_analyse_image_with_path_string(self, tmp_path):
        img = tmp_path / "pic.webp"
        img.write_bytes(b"RIFF" + b"\x00" * 8)

        respx.post("https://api.openai.test/v1/chat/completions").mock(
            return_value=httpx.Response(200, json=_chat_completion_json("webp image"))
        )
        client = FidoxiaOpenAIClient(TEST_CONFIG)
        result = client.analyse_image(str(img))
        assert result == "webp image"


# ---------------------------------------------------------------------------
# Async client
# ---------------------------------------------------------------------------

class TestAsyncChat:
    @respx.mock
    @pytest.mark.asyncio
    async def test_async_chat_text(self):
        respx.post("https://api.openai.test/v1/chat/completions").mock(
            return_value=httpx.Response(200, json=_chat_completion_json("async hi"))
        )
        client = AsyncFidoxiaOpenAIClient(TEST_CONFIG)
        result = await client.chat_text("hello")
        assert result == "async hi"

    @respx.mock
    @pytest.mark.asyncio
    async def test_async_chat_completion_object(self):
        respx.post("https://api.openai.test/v1/chat/completions").mock(
            return_value=httpx.Response(200, json=_chat_completion_json("obj"))
        )
        client = AsyncFidoxiaOpenAIClient(TEST_CONFIG)
        comp = await client.chat("test")
        assert comp.id == "chatcmpl-test123"
        assert comp.choices[0].message.content == "obj"

    @respx.mock
    @pytest.mark.asyncio
    async def test_async_embed(self):
        respx.post("https://api.openai.test/v1/embeddings").mock(
            return_value=httpx.Response(200, json=_embedding_json([[9.0, 8.0]]))
        )
        client = AsyncFidoxiaOpenAIClient(TEST_CONFIG)
        vecs = await client.embed(["test"])
        assert vecs == [[9.0, 8.0]]


# ---------------------------------------------------------------------------
# _guess_mime helper
# ---------------------------------------------------------------------------

class TestGuessMime:
    @pytest.mark.parametrize(
        "suffix, expected",
        [
            (".png", "image/png"),
            (".jpg", "image/jpeg"),
            (".jpeg", "image/jpeg"),
            (".gif", "image/gif"),
            (".webp", "image/webp"),
            (".bmp", "image/bmp"),
            (".xyz", "application/octet-stream"),
        ],
    )
    def test_known_and_unknown(self, suffix, expected):
        assert _guess_mime(Path(f"file{suffix}")) == expected


# ---------------------------------------------------------------------------
# Client property access
# ---------------------------------------------------------------------------

class TestClientProperties:
    def test_sync_config_accessible(self):
        client = FidoxiaOpenAIClient(TEST_CONFIG)
        assert client.config is TEST_CONFIG

    def test_async_config_accessible(self):
        client = AsyncFidoxiaOpenAIClient(TEST_CONFIG)
        assert client.config is TEST_CONFIG

    def test_default_config_from_env(self, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-auto")
        client = FidoxiaOpenAIClient()
        assert client.config.api_key == "sk-auto"
