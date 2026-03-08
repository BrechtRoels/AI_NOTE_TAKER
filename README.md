# AI Note Taker

An AI-powered meeting note-taker that records, transcribes, diarizes, and summarizes meetings in real time. Built with a FastAPI backend and a Next.js frontend. Works on both **macOS** and **Windows**.

## Features

- **Live recording** — capture microphone, screen audio, and system audio simultaneously
- **Cross-platform** — macOS (ScreenCaptureKit) and Windows (WASAPI loopback) system audio capture
- **Speech-to-text** — real-time transcription via configurable STT models
- **Speaker diarization** — automatic speaker identification using pyannote.audio
- **AI summaries** — generates summaries with action items and decisions when a meeting ends
- **Cross-meeting Q&A** — ask questions across all past meetings using embeddings + optional reranking
- **Streaming chat** — SSE-based streaming answers with conversation history
- **Transcript upload** — import existing PDF/DOCX transcripts
- **Export** — download meeting summaries as branded PDF or Minutes of Meeting (DOCX)
- **Podcast generation** — turn meetings into multi-speaker podcast audio
- **Model selection** — switch LLM, STT, and embedding models at runtime from a settings page
- **Usage tracking** — monitor token usage and estimated cost per model
- **Dark/light theme** — toggle via the UI

## Platform Support

| Feature               | macOS                    | Windows                          |
| --------------------- | ------------------------ | -------------------------------- |
| Microphone recording  | Browser API              | Browser API                      |
| Screen audio          | Browser API              | Browser API                      |
| System audio capture  | ScreenCaptureKit         | WASAPI loopback (sounddevice)    |
| Speaker diarization   | pyannote.audio           | pyannote.audio                   |

**Microphone** and **screen audio** recording work on any platform via standard browser APIs (MediaRecorder / getUserMedia / getDisplayMedia).

**System audio capture** (Teams, Zoom, etc.) uses native OS APIs:
- **macOS**: ScreenCaptureKit (built-in, requires screen recording permission)
- **Windows**: WASAPI loopback via sounddevice (requires "Stereo Mix" enabled or a virtual audio cable)

## Tech Stack

| Layer    | Technology                                                  |
| -------- | ----------------------------------------------------------- |
| Frontend | Next.js 15, React 19, Tailwind CSS 4, TypeScript           |
| Backend  | Python, FastAPI, Uvicorn                                    |
| AI/ML    | pyannote.audio (diarization), PwC GenAI API (LLM/STT/embeddings) |
| Audio    | ScreenCaptureKit (macOS), sounddevice/WASAPI (Windows)      |
| Export   | ReportLab (PDF), python-docx (DOCX)                        |

## Project Structure

```
AI_NOTE_TAKER/
├── backend/
│   ├── main.py                 # FastAPI app & all REST endpoints
│   ├── config.py               # Model config, env vars, settings
│   ├── genai_client.py         # PwC GenAI API client
│   ├── stt.py                  # Speech-to-text
│   ├── diarization.py          # Speaker diarization (pyannote)
│   ├── transcript.py           # Transcript store & summary generation
│   ├── storage.py              # Meeting persistence (JSON files)
│   ├── pdf_summary.py          # Branded PDF export
│   ├── mom_generator.py        # Minutes of Meeting DOCX export
│   ├── podcast.py              # Podcast generation
│   ├── audio_capture.py        # Platform router (auto-selects backend)
│   ├── audio_capture_macos.py  # macOS ScreenCaptureKit implementation
│   ├── audio_capture_windows.py # Windows WASAPI loopback implementation
│   ├── usage.py                # Token usage tracking
│   ├── requirements.txt
│   └── run.sh                  # Start script (macOS/Linux)
├── frontend/
│   ├── app/                    # Next.js pages (home, record, meetings, settings)
│   ├── components/             # Sidebar, chat panel, app shell, theme provider
│   ├── lib/api.ts              # API client
│   └── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Hugging Face token for pyannote.audio models
- API key for the GenAI service

### Backend

#### macOS / Linux

```bash
cd backend
cp .env.example .env
# Edit .env with your API keys (GENAI_API_KEY, HF_AUTH_TOKEN, etc.)
./run.sh
```

#### Windows

```powershell
cd backend
copy .env.example .env
# Edit .env with your API keys
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

This creates a virtual environment, installs dependencies, and starts the API server on `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on `http://localhost:3000` and proxies API calls to the backend.

### Windows System Audio Setup

To capture system audio (Teams, Zoom, etc.) on Windows, you need a loopback audio device:

1. **Enable Stereo Mix** (easiest):
   - Open Control Panel > Sound > Recording tab
   - Right-click in the device list > "Show Disabled Devices"
   - Right-click "Stereo Mix" > Enable
2. **Or install a virtual audio cable** (e.g. VB-CABLE or VoiceMeeter) if Stereo Mix is unavailable

Without a loopback device, you can still use microphone and screen audio recording.

### Environment Variables

| Variable                    | Description                          |
| --------------------------- | ------------------------------------ |
| `GENAI_API_KEY`             | API key for the GenAI service        |
| `GENAI_BASE_URL`            | GenAI API base URL                   |
| `HF_AUTH_TOKEN`             | Hugging Face token (for pyannote)    |
| `GENAI_LLM_MODEL`          | Default LLM model                    |
| `GENAI_CHAT_MODEL`          | Default chat model                   |
| `GENAI_STT_MODEL`           | Default STT model                    |
| `GENAI_EMBEDDINGS_MODEL`    | Default embeddings model             |
| `USE_RERANK`                | Enable reranking for search (`true`/`false`) |

## API Endpoints

| Method   | Path                                     | Description                        |
| -------- | ---------------------------------------- | ---------------------------------- |
| `GET`    | `/api/meetings`                          | List all meetings                  |
| `GET`    | `/api/meetings/{id}`                     | Get meeting details                |
| `DELETE` | `/api/meetings/{id}`                     | Delete a meeting                   |
| `PATCH`  | `/api/meetings/{id}`                     | Rename a meeting                   |
| `POST`   | `/api/meetings/upload`                   | Upload a PDF/DOCX transcript       |
| `POST`   | `/api/meetings/{id}/regenerate`          | Regenerate summary                 |
| `GET`    | `/api/meetings/{id}/summary-pdf`         | Download summary PDF               |
| `GET`    | `/api/meetings/{id}/mom`                 | Download Minutes of Meeting DOCX   |
| `GET`    | `/api/meetings/{id}/audio`               | Stream meeting audio               |
| `POST`   | `/api/sessions`                          | Start a recording session          |
| `POST`   | `/api/sessions/{id}/audio`               | Upload an audio chunk              |
| `GET`    | `/api/sessions/{id}/transcript`          | Get current transcript             |
| `POST`   | `/api/sessions/{id}/ask`                 | Ask a question about the meeting   |
| `POST`   | `/api/sessions/{id}/finish`              | End session & generate summary     |
| `POST`   | `/api/ask-global`                        | Ask across all meetings            |
| `POST`   | `/api/podcast/generate`                  | Generate a podcast from meetings   |
| `GET`    | `/api/models`                            | Get available/active models        |
| `PATCH`  | `/api/models`                            | Change active model                |
| `GET`    | `/api/usage`                             | Get usage statistics               |
