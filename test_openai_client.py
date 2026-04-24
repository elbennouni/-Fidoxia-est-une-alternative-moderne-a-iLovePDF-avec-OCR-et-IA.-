"""
Tests for the OpenAI Python client API (Chat, Models, Embeddings, Moderation).
Requires OPENAI_API_KEY to be set in the environment.
"""

import os
import sys
import time
import openai

client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
results: list[tuple[str, bool, str]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    status = PASS if ok else FAIL
    print(f"  [{status}] {name}" + (f": {detail}" if detail else ""))


# ---------------------------------------------------------------------------
# 1. List models
# ---------------------------------------------------------------------------
print("\n=== 1. List Models ===")
try:
    models = client.models.list()
    ids = [m.id for m in models.data]
    ok = len(ids) > 0
    record("models.list() returns at least one model", ok, f"{len(ids)} models found")
    has_gpt = any("gpt" in i for i in ids)
    record("At least one GPT model available", has_gpt, ", ".join(i for i in ids if "gpt" in i)[:120])
except Exception as exc:
    record("models.list()", False, str(exc))


# ---------------------------------------------------------------------------
# 2. Chat Completion – basic
# ---------------------------------------------------------------------------
print("\n=== 2. Chat Completions ===")
try:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Reply with exactly one word: Hello"}],
        max_tokens=10,
    )
    content = resp.choices[0].message.content.strip()
    ok = len(content) > 0
    record("chat.completions.create() returns content", ok, repr(content))
    record("finish_reason is 'stop'", resp.choices[0].finish_reason == "stop",
           resp.choices[0].finish_reason)
    record("usage.total_tokens > 0", resp.usage.total_tokens > 0,
           str(resp.usage.total_tokens))
except Exception as exc:
    record("chat.completions.create()", False, str(exc))


# ---------------------------------------------------------------------------
# 3. Chat Completion – system prompt + multi-turn
# ---------------------------------------------------------------------------
print("\n=== 3. Chat – System Prompt & Multi-turn ===")
try:
    messages = [
        {"role": "system", "content": "You are a concise assistant. Answer in one sentence."},
        {"role": "user", "content": "What is 2+2?"},
        {"role": "assistant", "content": "2+2 equals 4."},
        {"role": "user", "content": "Multiply that by 3."},
    ]
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        max_tokens=30,
    )
    content = resp.choices[0].message.content.strip()
    ok = len(content) > 0
    record("Multi-turn chat returns non-empty response", ok, repr(content))
except Exception as exc:
    record("Multi-turn chat", False, str(exc))


# ---------------------------------------------------------------------------
# 4. Chat Completion – streaming
# ---------------------------------------------------------------------------
print("\n=== 4. Chat – Streaming ===")
try:
    chunks: list[str] = []
    with client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Count from 1 to 5 separated by commas."}],
        max_tokens=30,
        stream=True,
    ) as stream:
        for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                chunks.append(delta)
    joined = "".join(chunks)
    ok = len(chunks) > 1
    record("Streaming yields multiple chunks", ok, f"{len(chunks)} chunks")
    record("Streamed content is non-empty", len(joined) > 0, repr(joined[:60]))
except Exception as exc:
    record("Chat streaming", False, str(exc))


# ---------------------------------------------------------------------------
# 5. Chat Completion – temperature & top_p
# ---------------------------------------------------------------------------
print("\n=== 5. Chat – Parameters (temperature / top_p) ===")
try:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Say a random color."}],
        max_tokens=10,
        temperature=0.0,
        top_p=1.0,
    )
    ok = resp.choices[0].message.content is not None
    record("temperature=0.0 + top_p=1.0 accepted", ok,
           repr(resp.choices[0].message.content.strip()))
except Exception as exc:
    record("temperature/top_p parameters", False, str(exc))


# ---------------------------------------------------------------------------
# 6. Chat Completion – n>1
# ---------------------------------------------------------------------------
print("\n=== 6. Chat – Multiple Choices (n=2) ===")
try:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Give me a one-word fruit name."}],
        max_tokens=5,
        n=2,
    )
    ok = len(resp.choices) == 2
    record("n=2 returns two choices", ok, str(len(resp.choices)))
except Exception as exc:
    record("n=2 choices", False, str(exc))


# ---------------------------------------------------------------------------
# 7. Chat Completion – stop sequences
# ---------------------------------------------------------------------------
print("\n=== 7. Chat – Stop Sequences ===")
try:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Count: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10"}],
        max_tokens=30,
        stop=["5"],
    )
    content = resp.choices[0].message.content or ""
    record("Stop sequence accepted by API", True, repr(content.strip()[:60]))
except Exception as exc:
    record("Stop sequences", False, str(exc))


# ---------------------------------------------------------------------------
# 8. Embeddings
# ---------------------------------------------------------------------------
print("\n=== 8. Embeddings ===")
try:
    resp = client.embeddings.create(
        model="text-embedding-3-small",
        input="OpenAI embeddings are great for semantic search.",
    )
    vec = resp.data[0].embedding
    ok = len(vec) > 0
    record("embeddings.create() returns a vector", ok, f"dim={len(vec)}")
    record("Embedding values are floats", all(isinstance(v, float) for v in vec[:10]), "")
except Exception as exc:
    record("embeddings.create()", False, str(exc))

try:
    resp = client.embeddings.create(
        model="text-embedding-3-small",
        input=["Hello", "World"],
    )
    ok = len(resp.data) == 2
    record("Batch embeddings (2 inputs) returns 2 vectors", ok, str(len(resp.data)))
except Exception as exc:
    record("Batch embeddings", False, str(exc))


# ---------------------------------------------------------------------------
# 9. Moderation
# ---------------------------------------------------------------------------
print("\n=== 9. Moderation ===")
try:
    resp = client.moderations.create(input="I love programming and helping people.")
    result = resp.results[0]
    ok = not result.flagged
    record("Safe text not flagged by moderation", ok, str(result.flagged))
except Exception as exc:
    record("moderations.create() safe text", False, str(exc))

try:
    resp = client.moderations.create(input="I want to harm someone.")
    result = resp.results[0]
    record("Moderations API returns result for sensitive text", True,
           f"flagged={result.flagged}")
except Exception as exc:
    record("moderations.create() sensitive text", False, str(exc))


# ---------------------------------------------------------------------------
# 10. Error handling – invalid model
# ---------------------------------------------------------------------------
print("\n=== 10. Error Handling ===")
try:
    client.chat.completions.create(
        model="gpt-nonexistent-model-xyz",
        messages=[{"role": "user", "content": "hi"}],
    )
    record("Invalid model raises NotFoundError", False, "No exception raised")
except openai.NotFoundError:
    record("Invalid model raises NotFoundError", True)
except openai.BadRequestError:
    record("Invalid model raises BadRequestError (acceptable)", True)
except Exception as exc:
    record("Invalid model raises an OpenAI error", isinstance(exc, openai.OpenAIError),
           type(exc).__name__)

try:
    bad_client = openai.OpenAI(api_key="sk-invalid-key-000000000000")
    bad_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "hi"}],
    )
    record("Invalid API key raises AuthenticationError", False, "No exception raised")
except openai.AuthenticationError:
    record("Invalid API key raises AuthenticationError", True)
except Exception as exc:
    record("Invalid API key raises an error", True, type(exc).__name__)


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print("\n" + "=" * 60)
total = len(results)
passed = sum(1 for _, ok, _ in results if ok)
failed = total - passed
print(f"Results: {passed}/{total} passed, {failed} failed")
if failed:
    print("\nFailed tests:")
    for name, ok, detail in results:
        if not ok:
            print(f"  - {name}: {detail}")
print("=" * 60)
sys.exit(0 if failed == 0 else 1)
