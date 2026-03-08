import io
import logging
import numpy as np
from pydub import AudioSegment

logger = logging.getLogger(__name__)


def decode_audio(audio_bytes: bytes, target_sr: int = 16000) -> tuple[np.ndarray, int]:
    """Decode audio bytes (any format pydub/ffmpeg supports) to float32 numpy array."""
    audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
    audio = audio.set_channels(1).set_frame_rate(target_sr).set_sample_width(2)
    samples = np.array(audio.get_array_of_samples(), dtype=np.float32) / 32768.0
    return samples, target_sr


def get_audio_duration(audio_bytes: bytes, target_sr: int = 16000) -> float:
    """Return the duration in seconds of the given audio bytes."""
    samples, sr = decode_audio(audio_bytes, target_sr)
    return len(samples) / sr
