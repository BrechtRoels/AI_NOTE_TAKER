"""Podcast generator: creates a multi-voice audio podcast from meeting transcripts.

Pipeline:
1. Collect transcripts from selected meetings
2. LLM generates a conversational podcast script with speaker turns
3. OpenAI TTS (via PwC GenAI service) synthesises each turn with different voices
4. Audio segments are concatenated into a single MP3 file
"""

import io
import logging
import httpx
from pydub import AudioSegment
from genai_client import llm_complete
from config import GENAI_BASE_URL, GENAI_API_KEY, GENAI_API_VERSION, USE_MOCK_AI
from usage import record_usage

logger = logging.getLogger(__name__)

# OpenAI TTS voices — distinct enough for a podcast feel
VOICES = ["alloy", "echo", "fable", "nova", "onyx", "shimmer"]


def _params():
    return {"api-version": GENAI_API_VERSION} if GENAI_API_VERSION else {}


async def generate_script(
    transcripts: list[dict],
    duration_minutes: int = 5,
    num_speakers: int = 2,
    model: str | None = None,
) -> list[dict]:
    """Generate a podcast script from meeting transcripts.

    Returns list of turns: [{"speaker": "Host", "text": "..."}, ...]
    """
    speaker_names = _get_speaker_names(num_speakers)
    speakers_desc = ", ".join(speaker_names)

    meeting_context = ""
    for t in transcripts:
        name = t.get("name", "Untitled Meeting")
        transcript = t.get("transcript", "")
        # Truncate very long transcripts to fit context
        if len(transcript) > 15000:
            transcript = transcript[:15000] + "\n[... truncated]"
        meeting_context += f"\n=== Meeting: {name} ===\n{transcript}\n"

    # Estimate ~150 words per minute of speech
    target_words = duration_minutes * 150

    if num_speakers == 1:
        style_instructions = f"""SPEAKER: {speaker_names[0]} (solo presenter)

STYLE: This is a solo news bulletin / briefing style podcast. {speaker_names[0]} is a confident,
professional presenter delivering a well-structured update — like a news anchor or briefing host.

REQUIREMENTS:
- Target length: approximately {target_words} words ({duration_minutes} minutes)
- Use a clear, authoritative but approachable tone
- Structure the content with smooth transitions between topics (e.g. "Moving on to...", "Now let's turn to...", "Another key point from this meeting...")
- Go IN DEPTH on what was discussed — don't just list topics, explain them thoroughly
- Cover specific details: problems raised, solutions proposed, decisions made, action items
- Quote or paraphrase interesting points from the meetings
- INTRODUCTION: Open with a professional greeting, set the scene (what meetings are being covered, the overall theme), and preview the key topics
- CLOSING: Wrap up with a concise summary of key takeaways, open questions, and next steps. Sign off cleanly.
- Keep it engaging — vary sentence length, use rhetorical questions, and add brief commentary or analysis"""
    else:
        style_instructions = f"""SPEAKERS: {speakers_desc}
- {speaker_names[0]} is the main host who guides the conversation
- Other speakers are co-hosts who add insights and ask questions

STYLE: This is a multi-host conversational podcast. It should feel like a natural, lively discussion.

REQUIREMENTS:
- Target length: approximately {target_words} words ({duration_minutes} minutes)
- Go IN DEPTH on what was discussed in each meeting — don't just list topics, explain them thoroughly
- Discuss specific details: what problems were raised, what solutions were proposed, what arguments were made, what examples were given
- Quote or paraphrase interesting points people made in the meetings
- Cover decisions, action items, and open questions in detail
- Speakers should debate, ask follow-up questions, and share their reactions to the meeting content
- Make it conversational and engaging - not a dry summary
- Include natural transitions between topics
- IMPORTANT: Do NOT have speakers take turns in a rigid round-robin pattern (e.g. A, B, C, A, B, C). Real conversations are unpredictable — the same speaker might talk twice in a row, someone might jump in with a short reaction, or two speakers might have a back-and-forth before the third chimes in. Vary the speaker order to feel natural.
- INTRODUCTION: Start with an energetic, welcoming opener. The host should greet the audience, introduce the co-hosts by name, explain the context, and preview what's coming
- CLOSING: End with a strong wrap-up. Summarize key takeaways, highlight open questions, and sign off warmly"""

    example_turn2 = f', {{"speaker": "{speaker_names[1]}", "text": "Thanks for having me..."}}' if num_speakers > 1 else ''

    prompt = f"""You are a podcast script writer. Create an engaging podcast script
based on the following meeting transcripts.

{style_instructions}

FORMAT: Return ONLY a JSON array of objects, each with "speaker" and "text" fields.
Example: [{{"speaker": "{speaker_names[0]}", "text": "Welcome to..."}}{example_turn2}]

ONLY use these speaker names: {speakers_desc}. Do NOT invent additional speakers.
Do NOT include any text outside the JSON array.

MEETING TRANSCRIPTS:
{meeting_context}

PODCAST SCRIPT (JSON only):"""

    from config import GENAI_LLM_MODEL
    model = model or GENAI_LLM_MODEL
    raw = await llm_complete(prompt, model=model)

    # Parse the script
    import json
    # Try to extract JSON from the response
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        raw = raw.rsplit("```", 1)[0]
    # Find the JSON array
    start = raw.find("[")
    end = raw.rfind("]") + 1
    if start >= 0 and end > start:
        raw = raw[start:end]

    try:
        turns = json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse podcast script JSON: {raw[:200]}")
        # Fallback: create a simple script
        turns = [{"speaker": speaker_names[0], "text": raw}]

    # Validate turns and enforce speaker count
    valid_turns = []
    for turn in turns:
        if isinstance(turn, dict) and "speaker" in turn and "text" in turn:
            # Remap unknown speakers to the closest valid one
            if turn["speaker"] not in speaker_names:
                turn["speaker"] = speaker_names[len(valid_turns) % len(speaker_names)]
            valid_turns.append(turn)

    return valid_turns if valid_turns else [{"speaker": speaker_names[0], "text": raw}]


async def synthesise_speech(text: str, voice: str = "alloy") -> bytes:
    """Convert text to speech using OpenAI TTS via PwC GenAI service."""
    if USE_MOCK_AI:
        # Return a short silent audio segment for testing
        silence = AudioSegment.silent(duration=1000)
        buf = io.BytesIO()
        silence.export(buf, format="mp3")
        return buf.getvalue()

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{GENAI_BASE_URL}/v1/audio/speech",
            params=_params(),
            headers={
                "api-key": GENAI_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "model": "openai.gpt-4o-mini-tts",
                "input": text,
                "voice": voice,
                "response_format": "mp3",
            },
        )
        if resp.status_code != 200:
            logger.error(f"TTS error response: {resp.status_code} — {resp.text}")
        resp.raise_for_status()
        record_usage(model="openai.gpt-4o-mini-tts", characters=len(text))
        return resp.content


async def generate_podcast(
    transcripts: list[dict],
    duration_minutes: int = 5,
    num_speakers: int = 2,
    model: str | None = None,
) -> tuple[bytes, list[dict]]:
    """Full pipeline: script generation + TTS + concatenation.

    Returns (mp3_bytes, script_turns).
    """
    logger.info(f"Generating podcast: {duration_minutes}min, {num_speakers} speakers, {len(transcripts)} meetings")

    # 1. Generate script
    script = await generate_script(transcripts, duration_minutes, num_speakers, model)
    logger.info(f"Script generated: {len(script)} turns")

    # 2. Assign voices to speakers
    speaker_names = _get_speaker_names(num_speakers)
    voice_map = {}
    for i, name in enumerate(speaker_names):
        voice_map[name] = VOICES[i % len(VOICES)]

    # 3. Synthesise each turn
    combined = AudioSegment.empty()
    short_pause = AudioSegment.silent(duration=400)

    for i, turn in enumerate(script):
        voice = voice_map.get(turn["speaker"], VOICES[0])
        logger.info(f"TTS turn {i + 1}/{len(script)}: {turn['speaker']} ({voice}), {len(turn['text'])} chars")
        try:
            audio_bytes = await synthesise_speech(turn["text"], voice=voice)
            segment = AudioSegment.from_mp3(io.BytesIO(audio_bytes))
            combined += segment + short_pause
        except Exception as e:
            logger.error(f"TTS failed for turn {i + 1}: {e}")
            # Add silence as placeholder
            combined += AudioSegment.silent(duration=2000) + short_pause

    # 4. Export as MP3
    buf = io.BytesIO()
    combined.export(buf, format="mp3", bitrate="128k")
    return buf.getvalue(), script


def _get_speaker_names(num_speakers: int) -> list[str]:
    names = ["Alex", "Jordan", "Sam", "Riley", "Morgan", "Casey"]
    return names[:max(1, min(num_speakers, len(names)))]
