#!/usr/bin/env bash
# GodamAI — Backend startup
set -e

cd "$(dirname "$0")/backend"

echo "╔══════════════════════════════════════╗"
echo "║     GodamAI Backend Startup          ║"
echo "╚══════════════════════════════════════╝"

# Create venv if missing
if [ ! -d "venv" ]; then
  echo "→ Creating Python virtual environment…"
  python3 -m venv venv
fi

source venv/bin/activate

echo "→ Installing dependencies…"
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Copy .env if missing
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "⚠️  Created .env from .env.example — update Supabase credentials!"
  else
    echo "⚠️  No .env found — create backend/.env with SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY"
  fi
fi

echo "→ Starting FastAPI server on :8000…"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
