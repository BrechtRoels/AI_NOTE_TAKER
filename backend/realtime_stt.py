"""Realtime STT via PwC GenAI WebSocket API (gpt-realtime-mini).

Connects to the realtime WebSocket endpoint, streams PCM16 audio,
and receives live transcription events. Used as a relay between the
browser and the PwC GenAI realtime API.

Uses the "transcription" session type for transcription-only mode
(no audio output). See OpenAI Realtime Transcription docs.
"""

import asyncio
import base64
import json
import logging
from collections.abc import Awaitable, Callable

import websockets

from config import (
    GENAI_BASE_URL, GENAI_API_KEY, GENAI_API_VERSION,
    GENAI_REALTIME_MODEL, GENAI_STT_MODEL, USE_MOCK_AI,
)

logger = logging.getLogger(__name__)


class RealtimeSTTClient:
    """WebSocket client for PwC GenAI realtime transcription.

    Manages the connection to the realtime API, sends audio frames,
    and dispatches transcript events via async callbacks.
    """

    def __init__(
        self,
        on_transcript: Callable[[dict], Awaitable[None]],
        on_error: Callable[[str], Awaitable[None]],
    ):
        self.on_transcript = on_transcript
        self.on_error = on_error
        self._ws = None
        self._running = False
        self._receive_task: asyncio.Task | None = None

    async def connect(self):
        """Connect to the PwC GenAI realtime WebSocket endpoint."""
        if USE_MOCK_AI:
            self._running = True
            logger.info("Realtime STT mock mode — no actual connection")
            return

        # Build WebSocket URL from REST base URL
        base = GENAI_BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
        url = f"{base}/v1/realtime"

        params = [f"model={GENAI_REALTIME_MODEL}"]
        if GENAI_API_VERSION:
            params.append(f"api-version={GENAI_API_VERSION}")
        full_url = f"{url}?{'&'.join(params)}"

        headers = {"api-key": GENAI_API_KEY}

        logger.info(f"Connecting to realtime STT: {full_url}")

        self._ws = await websockets.connect(
            full_url,
            additional_headers=headers,
            ping_interval=20,
            ping_timeout=60,
        )
        self._running = True

        # Configure session for transcription only (no audio output)
        await self._ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "type": "transcription",
                "input_audio_format": "pcm16",
                "input_audio_transcription": {
                    "model": GENAI_STT_MODEL,
                },
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.5,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": 800,
                },
            },
        }))

        # Start background task to process incoming messages
        self._receive_task = asyncio.create_task(self._receive_loop())
        logger.info("Realtime STT connected and configured")

    async def _receive_loop(self):
        """Process incoming messages from PwC GenAI realtime API."""
        try:
            async for message in self._ws:
                if not self._running:
                    break
                try:
                    event = json.loads(message)
                    await self._handle_event(event)
                except json.JSONDecodeError:
                    logger.warning(f"Non-JSON message from realtime API: {str(message)[:200]}")
        except websockets.ConnectionClosed as e:
            logger.warning(f"Realtime WebSocket closed: {e}")
            self._running = False
            await self.on_error(f"Realtime connection closed: {e}")
        except Exception as e:
            logger.error(f"Realtime receive error: {e}")
            self._running = False
            await self.on_error(f"Realtime error: {e}")

    async def _handle_event(self, event: dict):
        """Handle a single event from the realtime API."""
        event_type = event.get("type", "")

        if event_type == "session.created":
            logger.info("Realtime session created")

        elif event_type == "session.updated":
            logger.info("Realtime session configured")

        # Transcription session events
        elif event_type == "conversation.item.input_audio_transcription.delta":
            delta = event.get("delta", "")
            if delta:
                await self.on_transcript({"type": "delta", "text": delta})

        elif event_type == "conversation.item.input_audio_transcription.completed":
            transcript = event.get("transcript", "")
            if transcript.strip():
                await self.on_transcript({
                    "type": "final",
                    "text": transcript,
                    "item_id": event.get("item_id", ""),
                })

        elif event_type == "input_audio_buffer.speech_started":
            await self.on_transcript({"type": "speech_started"})

        elif event_type == "input_audio_buffer.speech_stopped":
            await self.on_transcript({"type": "speech_stopped"})

        elif event_type == "error":
            error = event.get("error", {})
            msg = error.get("message", str(error))
            logger.error(f"Realtime API error: {msg}")
            await self.on_error(msg)

        else:
            logger.debug(f"Unhandled realtime event: {event_type}")

    async def send_audio(self, pcm_bytes: bytes):
        """Send PCM16 audio data to the realtime API."""
        if not self._ws or not self._running:
            return

        audio_b64 = base64.b64encode(pcm_bytes).decode("ascii")
        await self._ws.send(json.dumps({
            "type": "input_audio_buffer.append",
            "audio": audio_b64,
        }))

    async def close(self):
        """Close the WebSocket connection."""
        self._running = False
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None

    @property
    def is_connected(self) -> bool:
        return self._running and self._ws is not None
