import json
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

SETTINGS_PATH = Path(__file__).parent / "data" / "settings.json"

GENAI_BASE_URL = os.getenv("GENAI_BASE_URL", "https://genai-sharedservice-emea.pwc.com")
GENAI_API_KEY = os.getenv("GENAI_API_KEY", "")
GENAI_API_VERSION = os.getenv("GENAI_API_VERSION", "")
GENAI_LLM_MODEL = os.getenv("GENAI_LLM_MODEL", "openai.gpt-4o-mini")
GENAI_CHAT_MODEL = os.getenv("GENAI_CHAT_MODEL", "vertex_ai.gemini-2.0-flash")
GENAI_EMBEDDINGS_MODEL = os.getenv("GENAI_EMBEDDINGS_MODEL", "azure.text-embedding-3-large")
GENAI_EMBEDDINGS_DIMENSIONS = int(os.getenv("GENAI_EMBEDDINGS_DIMENSIONS", "1536"))
GENAI_STT_MODEL = os.getenv("GENAI_STT_MODEL", "openai.gpt-4o-mini-transcribe")
GENAI_REALTIME_MODEL = os.getenv("GENAI_REALTIME_MODEL", "openai.gpt-realtime-mini")
USE_MOCK_AI = os.getenv("USE_MOCK_AI", "false").lower() == "true"
HF_AUTH_TOKEN = os.getenv("HF_AUTH_TOKEN", "")
USE_RERANK = os.getenv("USE_RERANK", "false").lower() == "true"
GENAI_RERANK_MODEL = "bedrock.cohere.rerank-3-5"


def _load_settings():
    """Load persisted settings from disk, overriding defaults."""
    global GENAI_LLM_MODEL, GENAI_CHAT_MODEL, GENAI_STT_MODEL, GENAI_EMBEDDINGS_MODEL, USE_RERANK
    if not SETTINGS_PATH.exists():
        return
    try:
        data = json.loads(SETTINGS_PATH.read_text())
        if "llm" in data:
            GENAI_LLM_MODEL = data["llm"]
        if "chat" in data:
            GENAI_CHAT_MODEL = data["chat"]
        if "stt" in data:
            GENAI_STT_MODEL = data["stt"]
        if "embeddings" in data:
            GENAI_EMBEDDINGS_MODEL = data["embeddings"]
        if "use_rerank" in data:
            USE_RERANK = data["use_rerank"]
    except (json.JSONDecodeError, OSError):
        pass


def save_settings():
    """Persist current settings to disk."""
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(json.dumps({
        "llm": GENAI_LLM_MODEL,
        "chat": GENAI_CHAT_MODEL,
        "stt": GENAI_STT_MODEL,
        "embeddings": GENAI_EMBEDDINGS_MODEL,
        "use_rerank": USE_RERANK,
    }, indent=2))


_load_settings()

# Available models with pricing (per 1M tokens or per minute for audio)
AVAILABLE_MODELS = {
    "llm": [
        {"id": "vertex_ai.gemini-2.0-flash", "name": "Gemini 2.0 Flash", "input_price": 0.10, "output_price": 0.40, "unit": "1M tokens"},
        {"id": "openai.gpt-5-nano", "name": "GPT-5 Nano", "input_price": 0.10, "output_price": 0.40, "unit": "1M tokens"},
        {"id": "openai.gpt-4.1-nano", "name": "GPT-4.1 Nano", "input_price": 0.10, "output_price": 0.40, "unit": "1M tokens"},
        {"id": "openai.gpt-4o-mini", "name": "GPT-4o Mini", "input_price": 0.15, "output_price": 0.60, "unit": "1M tokens"},
        {"id": "openai.gpt-4.1-mini", "name": "GPT-4.1 Mini", "input_price": 0.40, "output_price": 1.60, "unit": "1M tokens"},
        {"id": "openai.o3-mini", "name": "o3-mini", "input_price": 1.10, "output_price": 4.40, "unit": "1M tokens"},
        {"id": "openai.o4-mini", "name": "o4-mini", "input_price": 1.10, "output_price": 4.40, "unit": "1M tokens"},
        {"id": "openai.gpt-4.1", "name": "GPT-4.1", "input_price": 2.00, "output_price": 8.00, "unit": "1M tokens"},
        {"id": "openai.gpt-4o", "name": "GPT-4o", "input_price": 2.50, "output_price": 10.00, "unit": "1M tokens"},
        {"id": "openai.gpt-4.5-preview", "name": "GPT-4.5 Preview", "input_price": 75.00, "output_price": 150.00, "unit": "1M tokens"},
        {"id": "openai.o3", "name": "o3", "input_price": 10.00, "output_price": 40.00, "unit": "1M tokens"},
        {"id": "openai.o1", "name": "o1", "input_price": 15.00, "output_price": 60.00, "unit": "1M tokens"},
    ],
    "stt": [
        {"id": "openai.gpt-4o-mini-transcribe", "name": "GPT-4o Mini Transcribe", "input_price": 1.25, "output_price": 5.00, "unit": "1M tokens"},
        {"id": "whisper", "name": "Whisper", "price": 0.006, "unit": "minute"},
    ],
    "embeddings": [
        {"id": "azure.text-embedding-3-large", "name": "Text Embedding 3 Large", "input_price": 0.13, "output_price": 0.0, "unit": "1M tokens"},
    ],
}


def get_active_models() -> dict:
    """Return currently active model IDs."""
    return {
        "llm": GENAI_LLM_MODEL,
        "chat": GENAI_CHAT_MODEL,
        "stt": GENAI_STT_MODEL,
        "embeddings": GENAI_EMBEDDINGS_MODEL,
    }


def set_model(category: str, model_id: str) -> bool:
    """Set a model at runtime. Returns True if valid."""
    global GENAI_LLM_MODEL, GENAI_CHAT_MODEL, GENAI_STT_MODEL, GENAI_EMBEDDINGS_MODEL
    # chat and llm share the same available model list
    lookup = "llm" if category == "chat" else category
    valid_ids = [m["id"] for m in AVAILABLE_MODELS.get(lookup, [])]
    if model_id not in valid_ids:
        return False
    if category == "llm":
        GENAI_LLM_MODEL = model_id
    elif category == "chat":
        GENAI_CHAT_MODEL = model_id
    elif category == "stt":
        GENAI_STT_MODEL = model_id
    elif category == "embeddings":
        GENAI_EMBEDDINGS_MODEL = model_id
    save_settings()
    return True
