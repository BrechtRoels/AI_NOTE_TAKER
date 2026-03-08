"""Speech-to-Text via PwC GenAI Shared Service API.

Uses OpenAI-compatible audio transcription endpoint with models:
- openai.gpt-4o-mini-transcribe
- whisper

whisper supports verbose_json with segment timestamps, which enables
accurate speaker-to-text alignment with diarization.
"""

import io
import logging
import httpx
from config import GENAI_BASE_URL, GENAI_API_KEY, GENAI_API_VERSION, GENAI_STT_MODEL, USE_MOCK_AI
from usage import record_usage

logger = logging.getLogger(__name__)


def _params():
    return {"api-version": GENAI_API_VERSION} if GENAI_API_VERSION else {}


# whisper supports verbose_json; gpt-4o-mini-transcribe does not
WHISPER_MODEL = "whisper"


async def transcribe_audio(audio_bytes: bytes, sample_rate: int = 16000) -> dict:
    """Transcribe audio bytes to text with segment-level timestamps.

    Uses whisper with verbose_json to get timestamped segments.
    Falls back to configured model without timestamps if that fails.

    Returns dict with:
        text: full transcription string
        segments: list of {"text": str, "start": float, "end": float}
        words: list of {"word": str, "start": float, "end": float}
    """
    if USE_MOCK_AI:
        return {"text": "[Mock transcription of audio segment]", "segments": [], "words": []}

    logger.info(f"STT request: {len(audio_bytes)} bytes")

    async with httpx.AsyncClient(timeout=60) as client:
        # Try whisper with verbose_json for timestamped segments
        resp = await client.post(
            f"{GENAI_BASE_URL}/v1/audio/transcriptions",
            params=_params(),
            headers={"api-key": GENAI_API_KEY},
            data={
                "model": WHISPER_MODEL,
                "response_format": "verbose_json",
            },
            files={"file": ("audio.webm", io.BytesIO(audio_bytes), "audio/webm")},
        )

        if resp.status_code != 200:
            logger.info(f"whisper verbose_json failed ({resp.status_code}: {resp.text[:200]}), falling back to {GENAI_STT_MODEL}")
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
                record_usage(model=WHISPER_MODEL, audio_seconds=audio_seconds)
                return {"text": data, "segments": [], "words": []}
            text = data.get("text", data.get("response", ""))
            segments = data.get("segments", [])
            words = data.get("words", [])
            # Use duration from response if available
            if data.get("duration"):
                audio_seconds = float(data["duration"])
            record_usage(model=WHISPER_MODEL, audio_seconds=audio_seconds)
            return {"text": text, "segments": segments, "words": words}
        else:
            record_usage(model=WHISPER_MODEL, audio_seconds=audio_seconds)
            return {"text": resp.text.strip(), "segments": [], "words": []}
