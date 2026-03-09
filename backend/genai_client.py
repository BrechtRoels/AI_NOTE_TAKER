import json
import asyncio
import logging
import httpx
import numpy as np
from collections.abc import AsyncIterator
from config import (
    GENAI_BASE_URL, GENAI_API_KEY, GENAI_API_VERSION,
    GENAI_LLM_MODEL, GENAI_EMBEDDINGS_MODEL, USE_MOCK_AI,
)

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_BACKOFF = [1, 3, 8]


def _params():
    return {"api-version": GENAI_API_VERSION} if GENAI_API_VERSION else {}
from usage import record_usage


def _headers():
    return {
        "api-key": GENAI_API_KEY,
        "Content-Type": "application/json",
    }


def _extract_text(data: dict) -> str:
    """Extract text from any of the PwC API response formats."""
    if "output" in data:
        for item in data["output"]:
            if item.get("type") == "message":
                for c in item.get("content", []):
                    if c.get("type") == "output_text":
                        return c["text"]
    if "choices" in data:
        return data["choices"][0]["message"]["content"]
    if "response" in data:
        return data["response"]
    return str(data)


async def llm_complete(prompt: str, model: str | None = None) -> str:
    """Complete a prompt with retry on transient errors."""
    if USE_MOCK_AI:
        return f"[Mock response for: {prompt[:80]}...]"

    model = model or GENAI_LLM_MODEL
    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    f"{GENAI_BASE_URL}/v1/responses",
                    params=_params(),
                    headers=_headers(),
                    json={"model": model, "input": prompt},
                )
                resp.raise_for_status()
                data = resp.json()

                usage = data.get("usage", {})
                record_usage(
                    model=model,
                    prompt_tokens=usage.get("prompt_tokens", usage.get("input_tokens", 0)),
                    completion_tokens=usage.get("completion_tokens", usage.get("output_tokens", 0)),
                    total_tokens=usage.get("total_tokens", 0),
                )

                return _extract_text(data)
        except (httpx.TimeoutException, httpx.ReadError, httpx.ConnectError) as e:
            last_error = e
            if attempt < MAX_RETRIES - 1:
                wait = RETRY_BACKOFF[attempt]
                logger.warning(f"LLM attempt {attempt + 1} failed ({type(e).__name__}), retrying in {wait}s...")
                await asyncio.sleep(wait)
        except httpx.HTTPStatusError as e:
            if e.response.status_code >= 500:
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    wait = RETRY_BACKOFF[attempt]
                    logger.warning(f"LLM attempt {attempt + 1} got {e.response.status_code}, retrying in {wait}s...")
                    await asyncio.sleep(wait)
            else:
                raise
    raise last_error


async def llm_stream(prompt: str, model: str | None = None) -> AsyncIterator[str]:
    """Stream LLM completion token by token via SSE."""
    if USE_MOCK_AI:
        for word in f"[Mock streaming response for: {prompt[:60]}...]".split():
            yield word + " "
        return

    model = model or GENAI_LLM_MODEL
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            f"{GENAI_BASE_URL}/v1/responses",
            params=_params(),
            headers=_headers(),
            json={"model": model, "input": prompt, "stream": True},
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                payload = line[6:]
                if payload == "[DONE]":
                    break
                try:
                    chunk = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                # Handle different streaming formats
                delta = ""
                if "delta" in chunk:
                    delta = chunk["delta"]
                elif "choices" in chunk:
                    delta = (chunk["choices"][0].get("delta", {}).get("content") or "")
                elif "output" in chunk:
                    for item in chunk.get("output", []):
                        for c in item.get("content", []):
                            if c.get("type") == "output_text":
                                delta = c.get("text", "")
                if delta:
                    yield delta


async def rerank(query: str, documents: list[str], top_n: int = 8,
                  model: str = "bedrock.cohere.rerank-3-5") -> list[dict]:
    """Rerank documents by relevance to query. Returns [{"index": int, "relevance_score": float}, ...]."""
    if USE_MOCK_AI:
        return [{"index": i, "relevance_score": 1.0 - i * 0.1} for i in range(min(top_n, len(documents)))]

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{GENAI_BASE_URL}/v1/rerank",
            params=_params(),
            headers=_headers(),
            json={
                "model": model,
                "query": query,
                "documents": documents,
                "top_n": top_n,
            },
        )
        resp.raise_for_status()
        data = resp.json()

        usage = data.get("usage", {})
        record_usage(
            model=model,
            prompt_tokens=usage.get("prompt_tokens", usage.get("search_units", 0)),
            total_tokens=usage.get("total_tokens", 0),
        )

        return data.get("results", [])


async def get_embeddings(texts: list[str], model: str | None = None) -> list[list[float]]:
    if USE_MOCK_AI:
        rng = np.random.default_rng(42)
        return [rng.standard_normal(1536).tolist() for _ in texts]

    model = model or GENAI_EMBEDDINGS_MODEL
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{GENAI_BASE_URL}/v1/embeddings",
            params=_params(),
            headers=_headers(),
            json={"model": model, "input": texts},
        )
        resp.raise_for_status()
        data = resp.json()

        # Track usage
        usage = data.get("usage", {})
        record_usage(
            model=model,
            prompt_tokens=usage.get("prompt_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
        )

        sorted_data = sorted(data["data"], key=lambda x: x["index"])
        return [item["embedding"] for item in sorted_data]
