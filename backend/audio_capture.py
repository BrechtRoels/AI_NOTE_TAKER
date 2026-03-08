"""Platform-aware system audio capture.

Automatically selects the right backend:
- macOS: ScreenCaptureKit (built-in, no drivers needed)
- Windows: WASAPI loopback via sounddevice
"""

import sys
import logging

logger = logging.getLogger(__name__)

if sys.platform == "darwin":
    from audio_capture_macos import SystemAudioCapture  # noqa: F401
    logger.info("Using macOS ScreenCaptureKit for system audio capture")

elif sys.platform == "win32":
    from audio_capture_windows import SystemAudioCapture  # noqa: F401
    logger.info("Using Windows WASAPI loopback for system audio capture")

else:

    class SystemAudioCapture:
        """Stub for unsupported platforms."""

        def __init__(self):
            self._running = False

        async def start(self):
            raise RuntimeError(
                f"System audio capture is not supported on {sys.platform}. "
                "Use microphone or screen audio recording instead."
            )

        async def stop(self):
            self._running = False

        def get_audio_chunk(self) -> bytes:
            return b""

        @property
        def is_running(self) -> bool:
            return self._running
