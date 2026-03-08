"""System audio capture using WASAPI loopback on Windows.

Captures all system audio (Teams, Zoom, browser, etc.) using the
Windows Audio Session API (WASAPI) loopback feature via sounddevice.
Requires Windows 7+ and a WASAPI loopback device.
"""

import asyncio
import io
import logging
import threading
import wave
import numpy as np
import sounddevice as sd

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16000
CHANNELS = 1


def _find_loopback_device() -> int | None:
    """Find a WASAPI loopback device for capturing system audio."""
    devices = sd.query_devices()

    # Look for loopback or stereo mix devices
    for i, d in enumerate(devices):
        name = d["name"].lower()
        if d["max_input_channels"] > 0 and ("loopback" in name or "stereo mix" in name):
            logger.info(f"Found loopback device: [{i}] {d['name']}")
            return i

    # Fallback: look for WASAPI loopback via host API
    try:
        host_apis = sd.query_hostapis()
        wasapi_idx = None
        for idx, api in enumerate(host_apis):
            if "wasapi" in api["name"].lower():
                wasapi_idx = idx
                break

        if wasapi_idx is not None:
            for i, d in enumerate(devices):
                if (d["hostapi"] == wasapi_idx and
                        d["max_input_channels"] > 0 and
                        "loopback" in d["name"].lower()):
                    logger.info(f"Found WASAPI loopback device: [{i}] {d['name']}")
                    return i
    except Exception:
        pass

    return None


class SystemAudioCapture:
    """Captures system audio using WASAPI loopback on Windows."""

    def __init__(self):
        self._running = False
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()
        self._audio_buffers: list[np.ndarray] = []
        self._device_id: int | None = None

    def _audio_callback(self, indata, frames, time, status):
        """Called by sounddevice for each audio block."""
        if status:
            logger.debug(f"Audio callback status: {status}")
        with self._lock:
            self._audio_buffers.append(indata.copy())

    async def start(self):
        """Start capturing system audio via WASAPI loopback."""
        self._device_id = _find_loopback_device()
        if self._device_id is None:
            raise RuntimeError(
                "No WASAPI loopback device found. "
                "Enable 'Stereo Mix' in Windows Sound settings "
                "(Control Panel > Sound > Recording > right-click > Show Disabled Devices), "
                "or install a virtual audio cable driver."
            )

        self._running = True

        def _record():
            try:
                with sd.InputStream(
                    device=self._device_id,
                    samplerate=SAMPLE_RATE,
                    channels=CHANNELS,
                    dtype="float32",
                    blocksize=SAMPLE_RATE,  # 1-second blocks
                    callback=self._audio_callback,
                ):
                    while self._running:
                        sd.sleep(100)
            except Exception as e:
                logger.error(f"WASAPI loopback recording error: {e}")
                self._running = False

        self._thread = threading.Thread(target=_record, daemon=True)
        self._thread.start()
        logger.info("Windows system audio capture started (WASAPI loopback)")

    async def stop(self):
        """Stop capturing."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)
            self._thread = None
        logger.info("Windows system audio capture stopped")

    def get_audio_chunk(self) -> bytes:
        """Get accumulated audio as WAV bytes and clear the buffer."""
        with self._lock:
            if not self._audio_buffers:
                return b""
            combined = np.concatenate(self._audio_buffers)
            self._audio_buffers.clear()

        try:
            int16_data = (combined.flatten() * 32767).astype(np.int16)
            buf = io.BytesIO()
            with wave.open(buf, "wb") as wf:
                wf.setnchannels(CHANNELS)
                wf.setsampwidth(2)
                wf.setframerate(SAMPLE_RATE)
                wf.writeframes(int16_data.tobytes())
            return buf.getvalue()
        except Exception:
            return b""

    @property
    def is_running(self) -> bool:
        return self._running
