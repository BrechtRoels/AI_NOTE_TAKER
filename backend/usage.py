"""Token usage and cost tracking across all sessions.

Persists to a JSON file so totals survive server restarts.
"""

import json
import os
import threading
from datetime import datetime, timezone

USAGE_FILE = os.path.join(os.path.dirname(__file__), "data", "usage.json")

# Pricing per 1M tokens (USD) — OpenAI-compatible estimates
MODEL_PRICING = {
    "vertex_ai.gemini-2.0-flash": {"input": 0.10, "output": 0.40},
    "openai.gpt-5-nano": {"input": 0.10, "output": 0.40},
    "openai.gpt-4.1-nano": {"input": 0.10, "output": 0.40},
    "openai.gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "openai.gpt-4.1-mini": {"input": 0.40, "output": 1.60},
    "openai.gpt-4o": {"input": 2.50, "output": 10.00},
    "openai.gpt-4.1": {"input": 2.00, "output": 8.00},
    "openai.o3-mini": {"input": 1.10, "output": 4.40},
    "openai.o4-mini": {"input": 1.10, "output": 4.40},
    "openai.gpt-4.5-preview": {"input": 75.00, "output": 150.00},
    "openai.o3": {"input": 10.00, "output": 40.00},
    "openai.o1": {"input": 15.00, "output": 60.00},
    "azure.text-embedding-3-large": {"input": 0.13, "output": 0.0},
    "bedrock.cohere.rerank-3-5": {"input": 0.10, "output": 0.0},
    "whisper": {"per_minute": 0.006},
    "openai.gpt-4o-mini-transcribe": {"input": 1.25, "output": 5.00},
    "openai.gpt-4o-mini-tts": {"per_character": 0.000015},
}

_lock = threading.Lock()


def _ensure_dir():
    os.makedirs(os.path.dirname(USAGE_FILE), exist_ok=True)


def _load() -> dict:
    _ensure_dir()
    if os.path.exists(USAGE_FILE):
        with open(USAGE_FILE) as f:
            return json.load(f)
    return {"models": {}, "total_cost_usd": 0.0, "total_api_calls": 0}


def _save(data: dict):
    _ensure_dir()
    with open(USAGE_FILE, "w") as f:
        json.dump(data, f, indent=2)


def _estimate_cost(model: str, prompt_tokens: int, completion_tokens: int, audio_seconds: float, characters: int = 0) -> float:
    pricing = MODEL_PRICING.get(model)
    if not pricing:
        # Try partial match
        for key, val in MODEL_PRICING.items():
            if key in model or model in key:
                pricing = val
                break
    if not pricing:
        pricing = {"input": 0.15, "output": 0.60}  # default to gpt-4o-mini

    if "per_character" in pricing:
        return characters * pricing["per_character"]

    if "per_minute" in pricing:
        return (audio_seconds / 60.0) * pricing["per_minute"]

    cost = (prompt_tokens / 1_000_000) * pricing.get("input", 0)
    cost += (completion_tokens / 1_000_000) * pricing.get("output", 0)
    return cost


def record_usage(
    model: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    total_tokens: int = 0,
    audio_seconds: float = 0.0,
    characters: int = 0,
):
    """Record API usage for a model call."""
    if total_tokens and not prompt_tokens and not completion_tokens:
        prompt_tokens = total_tokens

    cost = _estimate_cost(model, prompt_tokens, completion_tokens, audio_seconds, characters)

    with _lock:
        data = _load()
        if model not in data["models"]:
            data["models"][model] = {
                "calls": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
                "audio_seconds": 0.0,
                "cost_usd": 0.0,
            }

        m = data["models"][model]
        m["calls"] += 1
        m["prompt_tokens"] += prompt_tokens
        m["completion_tokens"] += completion_tokens
        m["total_tokens"] += prompt_tokens + completion_tokens
        m["audio_seconds"] += audio_seconds
        m["cost_usd"] = round(m["cost_usd"] + cost, 6)

        data["total_api_calls"] += 1
        data["total_cost_usd"] = round(sum(v["cost_usd"] for v in data["models"].values()), 6)
        _save(data)


def get_usage() -> dict:
    """Get current usage stats."""
    with _lock:
        return _load()


def reset_usage():
    """Reset all usage data."""
    with _lock:
        _save({"models": {}, "total_cost_usd": 0.0, "total_api_calls": 0})
