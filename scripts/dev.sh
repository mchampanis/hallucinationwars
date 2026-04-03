#!/usr/bin/env bash
# Start dev server (LAN accessible)
# Run from project root: bash scripts/dev.sh
cd "$(dirname "$0")/.."
npm run dev -- --host
