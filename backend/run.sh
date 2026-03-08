#!/bin/bash
# Start the AI Note Taker backend
cd "$(dirname "$0")"

# Add local ffmpeg/ffprobe to PATH
export PATH="$(pwd)/bin:$PATH"

if [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
else
  source venv/bin/activate
fi

if [ ! -f ".env" ]; then
  echo "No .env file found. Copying from .env.example..."
  cp .env.example .env
  echo "Please edit backend/.env with your API keys before running."
  exit 1
fi

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
