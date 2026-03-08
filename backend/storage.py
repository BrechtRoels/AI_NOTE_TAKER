"""Simple JSON file-based meeting storage."""

import json
import os
import uuid
from datetime import datetime, timezone

STORAGE_DIR = os.path.join(os.path.dirname(__file__), "data", "meetings")
AUDIO_DIR = os.path.join(os.path.dirname(__file__), "data", "audio")
CONVERSATIONS_DIR = os.path.join(os.path.dirname(__file__), "data", "conversations")


def _ensure_dir():
    os.makedirs(STORAGE_DIR, exist_ok=True)


def _meeting_path(session_id: str) -> str:
    return os.path.join(STORAGE_DIR, f"{session_id}.json")


def save_meeting(session_id: str, data: dict):
    _ensure_dir()
    with open(_meeting_path(session_id), "w") as f:
        json.dump(data, f, indent=2, default=str)


def load_meeting(session_id: str) -> dict | None:
    path = _meeting_path(session_id)
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def list_meetings() -> list[dict]:
    _ensure_dir()
    meetings = []
    for filename in os.listdir(STORAGE_DIR):
        if not filename.endswith(".json"):
            continue
        path = os.path.join(STORAGE_DIR, filename)
        with open(path) as f:
            data = json.load(f)
        meetings.append({
            "session_id": data.get("id"),
            "name": data.get("name", "Untitled Meeting"),
            "status": data.get("status"),
            "created_at": data.get("created_at"),
            "total_segments": data.get("total_segments", 0),
        })
    meetings.sort(key=lambda m: m.get("created_at", ""), reverse=True)
    return meetings


def load_all_meetings() -> list[dict]:
    """Load all meetings with full data."""
    _ensure_dir()
    meetings = []
    for filename in os.listdir(STORAGE_DIR):
        if not filename.endswith(".json"):
            continue
        path = os.path.join(STORAGE_DIR, filename)
        with open(path) as f:
            meetings.append(json.load(f))
    return meetings


def rename_meeting(session_id: str, new_name: str) -> bool:
    data = load_meeting(session_id)
    if not data:
        return False
    data["name"] = new_name
    save_meeting(session_id, data)
    return True


def delete_meeting(session_id: str) -> bool:
    path = _meeting_path(session_id)
    if os.path.exists(path):
        os.remove(path)
        delete_audio(session_id)
        return True
    return False


def save_audio(session_id: str, audio_bytes: bytes) -> str:
    os.makedirs(AUDIO_DIR, exist_ok=True)
    path = os.path.join(AUDIO_DIR, f"{session_id}.webm")
    with open(path, "wb") as f:
        f.write(audio_bytes)
    return path


def get_audio_path(session_id: str) -> str | None:
    path = os.path.join(AUDIO_DIR, f"{session_id}.webm")
    return path if os.path.exists(path) else None


def delete_audio(session_id: str):
    path = os.path.join(AUDIO_DIR, f"{session_id}.webm")
    if os.path.exists(path):
        os.remove(path)


# ── Conversation storage ──────────────────────────────────────────

def save_conversation(conversation_id: str, data: dict):
    os.makedirs(CONVERSATIONS_DIR, exist_ok=True)
    path = os.path.join(CONVERSATIONS_DIR, f"{conversation_id}.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)


def load_conversation(conversation_id: str) -> dict | None:
    path = os.path.join(CONVERSATIONS_DIR, f"{conversation_id}.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def list_conversations() -> list[dict]:
    os.makedirs(CONVERSATIONS_DIR, exist_ok=True)
    convos = []
    for filename in os.listdir(CONVERSATIONS_DIR):
        if not filename.endswith(".json"):
            continue
        path = os.path.join(CONVERSATIONS_DIR, filename)
        with open(path) as f:
            data = json.load(f)
        convos.append({
            "id": data.get("id"),
            "title": data.get("title", "Untitled"),
            "created_at": data.get("created_at"),
            "message_count": len(data.get("messages", [])),
        })
    convos.sort(key=lambda c: c.get("created_at", ""), reverse=True)
    return convos


def delete_conversation(conversation_id: str) -> bool:
    path = os.path.join(CONVERSATIONS_DIR, f"{conversation_id}.json")
    if os.path.exists(path):
        os.remove(path)
        return True
    return False
