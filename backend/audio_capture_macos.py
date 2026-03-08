"""System audio capture using macOS ScreenCaptureKit.

Captures all system audio without any third-party tools.
Requires macOS 12.3+ and screen recording permission.
"""

import asyncio
import io
import struct
import threading
import wave
import numpy as np

import objc
from Foundation import NSObject, NSRunLoop, NSDate
import ScreenCaptureKit as SCK
import CoreMedia


SAMPLE_RATE = 16000
CHANNELS = 1


class AudioCaptureDelegate(NSObject):
    """Delegate that receives audio samples from ScreenCaptureKit."""

    def init(self):
        self = objc.super(AudioCaptureDelegate, self).init()
        if self is None:
            return None
        self.audio_buffers = []
        self.lock = threading.Lock()
        return self

    def stream_didOutputSampleBuffer_ofType_(self, stream, sample_buffer, output_type):
        # output_type 1 = audio
        if output_type != 1:
            return

        try:
            block_buffer = CoreMedia.CMSampleBufferGetDataBuffer(sample_buffer)
            if block_buffer is None:
                return

            length = CoreMedia.CMBlockBufferGetDataLength(block_buffer)
            data = bytes(length)
            # Get the raw audio data
            status, data = CoreMedia.CMBlockBufferCopyDataBytes(
                block_buffer, 0, length, None
            )
            if status == 0 and data:
                with self.lock:
                    self.audio_buffers.append(bytes(data))
        except Exception:
            pass

    def get_and_clear_audio(self) -> bytes:
        with self.lock:
            if not self.audio_buffers:
                return b""
            combined = b"".join(self.audio_buffers)
            self.audio_buffers.clear()
            return combined


class SystemAudioCapture:
    """Captures system audio using ScreenCaptureKit."""

    def __init__(self):
        self._stream = None
        self._delegate = None
        self._running = False
        self._thread = None

    async def get_available_content(self):
        """Get shareable content (needed to set up the stream)."""
        loop = asyncio.get_event_loop()
        future = loop.create_future()

        def handler(content, error):
            if error:
                loop.call_soon_threadsafe(future.set_exception, Exception(str(error)))
            else:
                loop.call_soon_threadsafe(future.set_result, content)

        SCK.SCShareableContent.getShareableContentWithCompletionHandler_(handler)
        return await future

    async def start(self):
        """Start capturing system audio."""
        content = await self.get_available_content()

        # Get the first display
        displays = content.displays()
        if not displays:
            raise RuntimeError("No displays found")

        display = displays[0]

        # Create a filter that captures everything on screen (we only want audio)
        content_filter = SCK.SCContentFilter.alloc().initWithDisplay_excludingWindows_(
            display, []
        )

        # Configure stream for audio only
        config = SCK.SCStreamConfiguration.alloc().init()
        config.setCapturesAudio_(True)
        config.setExcludesCurrentProcessAudio_(True)  # Don't capture our own app
        config.setSampleRate_(SAMPLE_RATE)
        config.setChannelCount_(CHANNELS)

        # Minimize video (we don't need it but can't fully disable it)
        config.setWidth_(1)
        config.setHeight_(1)
        config.setMinimumFrameInterval_(CoreMedia.CMTimeMake(1, 1))  # 1 fps

        self._delegate = AudioCaptureDelegate.alloc().init()
        self._stream = SCK.SCStream.alloc().initWithFilter_configuration_delegate_(
            content_filter, config, self._delegate
        )

        # Add audio output
        error = None
        success = self._stream.addStreamOutput_type_sampleHandlerQueue_error_(
            self._delegate, 1, None, None  # type 1 = audio
        )

        # Start the stream
        loop = asyncio.get_event_loop()
        future = loop.create_future()

        def start_handler(error):
            if error:
                loop.call_soon_threadsafe(future.set_exception, Exception(str(error)))
            else:
                loop.call_soon_threadsafe(future.set_result, None)

        self._stream.startCaptureWithCompletionHandler_(start_handler)
        await future

        self._running = True

        # Run the runloop in a background thread so callbacks fire
        def run_loop():
            while self._running:
                NSRunLoop.currentRunLoop().runUntilDate_(
                    NSDate.dateWithTimeIntervalSinceNow_(0.1)
                )

        self._thread = threading.Thread(target=run_loop, daemon=True)
        self._thread.start()

    async def stop(self):
        """Stop capturing."""
        self._running = False

        if self._stream:
            loop = asyncio.get_event_loop()
            future = loop.create_future()

            def stop_handler(error):
                loop.call_soon_threadsafe(future.set_result, None)

            self._stream.stopCaptureWithCompletionHandler_(stop_handler)
            await future
            self._stream = None

        if self._thread:
            self._thread.join(timeout=2)
            self._thread = None

    def get_audio_chunk(self) -> bytes:
        """Get accumulated audio as WAV bytes and clear the buffer."""
        if not self._delegate:
            return b""

        raw = self._delegate.get_and_clear_audio()
        if not raw:
            return b""

        # The raw data is float32 from ScreenCaptureKit
        # Convert to the format we need
        try:
            samples = np.frombuffer(raw, dtype=np.float32)
            # Convert to int16 for WAV
            int16_data = (samples * 32767).astype(np.int16)

            # Create WAV in memory
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
