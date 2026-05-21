#!/usr/bin/env bash
# GodamAI — Frontend startup
set -e

cd "$(dirname "$0")/frontend"

echo "╔══════════════════════════════════════╗"
echo "║     GodamAI Frontend Startup         ║"
echo "╚══════════════════════════════════════╝"

# Install deps
if [ ! -d "node_modules" ]; then
  echo "→ Installing npm packages…"
  npm install
else
  echo "→ node_modules present (run npm install to update)"
fi

echo "→ Starting Vite dev server on :5173…"
npm run dev
