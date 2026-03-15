"""Speaker diarization using MFCC features + agglomerative clustering.

No HuggingFace or heavy ML models needed — uses only scipy, numpy, and
scikit-learn to extract voice characteristics and cluster speakers.

Speaker profiles are stored as average MFCC vectors and can be matched
across meetings for automatic speaker identification.
"""

import io
import json
import logging
import os
from pathlib import Path

import numpy as np
from pydub import AudioSegment
from scipy.fftpack import dct
from scipy.signal import get_window
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"
SPEAKER_PROFILES_PATH = DATA_DIR / "speaker_profiles.json"

# ── Audio utilities ──────────────────────────────────────────────────


def decode_audio(audio_bytes: bytes, target_sr: int = 16000) -> tuple[np.ndarray, int]:
    """Decode audio bytes to float32 numpy array.

    Tries pydub (needs ffmpeg) first, falls back to scipy for WAV files.
    """
    # Try scipy.io.wavfile first for WAV files (no ffmpeg needed)
    if audio_bytes[:4] == b"RIFF":
        try:
            import scipy.io.wavfile as wavfile
            sr, data = wavfile.read(io.BytesIO(audio_bytes))
            if data.ndim > 1:
                data = data.mean(axis=1)
            samples = data.astype(np.float32)
            if data.dtype == np.int16:
                samples /= 32768.0
            elif data.dtype == np.int32:
                samples /= 2147483648.0
            # Simple resampling if needed
            if sr != target_sr:
                ratio = target_sr / sr
                new_len = int(len(samples) * ratio)
                indices = np.linspace(0, len(samples) - 1, new_len)
                samples = np.interp(indices, np.arange(len(samples)), samples)
            return samples, target_sr
        except Exception:
            pass

    # Fallback: pydub (requires ffmpeg)
    audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
    audio = audio.set_channels(1).set_frame_rate(target_sr).set_sample_width(2)
    samples = np.array(audio.get_array_of_samples(), dtype=np.float32) / 32768.0
    return samples, target_sr


def get_audio_duration(audio_bytes: bytes, target_sr: int = 16000) -> float:
    """Return the duration in seconds of the given audio bytes."""
    samples, sr = decode_audio(audio_bytes, target_sr)
    return len(samples) / sr


# ── MFCC extraction (pure scipy/numpy — no librosa) ─────────────────


def _mel_filterbank(num_filters: int, fft_size: int, sr: int) -> np.ndarray:
    """Create a Mel-spaced filterbank matrix."""
    low_freq_mel = 0.0
    high_freq_mel = 2595.0 * np.log10(1.0 + (sr / 2.0) / 700.0)
    mel_points = np.linspace(low_freq_mel, high_freq_mel, num_filters + 2)
    hz_points = 700.0 * (10.0 ** (mel_points / 2595.0) - 1.0)
    bins = np.floor((fft_size + 1) * hz_points / sr).astype(int)

    filterbank = np.zeros((num_filters, fft_size // 2 + 1))
    for i in range(num_filters):
        for j in range(bins[i], bins[i + 1]):
            filterbank[i, j] = (j - bins[i]) / max(1, bins[i + 1] - bins[i])
        for j in range(bins[i + 1], bins[i + 2]):
            filterbank[i, j] = (bins[i + 2] - j) / max(1, bins[i + 2] - bins[i + 1])

    return filterbank


def extract_mfcc(
    samples: np.ndarray,
    sr: int = 16000,
    n_mfcc: int = 13,
    n_fft: int = 512,
    hop_length: int = 160,
    n_mels: int = 40,
) -> np.ndarray:
    """Extract MFCC features from audio samples.

    Returns shape (n_frames, n_mfcc).
    """
    # Pre-emphasis
    emphasized = np.append(samples[0], samples[1:] - 0.97 * samples[:-1])

    # Framing
    frame_length = n_fft
    num_frames = 1 + (len(emphasized) - frame_length) // hop_length
    if num_frames < 1:
        return np.zeros((1, n_mfcc))

    indices = np.arange(frame_length)[None, :] + hop_length * np.arange(num_frames)[:, None]
    frames = emphasized[indices]

    # Windowing
    window = get_window("hamming", frame_length)
    frames *= window

    # FFT
    mag = np.abs(np.fft.rfft(frames, n=n_fft))

    # Mel filterbank
    mel_fb = _mel_filterbank(n_mels, n_fft, sr)
    mel_energy = np.dot(mag, mel_fb.T)
    mel_energy = np.where(mel_energy == 0, np.finfo(float).eps, mel_energy)
    log_mel = np.log(mel_energy)

    # DCT → MFCCs
    mfccs = dct(log_mel, type=2, axis=1, norm="ortho")[:, :n_mfcc]

    return mfccs


def _segment_embedding(samples: np.ndarray, sr: int = 16000) -> np.ndarray | None:
    """Compute a speaker embedding (mean + std of MFCCs) for an audio segment.

    Returns a 26-dimensional vector (13 means + 13 stds), or None if
    the segment is too short.
    """
    min_samples = sr * 0.3  # need at least 300ms
    if len(samples) < min_samples:
        return None

    mfccs = extract_mfcc(samples, sr=sr)
    if len(mfccs) < 3:
        return None

    # Mean + std gives a compact voice signature
    mean = np.mean(mfccs, axis=0)
    std = np.std(mfccs, axis=0)
    return np.concatenate([mean, std])


# ── VAD (simple energy-based) ────────────────────────────────────────


def _simple_vad(
    samples: np.ndarray,
    sr: int = 16000,
    frame_ms: int = 30,
    energy_threshold: float = 0.01,
    min_speech_ms: int = 300,
) -> list[tuple[float, float]]:
    """Simple energy-based voice activity detection.

    Returns list of (start_sec, end_sec) speech regions.
    """
    frame_size = int(sr * frame_ms / 1000)
    num_frames = len(samples) // frame_size

    is_speech = []
    for i in range(num_frames):
        frame = samples[i * frame_size : (i + 1) * frame_size]
        energy = np.sqrt(np.mean(frame ** 2))
        is_speech.append(energy > energy_threshold)

    # Merge adjacent speech frames into regions
    regions = []
    in_speech = False
    start = 0
    for i, speech in enumerate(is_speech):
        if speech and not in_speech:
            start = i
            in_speech = True
        elif not speech and in_speech:
            end = i
            start_sec = start * frame_ms / 1000.0
            end_sec = end * frame_ms / 1000.0
            if (end_sec - start_sec) >= min_speech_ms / 1000.0:
                regions.append((start_sec, end_sec))
            in_speech = False
    if in_speech:
        end_sec = num_frames * frame_ms / 1000.0
        start_sec = start * frame_ms / 1000.0
        if (end_sec - start_sec) >= min_speech_ms / 1000.0:
            regions.append((start_sec, end_sec))

    return regions


# ── Speaker diarization ─────────────────────────────────────────────


def diarize_audio(
    audio_bytes: bytes,
    num_speakers: int | None = None,
    max_speakers: int = 8,
    sr: int = 16000,
) -> list[dict]:
    """Run speaker diarization on audio bytes.

    Uses MFCC-based embeddings with agglomerative clustering.

    Args:
        audio_bytes: Raw audio bytes (any format pydub supports).
        num_speakers: Expected number of speakers. If None, auto-detected.
        max_speakers: Maximum number of speakers to detect (when auto).
        sr: Target sample rate.

    Returns:
        List of {"start": float, "end": float, "speaker": str} dicts,
        sorted by start time. Speaker labels are "Speaker 1", "Speaker 2", etc.
    """
    samples, sr = decode_audio(audio_bytes, target_sr=sr)
    duration = len(samples) / sr

    if duration < 1.0:
        return [{"start": 0.0, "end": duration, "speaker": "Speaker 1"}]

    # Step 1: Detect speech regions via VAD
    speech_regions = _simple_vad(samples, sr=sr)
    if not speech_regions:
        return [{"start": 0.0, "end": duration, "speaker": "Speaker 1"}]

    # Step 2: Split speech regions into ~1.5s windows for embedding
    window_sec = 1.5
    windows = []
    for start, end in speech_regions:
        t = start
        while t < end:
            w_end = min(t + window_sec, end)
            if w_end - t >= 0.3:  # min 300ms
                windows.append((t, w_end))
            t += window_sec

    if not windows:
        return [{"start": 0.0, "end": duration, "speaker": "Speaker 1"}]

    # Step 3: Extract embeddings for each window
    embeddings = []
    valid_windows = []
    for start, end in windows:
        start_sample = int(start * sr)
        end_sample = int(end * sr)
        segment_samples = samples[start_sample:end_sample]

        emb = _segment_embedding(segment_samples, sr=sr)
        if emb is not None:
            embeddings.append(emb)
            valid_windows.append((start, end))

    if len(embeddings) < 2:
        return [{"start": r[0], "end": r[1], "speaker": "Speaker 1"} for r in speech_regions]

    embeddings_matrix = np.array(embeddings)

    # Step 4: Cluster embeddings
    if num_speakers is not None:
        n_clusters = min(num_speakers, len(embeddings))
    else:
        # Auto-detect: use silhouette score to find optimal k
        n_clusters = _auto_detect_speakers(embeddings_matrix, max_speakers)

    clustering = AgglomerativeClustering(
        n_clusters=n_clusters,
        metric="cosine",
        linkage="average",
    )
    labels = clustering.fit_predict(embeddings_matrix)

    # Step 5: Build diarization timeline
    raw_segments = []
    for (start, end), label in zip(valid_windows, labels):
        raw_segments.append({
            "start": round(start, 2),
            "end": round(end, 2),
            "speaker": f"Speaker {label + 1}",
        })

    # Merge consecutive segments with same speaker
    merged = _merge_speaker_segments(raw_segments)

    return merged


def _auto_detect_speakers(embeddings: np.ndarray, max_k: int = 8) -> int:
    """Auto-detect number of speakers using silhouette score."""
    from sklearn.metrics import silhouette_score

    n = len(embeddings)
    max_k = min(max_k, n)
    if max_k < 2:
        return 1

    best_k = 2
    best_score = -1.0

    for k in range(2, max_k + 1):
        try:
            clustering = AgglomerativeClustering(
                n_clusters=k,
                metric="cosine",
                linkage="average",
            )
            labels = clustering.fit_predict(embeddings)
            # Need at least 2 labels and more samples than labels
            if len(set(labels)) < 2:
                continue
            score = silhouette_score(embeddings, labels, metric="cosine")
            if score > best_score:
                best_score = score
                best_k = k
        except Exception:
            continue

    logger.info(f"Auto-detected {best_k} speakers (silhouette={best_score:.3f})")
    return best_k


def _merge_speaker_segments(segments: list[dict], gap_threshold: float = 0.5) -> list[dict]:
    """Merge consecutive segments with the same speaker."""
    if not segments:
        return []

    merged = [segments[0].copy()]
    for seg in segments[1:]:
        prev = merged[-1]
        if seg["speaker"] == prev["speaker"] and (seg["start"] - prev["end"]) < gap_threshold:
            prev["end"] = seg["end"]
        else:
            merged.append(seg.copy())

    return merged


# ── Speaker profiles (persistent) ───────────────────────────────────


def _load_profiles() -> dict:
    """Load speaker profiles from disk."""
    if SPEAKER_PROFILES_PATH.exists():
        with open(SPEAKER_PROFILES_PATH) as f:
            return json.load(f)
    return {}


def _save_profiles(profiles: dict):
    """Save speaker profiles to disk."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(SPEAKER_PROFILES_PATH, "w") as f:
        json.dump(profiles, f, indent=2)


def save_speaker_profile(name: str, embedding: list[float]):
    """Save or update a speaker's voice profile.

    Each profile stores a list of embeddings (up to 10) which get
    averaged for matching.
    """
    profiles = _load_profiles()
    if name not in profiles:
        profiles[name] = {"embeddings": []}

    profiles[name]["embeddings"].append(embedding)
    # Keep last 10 embeddings per speaker
    profiles[name]["embeddings"] = profiles[name]["embeddings"][-10:]

    _save_profiles(profiles)
    logger.info(f"Saved speaker profile for '{name}' ({len(profiles[name]['embeddings'])} samples)")


def match_speakers_to_profiles(
    speaker_embeddings: dict[str, np.ndarray],
    threshold: float = 0.75,
) -> dict[str, str]:
    """Match cluster speaker labels to known profiles.

    Args:
        speaker_embeddings: {"Speaker 1": avg_embedding, "Speaker 2": ...}
        threshold: Minimum cosine similarity to consider a match.

    Returns:
        Mapping from cluster label to profile name, e.g.
        {"Speaker 1": "Jan De Smedt", "Speaker 2": "Speaker 2"}
    """
    profiles = _load_profiles()
    if not profiles:
        return {}

    mapping = {}
    used_profiles = set()

    # Build profile average embeddings
    profile_avgs = {}
    for name, data in profiles.items():
        embs = [np.array(e) for e in data["embeddings"]]
        if embs:
            profile_avgs[name] = np.mean(embs, axis=0)

    if not profile_avgs:
        return {}

    # Match each speaker to best profile
    for speaker_label, speaker_emb in speaker_embeddings.items():
        best_name = None
        best_score = -1.0

        for name, profile_emb in profile_avgs.items():
            if name in used_profiles:
                continue
            score = cosine_similarity(
                speaker_emb.reshape(1, -1),
                profile_emb.reshape(1, -1),
            )[0][0]
            if score > best_score:
                best_score = score
                best_name = name

        if best_name and best_score >= threshold:
            mapping[speaker_label] = best_name
            used_profiles.add(best_name)
            logger.info(f"Matched {speaker_label} → {best_name} (similarity={best_score:.3f})")
        else:
            logger.info(f"No profile match for {speaker_label} (best={best_score:.3f})")

    return mapping


def get_speaker_embeddings_from_diarization(
    audio_bytes: bytes,
    diarization: list[dict],
    sr: int = 16000,
) -> dict[str, np.ndarray]:
    """Extract average embeddings per speaker from diarization results.

    Returns {"Speaker 1": np.array([...]), "Speaker 2": ...}
    """
    samples, sr = decode_audio(audio_bytes, target_sr=sr)

    speaker_embs: dict[str, list[np.ndarray]] = {}
    for seg in diarization:
        speaker = seg["speaker"]
        start_sample = int(seg["start"] * sr)
        end_sample = int(seg["end"] * sr)
        seg_samples = samples[start_sample:end_sample]

        emb = _segment_embedding(seg_samples, sr=sr)
        if emb is not None:
            speaker_embs.setdefault(speaker, []).append(emb)

    # Average embeddings per speaker
    result = {}
    for speaker, embs in speaker_embs.items():
        result[speaker] = np.mean(embs, axis=0)

    return result


def list_speaker_profiles() -> list[dict]:
    """List all saved speaker profiles."""
    profiles = _load_profiles()
    return [
        {"name": name, "num_samples": len(data["embeddings"])}
        for name, data in profiles.items()
    ]


def delete_speaker_profile(name: str) -> bool:
    """Delete a speaker profile."""
    profiles = _load_profiles()
    if name in profiles:
        del profiles[name]
        _save_profiles(profiles)
        return True
    return False
