"""AI Note Taker — FastAPI Backend.

All functionality exposed as clean REST endpoints so any client
(browser, Windows app, mobile) can integrate easily.

Endpoints:
    GET  /api/meetings                  — List all past meetings
    GET  /api/meetings/{id}             — Get a past meeting's full data
    DELETE /api/meetings/{id}           — Delete a meeting
    POST /api/sessions                  — Start a new recording session
    POST /api/sessions/{id}/audio       — Upload an audio chunk
    GET  /api/sessions/{id}/transcript  — Get current transcript
    POST /api/sessions/{id}/ask         — Ask a question about the meeting
    POST /api/sessions/{id}/finish      — End session & generate summary
    GET  /api/sessions/{id}/summary     — Get the generated summary
    POST /api/meetings/{id}/regenerate  — Regenerate summary for a past meeting
"""

import uuid
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from transcript import TranscriptStore
from diarization import get_audio_duration
from stt import transcribe_audio
from storage import save_meeting, load_meeting, list_meetings, delete_meeting, load_all_meetings, rename_meeting, update_meeting_tags, save_audio, get_audio_path
from config import AVAILABLE_MODELS, get_active_models, set_model
from audio_capture import SystemAudioCapture
from mom_generator import generate_mom


# ── In-memory session store ──────────────────────────────────────────

sessions: dict[str, dict] = {}
_audio_capture: SystemAudioCapture | None = None

SESSION_MAX_AGE_HOURS = 12  # clean up sessions older than this


def get_session(session_id: str) -> dict:
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return sessions[session_id]


async def _cleanup_stale_sessions():
    """Periodically remove sessions that are too old or stuck in processing."""
    while True:
        await asyncio.sleep(600)  # check every 10 minutes
        now = datetime.now(timezone.utc)
        to_remove = []
        for sid, sess in sessions.items():
            created = datetime.fromisoformat(sess["created_at"])
            age_hours = (now - created).total_seconds() / 3600

            # Remove finished sessions older than max age
            if sess["status"] == "finished" and age_hours > SESSION_MAX_AGE_HOURS:
                to_remove.append(sid)
            # Recover sessions stuck in "processing" for more than 10 minutes
            elif sess["status"] == "processing" and age_hours > 0.167:
                logger.warning(f"Session {sid} stuck in processing, marking as finished")
                sess["status"] = "finished"
                if not sess.get("summary"):
                    sess["summary"] = {"summary": "Session recovered after processing timeout.", "action_items": [], "decisions": []}
            # Remove abandoned recording sessions older than max age
            elif sess["status"] == "recording" and age_hours > SESSION_MAX_AGE_HOURS:
                to_remove.append(sid)

        for sid in to_remove:
            logger.info(f"Cleaning up stale session {sid}")
            del sessions[sid]

        if to_remove:
            logger.info(f"Cleaned up {len(to_remove)} stale sessions, {len(sessions)} remaining")


# ── App ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_cleanup_stale_sessions())
    yield
    task.cancel()

app = FastAPI(title="AI Note Taker", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ───────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    name: str = "Untitled Meeting"
    record_screen: bool = True
    record_mic: bool = True
    tags: list[str] = []

class SessionResponse(BaseModel):
    session_id: str
    status: str
    name: str

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class AskRequest(BaseModel):
    question: str
    history: list[ChatMessage] = []

class AskResponse(BaseModel):
    answer: str
    relevant_segments: list[dict]


def _add_stt_to_store(
    store: TranscriptStore,
    stt_result: dict,
    batch_offset: float,
    speaker: str = "Speaker",
):
    """Add STT output to the transcript store."""
    text = stt_result.get("text", "")
    stt_segments = stt_result.get("segments", [])
    stt_words = stt_result.get("words", [])

    if not text.strip():
        return

    # Best: word-level timestamps
    if stt_words:
        groups: list[dict] = []
        for w in stt_words:
            if groups:
                groups[-1]["words"].append(w["word"])
                groups[-1]["end"] = w["end"]
            else:
                groups.append({"words": [w["word"]], "start": w["start"], "end": w["end"]})

        for g in groups:
            seg_text = " ".join(g["words"])
            if seg_text.strip():
                store.add_segment(start=batch_offset + g["start"], end=batch_offset + g["end"], speaker=speaker, text=seg_text)

    # Good: segment-level timestamps
    elif stt_segments:
        for s in stt_segments:
            seg_text = s.get("text", "").strip()
            if seg_text:
                store.add_segment(start=batch_offset + s["start"], end=batch_offset + s["end"], speaker=speaker, text=seg_text)

    # Fallback: no timestamps
    else:
        store.add_segment(start=batch_offset, end=batch_offset + 10.0, speaker=speaker, text=text)


# ── Global Q&A across all meetings ───────────────────────────────────

async def _retrieve_relevant_segments(question: str) -> list[dict]:
    """Retrieve relevant segments across all meetings using embeddings + optional rerank."""
    import numpy as np
    from sklearn.metrics.pairwise import cosine_similarity
    from genai_client import get_embeddings
    from config import USE_RERANK

    all_meetings = load_all_meetings()
    if not all_meetings:
        return []

    all_segments = []
    for meeting in all_meetings:
        for seg in meeting.get("segments", []):
            all_segments.append({
                **seg,
                "meeting_name": meeting.get("name", "Untitled"),
                "meeting_id": meeting.get("id"),
            })

    if not all_segments:
        return []

    texts = [s["text"] for s in all_segments]
    max_segments = 500
    if len(texts) > max_segments:
        all_segments = all_segments[-max_segments:]
        texts = texts[-max_segments:]

    query_emb, seg_embs = await asyncio.gather(
        get_embeddings([question]),
        get_embeddings(texts),
    )

    query_vec = np.array(query_emb[0]).reshape(1, -1)
    seg_vecs = np.array(seg_embs)
    sims = cosine_similarity(query_vec, seg_vecs)[0]

    # Get top candidates — more if reranking, since rerank will refine
    top_k = 20 if USE_RERANK else 8
    top_indices = np.argsort(sims)[-top_k:][::-1]
    candidates = [all_segments[i] for i in top_indices if sims[i] > 0]

    if USE_RERANK and candidates:
        from genai_client import rerank
        try:
            docs = [s["text"] for s in candidates]
            ranked = await rerank(question, docs, top_n=8)
            candidates = [candidates[r["index"]] for r in ranked]
        except Exception as e:
            logger.warning(f"Rerank failed, using embedding results: {e}")
            candidates = candidates[:8]
    else:
        candidates = candidates[:8]

    return candidates


@app.post("/api/ask-global")
async def ask_global(req: AskRequest):
    """Ask a question across all saved meetings."""
    from genai_client import llm_complete
    from config import GENAI_CHAT_MODEL

    relevant = await _retrieve_relevant_segments(req.question)
    if not relevant:
        return {"answer": "No meetings or transcript data found.", "sources": []}

    context = "\n".join(
        f"[Meeting: {s['meeting_name']}] [{s.get('start', 0):.0f}s] {s.get('speaker', '?')}: {s['text']}"
        for s in relevant
    )

    history_block = ""
    if req.history:
        history_block = "\nCONVERSATION HISTORY:\n" + "\n".join(
            f"{'User' if m.role == 'user' else 'Assistant'}: {m.content}" for m in req.history
        ) + "\n"

    prompt = f"""You are a meeting assistant with access to multiple past meetings.
Based on the following transcript excerpts from various meetings, answer the question.
Use the conversation history for context if the user refers to previous questions or answers.

FORMATTING GUIDELINES:
- Structure your answer with clear sections if multiple topics are covered
- Use bullet points for lists of items, decisions, or action items
- Reference the meeting name when citing information (e.g. "In the [Meeting Name] meeting, ...")
- Keep answers concise but complete
- If the answer is not in the transcripts, say so clearly
{history_block}
TRANSCRIPT CONTEXT:
{context}

QUESTION: {req.question}

ANSWER:"""

    answer = await llm_complete(prompt, model=GENAI_CHAT_MODEL)
    seen = {}
    for s in relevant:
        mid = s.get("meeting_id")
        if mid and mid not in seen:
            seen[mid] = s["meeting_name"]
    # Only include sources the answer actually references
    answer_lower = answer.lower()
    sources = [{"id": mid, "name": name} for mid, name in seen.items()
               if name.lower() in answer_lower]

    return {"answer": answer, "sources": sources}


@app.post("/api/ask-global/stream")
async def ask_global_stream(req: AskRequest):
    """Ask a question across all meetings with streaming response (SSE)."""
    import json as _json
    from genai_client import llm_stream, llm_complete
    from config import GENAI_CHAT_MODEL

    relevant = await _retrieve_relevant_segments(req.question)
    if not relevant:
        async def _empty():
            yield f"data: {_json.dumps({'type': 'sources', 'sources': []})}\n\n"
            yield f"data: {_json.dumps({'type': 'token', 'token': 'No meetings or transcript data found.'})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(_empty(), media_type="text/event-stream")

    context = "\n".join(
        f"[Meeting: {s['meeting_name']}] [{s.get('start', 0):.0f}s] {s.get('speaker', '?')}: {s['text']}"
        for s in relevant
    )

    history_block = ""
    if req.history:
        history_block = "\nCONVERSATION HISTORY:\n" + "\n".join(
            f"{'User' if m.role == 'user' else 'Assistant'}: {m.content}" for m in req.history
        ) + "\n"

    prompt = f"""You are a meeting assistant with access to multiple past meetings.
Based on the following transcript excerpts from various meetings, answer the question.
Use the conversation history for context if the user refers to previous questions or answers.

FORMATTING GUIDELINES:
- Structure your answer with clear sections if multiple topics are covered
- Use bullet points for lists of items, decisions, or action items
- Reference the meeting name when citing information (e.g. "In the [Meeting Name] meeting, ...")
- Keep answers concise but complete
- If the answer is not in the transcripts, say so clearly
{history_block}
TRANSCRIPT CONTEXT:
{context}

QUESTION: {req.question}

ANSWER:"""

    # Build unique sources with meeting IDs
    seen = {}
    for s in relevant:
        mid = s.get("meeting_id")
        if mid and mid not in seen:
            seen[mid] = s["meeting_name"]

    async def _stream():
        full_answer = ""
        try:
            async for token in llm_stream(prompt, model=GENAI_CHAT_MODEL):
                full_answer += token
                yield f"data: {_json.dumps({'type': 'token', 'token': token})}\n\n"
        except Exception as e:
            logger.warning(f"Streaming failed ({e}), falling back to non-streaming")
            full_answer = await llm_complete(prompt, model=GENAI_CHAT_MODEL)
            yield f"data: {_json.dumps({'type': 'token', 'token': full_answer})}\n\n"
        # Only include sources the answer actually references
        answer_lower = full_answer.lower()
        sources = [{"id": mid, "name": name} for mid, name in seen.items()
                   if name.lower() in answer_lower]
        yield f"data: {_json.dumps({'type': 'sources', 'sources': sources})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(_stream(), media_type="text/event-stream")


# ── Conversation endpoints ───────────────────────────────────────────

class SaveConversationRequest(BaseModel):
    id: str | None = None
    title: str
    messages: list[dict]

@app.get("/api/conversations")
async def get_conversations():
    from storage import list_conversations
    return list_conversations()

@app.post("/api/conversations")
async def save_conversation_endpoint(req: SaveConversationRequest):
    import uuid as _uuid
    from storage import save_conversation
    conv_id = req.id or str(_uuid.uuid4())[:8]
    data = {
        "id": conv_id,
        "title": req.title,
        "messages": req.messages,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    save_conversation(conv_id, data)
    return {"id": conv_id}

@app.get("/api/conversations/{conv_id}")
async def get_conversation(conv_id: str):
    from storage import load_conversation
    data = load_conversation(conv_id)
    if not data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return data

@app.delete("/api/conversations/{conv_id}")
async def delete_conversation_endpoint(conv_id: str):
    from storage import delete_conversation
    if not delete_conversation(conv_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "deleted"}


# ── Meeting history endpoints ────────────────────────────────────────

@app.get("/api/meetings")
async def get_meetings():
    """List all past meetings."""
    return {"meetings": list_meetings()}


@app.get("/api/meetings/{meeting_id}")
async def get_meeting(meeting_id: str):
    """Get a past meeting's full data (transcript, summary, etc.)."""
    data = load_meeting(meeting_id)
    if not data:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return data


@app.delete("/api/meetings/{meeting_id}")
async def remove_meeting(meeting_id: str):
    """Delete a meeting."""
    if not delete_meeting(meeting_id):
        raise HTTPException(status_code=404, detail="Meeting not found")
    return {"status": "deleted"}


@app.post("/api/meetings/upload")
async def upload_transcript(file: UploadFile = File(...), name: str | None = None):
    """Upload a PDF or Word transcript and create a meeting from it."""
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("pdf", "docx", "doc"):
        raise HTTPException(status_code=400, detail="Only PDF and Word (.docx) files are supported")

    content = await file.read()
    text = ""

    if ext == "pdf":
        import fitz
        doc = fitz.open(stream=content, filetype="pdf")
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
    elif ext in ("docx", "doc"):
        import io
        from docx import Document
        doc = Document(io.BytesIO(content))
        text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from file")

    # Parse into segments — try to detect speaker lines, else split by paragraphs
    segments = _parse_transcript_text(text)

    meeting_name = name or filename.rsplit(".", 1)[0] or "Uploaded Transcript"
    meeting_id = str(uuid.uuid4())[:8]

    # Generate summary
    store = TranscriptStore()
    for seg in segments:
        store.add_segment(seg["start"], seg["end"], seg["speaker"], seg["text"])

    summary = await store.generate_summary()

    save_meeting(meeting_id, {
        "id": meeting_id,
        "name": meeting_name,
        "status": "finished",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "segments": segments,
        "transcript": store.get_full_transcript(),
        "total_segments": len(segments),
        "summary": summary,
        "qa_history": [],
        "tags": [],
        "source": "upload",
    })

    # Index embeddings for cross-meeting search
    texts = [s["text"] for s in segments if s["text"].strip()]
    if texts:
        try:
            from genai_client import get_embeddings
            store.embeddings = await get_embeddings(texts)
        except Exception as e:
            logger.warning(f"Embedding generation failed for upload: {e}")

    return {"meeting_id": meeting_id, "name": meeting_name, "total_segments": len(segments)}


def _parse_transcript_text(text: str) -> list[dict]:
    """Parse raw transcript text into segments.

    Tries to detect speaker-labelled lines like 'Speaker 1: ...' or 'John: ...',
    otherwise splits into paragraph-based segments.
    """
    import re
    lines = text.split("\n")

    # Detect speaker pattern: "Name:" or "Speaker 1:" at start of line
    speaker_pattern = re.compile(r'^([A-Z][A-Za-z0-9 .\-\']{0,30}):\s*(.+)', re.MULTILINE)
    speaker_segments = []
    current_time = 0.0

    for line in lines:
        line = line.strip()
        if not line:
            continue
        m = speaker_pattern.match(line)
        if m:
            speaker = m.group(1).strip()
            content = m.group(2).strip()
        else:
            speaker = "Speaker"
            content = line

        if not content:
            continue

        duration = max(2.0, len(content.split()) * 0.4)
        speaker_segments.append({
            "start": round(current_time, 2),
            "end": round(current_time + duration, 2),
            "speaker": speaker,
            "text": content,
            "batch_idx": 0,
        })
        current_time += duration

    return speaker_segments if speaker_segments else [{
        "start": 0.0,
        "end": 1.0,
        "speaker": "Speaker",
        "text": text[:5000],
        "batch_idx": 0,
    }]


@app.get("/api/meetings/{meeting_id}/mom")
async def download_mom(meeting_id: str):
    """Generate and download PM2 Minutes of Meeting DOCX."""
    meeting = load_meeting(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    try:
        path = generate_mom(meeting)
    except Exception as e:
        logger.error(f"MoM generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate MoM: {e}")
    filename = path.split("/")[-1]
    return FileResponse(path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


@app.get("/api/meetings/{meeting_id}/summary-pdf")
async def download_summary_pdf(meeting_id: str):
    """Generate and download a professional PwC-branded meeting summary PDF."""
    from pdf_summary import generate_summary_pdf

    meeting = load_meeting(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    try:
        path = generate_summary_pdf(meeting)
    except Exception as e:
        logger.error(f"PDF summary generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {e}")
    filename = path.split("/")[-1]
    return FileResponse(path, filename=filename, media_type="application/pdf")


class PodcastRequest(BaseModel):
    meeting_ids: list[str]
    duration_minutes: int = 5
    num_speakers: int = 2


@app.post("/api/podcast/generate")
async def generate_podcast_endpoint(req: PodcastRequest):
    """Generate a podcast from selected meetings."""
    from podcast import generate_podcast

    if not req.meeting_ids:
        raise HTTPException(status_code=400, detail="Select at least one meeting")
    if req.num_speakers < 1 or req.num_speakers > 6:
        raise HTTPException(status_code=400, detail="Number of speakers must be 1-6")
    if req.duration_minutes < 1 or req.duration_minutes > 30:
        raise HTTPException(status_code=400, detail="Duration must be 1-30 minutes")

    transcripts = []
    for mid in req.meeting_ids:
        meeting = load_meeting(mid)
        if not meeting:
            raise HTTPException(status_code=404, detail=f"Meeting {mid} not found")
        transcripts.append({
            "name": meeting.get("name", "Untitled"),
            "transcript": meeting.get("transcript", ""),
        })

    try:
        mp3_bytes, script = await generate_podcast(
            transcripts,
            duration_minutes=req.duration_minutes,
            num_speakers=req.num_speakers,
        )
    except Exception as e:
        logger.error(f"Podcast generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Podcast generation failed: {e}")

    # Save podcast file
    import os
    podcast_dir = os.path.join(os.path.dirname(__file__), "data", "podcasts")
    os.makedirs(podcast_dir, exist_ok=True)
    podcast_id = str(uuid.uuid4())[:8]
    podcast_path = os.path.join(podcast_dir, f"{podcast_id}.mp3")
    with open(podcast_path, "wb") as f:
        f.write(mp3_bytes)

    return {
        "podcast_id": podcast_id,
        "script": script,
        "duration_minutes": req.duration_minutes,
        "meetings": [t["name"] for t in transcripts],
    }


@app.get("/api/podcast/{podcast_id}")
async def get_podcast(podcast_id: str):
    """Stream a generated podcast MP3."""
    import os
    path = os.path.join(os.path.dirname(__file__), "data", "podcasts", f"{podcast_id}.mp3")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Podcast not found")
    return FileResponse(path, media_type="audio/mpeg", filename=f"podcast-{podcast_id}.mp3")


@app.get("/api/meetings/{meeting_id}/audio")
async def get_meeting_audio(meeting_id: str):
    """Stream the meeting's audio file."""
    path = get_audio_path(meeting_id)
    if not path:
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(path, media_type="audio/webm")


class PatchMeetingRequest(BaseModel):
    name: str | None = None
    tags: list[str] | None = None


@app.patch("/api/meetings/{meeting_id}")
async def patch_meeting(meeting_id: str, req: PatchMeetingRequest):
    """Update a meeting's name and/or tags."""
    data = load_meeting(meeting_id)
    if not data:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if req.name is not None:
        data["name"] = req.name
    if req.tags is not None:
        data["tags"] = req.tags
    save_meeting(meeting_id, data)
    return {"status": "updated", "name": data.get("name"), "tags": data.get("tags", [])}


# ── Session endpoints ────────────────────────────────────────────────

@app.post("/api/sessions", response_model=SessionResponse)
async def create_session(req: CreateSessionRequest = CreateSessionRequest()):
    """Start a new recording session."""
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "id": session_id,
        "name": req.name,
        "status": "recording",
        "record_screen": req.record_screen,
        "record_mic": req.record_mic,
        "tags": req.tags,
        "store": TranscriptStore(),
        "summary": None,
        "batch_offset": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "qa_history": [],
    }
    return SessionResponse(session_id=session_id, status="recording", name=req.name)


@app.post("/api/sessions/{session_id}/audio")
async def upload_audio_chunk(session_id: str, audio: UploadFile = File(...)):
    """Upload an audio chunk.

    The backend will:
    1. Run STT (via PwC API)
    2. Add results to the transcript
    """
    session = get_session(session_id)
    if session["status"] != "recording":
        raise HTTPException(status_code=400, detail="Session is not recording")

    audio_bytes = await audio.read()
    logger.info(f"Received audio chunk: {len(audio_bytes)} bytes, content_type={audio.content_type}")
    store: TranscriptStore = session["store"]
    batch_offset = session["batch_offset"]

    try:
        stt_result = await transcribe_audio(audio_bytes)
    except Exception as e:
        logger.error(f"STT failed for session {session_id}: {e}")
        # Still update offset so next chunk aligns, but skip transcript
        session["batch_offset"] += get_audio_duration(audio_bytes)
        return {
            "batch_index": store._batch_counter,
            "segments_added": 0,
            "transcript_preview": "",
            "error": f"Transcription failed: {type(e).__name__}",
        }

    logger.info(f"STT result: '{stt_result['text'][:200]}', {len(stt_result.get('words', []))} words with timestamps")

    _add_stt_to_store(store, stt_result, batch_offset)

    store.increment_batch()
    session["batch_offset"] += get_audio_duration(audio_bytes)

    return {
        "batch_index": store._batch_counter - 1,
        "segments_added": 1,
        "transcript_preview": stt_result["text"][:200],
    }


@app.get("/api/sessions/{session_id}/transcript")
async def get_transcript(session_id: str, recent: bool = False):
    """Get the full or recent transcript."""
    session = get_session(session_id)
    store: TranscriptStore = session["store"]

    if recent:
        text = store.get_recent_transcript()
    else:
        text = store.get_full_transcript()

    return {
        "session_id": session_id,
        "transcript": text,
        "segments": store.segments,
        "total_segments": len(store.segments),
    }


@app.get("/api/sessions/{session_id}/suggestions")
async def get_suggestions(session_id: str):
    """Generate live suggestions based on past meetings with matching tags.

    Looks at the current transcript so far, finds past meetings that share
    the same tags, and generates contextual suggestions (reminders of past
    decisions, open action items, relevant context).
    """
    from genai_client import llm_complete
    from config import GENAI_LLM_MODEL

    session = get_session(session_id)
    store: TranscriptStore = session["store"]
    session_tags = session.get("tags", [])

    if not session_tags:
        return {"suggestions": [], "related_meetings": []}

    current_transcript = store.get_full_transcript()
    if not current_transcript or len(current_transcript.strip()) < 50:
        return {"suggestions": [], "related_meetings": []}

    # Find past meetings with overlapping tags
    all_meetings = load_all_meetings()
    related = []
    for m in all_meetings:
        if m.get("id") == session_id:
            continue
        meeting_tags = m.get("tags", [])
        if any(t in meeting_tags for t in session_tags):
            related.append(m)

    if not related:
        return {"suggestions": [], "related_meetings": []}

    # Build context from related meetings (summaries + action items)
    past_context_parts = []
    related_info = []
    for m in related[:10]:
        name = m.get("name", "Untitled")
        related_info.append({"id": m.get("id"), "name": name})
        summary = m.get("summary", {})
        if isinstance(summary, dict):
            parts = []
            if summary.get("summary"):
                parts.append(f"Summary: {summary['summary']}")
            if summary.get("action_items"):
                parts.append("Action items: " + "; ".join(summary["action_items"]))
            if summary.get("decisions"):
                parts.append("Decisions: " + "; ".join(summary["decisions"]))
            if parts:
                past_context_parts.append(f"[{name}]\n" + "\n".join(parts))

    if not past_context_parts:
        return {"suggestions": [], "related_meetings": related_info}

    past_context = "\n\n".join(past_context_parts)

    prompt = f"""You are a meeting assistant providing live suggestions during a meeting.

The current meeting shares tags with previous meetings. Based on what is being discussed NOW
and what was discussed PREVIOUSLY, generate concise, actionable suggestions.

Focus on:
- Reminders of unresolved action items from past meetings that are relevant to what's being discussed
- Previous decisions that relate to the current discussion
- Context the participants might have forgotten or should be aware of
- Potential follow-ups based on patterns from past meetings

PAST MEETINGS CONTEXT:
{past_context[:4000]}

CURRENT MEETING TRANSCRIPT (so far):
{current_transcript[:3000]}

Return 2-5 brief, specific suggestions. Each suggestion should be one clear sentence.
If nothing relevant is found, return an empty list.

Format your response as a JSON array of strings, e.g.:
["suggestion 1", "suggestion 2"]

SUGGESTIONS:"""

    try:
        raw = await llm_complete(prompt, model=GENAI_LLM_MODEL)
        # Parse JSON array from response
        import json as _json
        raw = raw.strip()
        # Handle markdown code blocks
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        suggestions = _json.loads(raw)
        if not isinstance(suggestions, list):
            suggestions = []
    except Exception as e:
        logger.warning(f"Suggestions generation failed: {e}")
        suggestions = []

    return {"suggestions": suggestions, "related_meetings": related_info}


@app.post("/api/sessions/{session_id}/ask", response_model=AskResponse)
async def ask_question(session_id: str, req: AskRequest):
    """Ask a question about the meeting transcript so far."""
    session = get_session(session_id)
    store: TranscriptStore = session["store"]

    if not store.segments:
        raise HTTPException(status_code=400, detail="No transcript data yet")

    relevant = await store.search(req.question, top_k=5)
    answer = await store.ask_question(req.question)

    session["qa_history"].append({"question": req.question, "answer": answer})

    return AskResponse(answer=answer, relevant_segments=relevant)


@app.post("/api/sessions/{session_id}/upload-audio")
async def upload_complete_audio(session_id: str, audio: UploadFile = File(...)):
    """Upload the complete recording audio for archival."""
    get_session(session_id)  # validate session exists
    audio_bytes = await audio.read()
    save_audio(session_id, audio_bytes)
    logger.info(f"Saved complete audio: {len(audio_bytes)} bytes for session {session_id}")
    return {"status": "saved", "size": len(audio_bytes)}


class FinishRequest(BaseModel):
    notes: str = ""


SUMMARY_TIMEOUT = 180  # 3 minutes max for summary generation


@app.post("/api/sessions/{session_id}/finish")
async def finish_session(session_id: str, body: FinishRequest | None = None):
    """End the recording session and generate summary."""
    session = get_session(session_id)
    session["status"] = "processing"

    store: TranscriptStore = session["store"]
    notes = body.notes if body else ""
    logger.info(f"Finishing session {session_id} with notes: {notes[:200] if notes else '(none)'}")

    try:
        summary = await asyncio.wait_for(
            store.generate_summary(notes=notes),
            timeout=SUMMARY_TIMEOUT,
        )
    except asyncio.TimeoutError:
        logger.error(f"Summary generation timed out for session {session_id}")
        summary = {"summary": "Summary generation timed out. You can regenerate from the meeting page.", "action_items": [], "decisions": []}
    except Exception as e:
        logger.error(f"Summary generation failed for session {session_id}: {e}")
        summary = {"summary": f"Summary generation failed: {type(e).__name__}. You can regenerate from the meeting page.", "action_items": [], "decisions": []}

    session["summary"] = summary
    session["status"] = "finished"

    # Persist to disk
    save_meeting(session_id, {
        "id": session_id,
        "name": session["name"],
        "status": "finished",
        "created_at": session["created_at"],
        "segments": store.segments,
        "transcript": store.get_full_transcript(),
        "total_segments": len(store.segments),
        "summary": summary,
        "qa_history": session["qa_history"],
        "notes": notes,
        "tags": session.get("tags", []),
    })

    return {
        "session_id": session_id,
        "status": "finished",
        "summary": summary,
    }


@app.get("/api/sessions/{session_id}/summary")
async def get_summary(session_id: str):
    """Get the meeting summary (available after finishing)."""
    session = get_session(session_id)

    if session["status"] == "recording":
        raise HTTPException(status_code=400, detail="Session still recording. Call /finish first.")
    if session["status"] == "processing":
        raise HTTPException(status_code=202, detail="Summary is being generated...")

    return {
        "session_id": session_id,
        "summary": session["summary"],
    }


@app.post("/api/meetings/{meeting_id}/regenerate")
async def regenerate_summary(meeting_id: str):
    """Regenerate the summary for a finished meeting using stored segments."""
    data = load_meeting(meeting_id)
    if not data:
        raise HTTPException(status_code=404, detail="Meeting not found")

    segments = data.get("segments", [])
    if not segments:
        raise HTTPException(status_code=400, detail="No transcript segments to summarise")

    store = TranscriptStore()
    for seg in segments:
        store.add_segment(seg["start"], seg["end"], seg["speaker"], seg["text"])

    notes = data.get("notes", "")
    summary = await store.generate_summary(notes=notes)

    data["summary"] = summary
    data["transcript"] = store.get_full_transcript()
    save_meeting(meeting_id, data)

    # Update in-memory session if it exists
    if meeting_id in sessions:
        sessions[meeting_id]["summary"] = summary

    return {"session_id": meeting_id, "summary": summary}


# ── System audio capture endpoints ───────────────────────────────────

@app.post("/api/sessions/{session_id}/start-system-capture")
async def start_system_capture(session_id: str):
    """Start capturing system audio via macOS ScreenCaptureKit.

    This captures ALL system audio (Teams, Zoom, browser, etc.)
    without needing any third-party tools.
    """
    global _audio_capture
    session = get_session(session_id)
    if session["status"] != "recording":
        raise HTTPException(status_code=400, detail="Session is not recording")

    if _audio_capture and _audio_capture.is_running:
        raise HTTPException(status_code=400, detail="System audio capture already running")

    _audio_capture = SystemAudioCapture()
    await _audio_capture.start()

    # Start background task to process audio chunks
    asyncio.create_task(_process_system_audio(session_id))

    return {"status": "capturing", "message": "System audio capture started"}


async def _process_system_audio(session_id: str):
    """Background task that processes system audio in 30s chunks."""
    global _audio_capture
    while _audio_capture and _audio_capture.is_running:
        await asyncio.sleep(10)

        if session_id not in sessions:
            break
        session = sessions[session_id]
        if session["status"] != "recording":
            break

        audio_bytes = _audio_capture.get_audio_chunk()
        if not audio_bytes or len(audio_bytes) < 1000:
            continue

        logger.info(f"System audio chunk: {len(audio_bytes)} bytes")
        store: TranscriptStore = session["store"]
        batch_offset = session["batch_offset"]

        try:
            stt_result = await transcribe_audio(audio_bytes)
            logger.info(f"System audio STT: '{stt_result['text'][:200]}'")

            _add_stt_to_store(store, stt_result, batch_offset, speaker="SYSTEM")

            store.increment_batch()
            session["batch_offset"] += get_audio_duration(audio_bytes)
        except Exception as e:
            logger.error(f"Error processing system audio: {e}")


@app.post("/api/sessions/{session_id}/stop-system-capture")
async def stop_system_capture(session_id: str):
    """Stop system audio capture."""
    global _audio_capture
    if _audio_capture and _audio_capture.is_running:
        await _audio_capture.stop()
        _audio_capture = None
    return {"status": "stopped"}


@app.get("/api/audio-devices")
async def list_audio_devices():
    """List available audio input devices."""
    try:
        import sounddevice as sd
        devices = sd.query_devices()
        inputs = []
        for i, d in enumerate(devices):
            if d["max_input_channels"] > 0:
                inputs.append({"id": i, "name": d["name"], "channels": d["max_input_channels"]})
        return {"devices": inputs}
    except Exception as e:
        return {"devices": [], "error": str(e)}


@app.get("/api/usage")
async def get_usage_stats():
    """Get cumulative token usage and estimated cost across all sessions."""
    from usage import get_usage
    return get_usage()


@app.get("/api/models")
async def get_models():
    """Get available models and current selection."""
    from config import USE_RERANK, GENAI_RERANK_MODEL
    return {
        "available": AVAILABLE_MODELS,
        "active": get_active_models(),
        "rerank": {"enabled": USE_RERANK, "model": GENAI_RERANK_MODEL},
    }


class SetModelRequest(BaseModel):
    category: str
    model_id: str


@app.patch("/api/models")
async def update_model(req: SetModelRequest):
    """Change the active model for a category (llm, chat, stt, embeddings)."""
    valid_categories = set(AVAILABLE_MODELS.keys()) | {"chat"}
    if req.category not in valid_categories:
        raise HTTPException(status_code=400, detail=f"Invalid category: {req.category}")
    if not set_model(req.category, req.model_id):
        raise HTTPException(status_code=400, detail=f"Invalid model: {req.model_id}")
    return {"status": "updated", "active": get_active_models()}


@app.post("/api/models/rerank-toggle")
async def toggle_rerank():
    """Toggle rerank on/off for cross-meeting search."""
    import config
    config.USE_RERANK = not config.USE_RERANK
    config.save_settings()
    return {"enabled": config.USE_RERANK}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ── Static frontend ─────────────────────────────────────────────

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
async def serve_index():
    return FileResponse(str(STATIC_DIR / "index.html"))
