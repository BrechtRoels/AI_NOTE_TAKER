"""Speech-to-Text via PwC GenAI Shared Service API.

Uses OpenAI-compatible audio transcription endpoint with model:
- openai.gpt-4o-mini-transcribe (default, configurable via GENAI_STT_MODEL)
"""

import io
import logging
import asyncio
import httpx
from config import GENAI_BASE_URL, GENAI_API_KEY, GENAI_API_VERSION, GENAI_STT_MODEL, USE_MOCK_AI
from usage import record_usage

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_BACKOFF = [1, 3, 8]  # seconds between retries


def _params():
    return {"api-version": GENAI_API_VERSION} if GENAI_API_VERSION else {}


async def transcribe_audio(audio_bytes: bytes, sample_rate: int = 16000) -> dict:
    """Transcribe audio bytes to text using gpt-4o-mini-transcribe.

    Retries on transient errors with exponential backoff.

    Returns dict with:
        text: full transcription string
        segments: list of {"text": str, "start": float, "end": float}
        words: list of {"word": str, "start": float, "end": float}
    """
    if USE_MOCK_AI:
        return {"text": "[Mock transcription of audio segment]", "segments": [], "words": []}

    logger.info(f"STT request: {len(audio_bytes)} bytes, model={GENAI_STT_MODEL}")

    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            return await _do_transcribe(audio_bytes)
        except (httpx.TimeoutException, httpx.ReadError, httpx.WriteError, httpx.ConnectError, OSError) as e:
            last_error = e
            if attempt < MAX_RETRIES - 1:
                wait = RETRY_BACKOFF[attempt]
                logger.warning(f"STT attempt {attempt + 1} failed ({type(e).__name__}), retrying in {wait}s...")
                await asyncio.sleep(wait)
        except httpx.HTTPStatusError as e:
            if e.response.status_code >= 500:
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    wait = RETRY_BACKOFF[attempt]
                    logger.warning(f"STT attempt {attempt + 1} got {e.response.status_code}, retrying in {wait}s...")
                    await asyncio.sleep(wait)
            else:
                raise
    raise last_error


async def _do_transcribe(audio_bytes: bytes) -> dict:
    """Single attempt at transcription."""
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{GENAI_BASE_URL}/v1/audio/transcriptions",
            params=_params(),
            headers={"api-key": GENAI_API_KEY},
            data={"model": GENAI_STT_MODEL},
            files={"file": ("audio.webm", io.BytesIO(audio_bytes), "audio/webm")},
        )

        logger.info(f"STT response status: {resp.status_code}")
        logger.info(f"STT response body: {resp.text[:500]}")
        resp.raise_for_status()

        content_type = resp.headers.get("content-type", "")

        # Estimate audio duration from chunk size (~32kB/s for 16kHz 16-bit mono)
        audio_seconds = len(audio_bytes) / 32000.0

        if "application/json" in content_type:
            data = resp.json()
            if isinstance(data, str):
                record_usage(model=GENAI_STT_MODEL, audio_seconds=audio_seconds)
                return {"text": data, "segments": [], "words": []}
            text = data.get("text", data.get("response", ""))
            segments = data.get("segments", [])
            words = data.get("words", [])
            if data.get("duration"):
                audio_seconds = float(data["duration"])
            record_usage(model=GENAI_STT_MODEL, audio_seconds=audio_seconds)
            return {"text": text, "segments": segments, "words": words}
        else:
            record_usage(model=GENAI_STT_MODEL, audio_seconds=audio_seconds)
            return {"text": resp.text.strip(), "segments": [], "words": []}
