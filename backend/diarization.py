import io
import logging
import torch
import numpy as np
from pydub import AudioSegment
from pyannote.audio import Pipeline, Inference
from sklearn.metrics.pairwise import cosine_similarity as cos_sim
from config import HF_AUTH_TOKEN

logger = logging.getLogger(__name__)

_pipeline = None
_embedding_model = None


def get_pipeline() -> Pipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            token=HF_AUTH_TOKEN,
        )
        if torch.backends.mps.is_available():
            _pipeline.to(torch.device("mps"))
        elif torch.cuda.is_available():
            _pipeline.to(torch.device("cuda"))
    return _pipeline


def get_embedding_model() -> Inference:
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = Inference(
            "pyannote/wespeaker-voxceleb-resnet34-LM",
            token=HF_AUTH_TOKEN,
        )
        if torch.backends.mps.is_available():
            _embedding_model.to(torch.device("mps"))
        elif torch.cuda.is_available():
            _embedding_model.to(torch.device("cuda"))
    return _embedding_model


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


def diarize_audio(audio_bytes: bytes, sample_rate: int = 16000) -> list[dict]:
    """Run speaker diarization on audio bytes.

    Returns list of segments: [{"start": float, "end": float, "speaker": str}, ...]
    """
    pipeline = get_pipeline()

    samples, sr = decode_audio(audio_bytes, target_sr=sample_rate)
    waveform = torch.from_numpy(samples).unsqueeze(0)

    audio_input = {"waveform": waveform, "sample_rate": sr}
    result = pipeline(audio_input)

    # Newer pyannote returns DiarizeOutput dataclass; extract the Annotation
    annotation = getattr(result, "speaker_diarization", result)

    segments = []
    for turn, _, speaker in annotation.itertracks(yield_label=True):
        segments.append({
            "start": round(turn.start, 2),
            "end": round(turn.end, 2),
            "speaker": speaker,
        })

    # Compute speaker embeddings for cross-chunk tracking
    speaker_embeddings = _compute_speaker_embeddings(segments, waveform, sr)

    for seg in segments:
        seg["_embedding"] = speaker_embeddings.get(seg["speaker"])

    return segments


def _compute_speaker_embeddings(
    segments: list[dict], waveform: torch.Tensor, sample_rate: int
) -> dict[str, np.ndarray]:
    """Compute one embedding per speaker from their audio portions."""
    try:
        model = get_embedding_model()
    except Exception as e:
        logger.warning(f"Could not load embedding model: {e}")
        return {}

    speakers = set(seg["speaker"] for seg in segments)
    embeddings = {}

    for speaker in speakers:
        # Collect all audio for this speaker
        speaker_segs = [s for s in segments if s["speaker"] == speaker]
        # Use the longest segment for a more reliable embedding
        longest = max(speaker_segs, key=lambda s: s["end"] - s["start"])
        start_sample = int(longest["start"] * sample_rate)
        end_sample = int(longest["end"] * sample_rate)
        speaker_audio = waveform[:, start_sample:end_sample]

        if speaker_audio.shape[1] < sample_rate * 0.5:  # need at least 0.5s
            continue

        try:
            emb = model({"waveform": speaker_audio, "sample_rate": sample_rate})
            embeddings[speaker] = np.array(emb).flatten()
        except Exception as e:
            logger.warning(f"Embedding failed for {speaker}: {e}")

    return embeddings


class SpeakerRegistry:
    """Maps chunk-local speaker IDs to persistent session-wide speaker names."""

    def __init__(self, threshold: float = 0.55):
        self.known_speakers: dict[str, np.ndarray] = {}  # name -> embedding
        self._counter = 0
        self.threshold = threshold

    def map_speaker(self, chunk_speaker: str, embedding: np.ndarray | None) -> str:
        """Map a chunk-local speaker ID to a persistent session speaker."""
        if embedding is None:
            return chunk_speaker

        emb = embedding.reshape(1, -1)

        # Compare to all known speakers
        best_name = None
        best_score = -1.0
        for name, known_emb in self.known_speakers.items():
            score = float(cos_sim(emb, known_emb.reshape(1, -1))[0, 0])
            if score > best_score:
                best_score = score
                best_name = name

        if best_name and best_score >= self.threshold:
            # Update embedding with running average
            self.known_speakers[best_name] = (
                0.7 * self.known_speakers[best_name] + 0.3 * embedding.flatten()
            )
            return best_name

        # New speaker
        self._counter += 1
        name = f"Speaker {self._counter}"
        self.known_speakers[name] = embedding.flatten()
        return name


def rediarize_full_audio(audio_path: str, existing_segments: list[dict]) -> list[dict]:
    """Re-diarize using the full audio file and remap speaker labels.

    Runs pyannote on the complete recording for consistent speaker labels,
    then maps them onto existing transcript segments by timestamp overlap.
    """
    import copy

    with open(audio_path, "rb") as f:
        audio_bytes = f.read()

    full_diar = diarize_audio(audio_bytes)
    if not full_diar:
        logger.warning("Full-audio diarization returned no segments")
        return existing_segments

    updated = copy.deepcopy(existing_segments)

    for seg in updated:
        best_speaker = seg["speaker"]
        best_overlap = 0.0
        for dseg in full_diar:
            overlap = max(0.0, min(seg["end"], dseg["end"]) - max(seg["start"], dseg["start"]))
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = dseg["speaker"]
        seg["speaker"] = best_speaker

    # Rename to human-readable labels in order of first appearance
    label_map = {}
    counter = 0
    for seg in updated:
        if seg["speaker"] not in label_map:
            counter += 1
            label_map[seg["speaker"]] = f"Speaker {counter}"
        seg["speaker"] = label_map[seg["speaker"]]

    logger.info(f"Re-diarization mapped {len(updated)} segments to {counter} speakers")
    return updated
