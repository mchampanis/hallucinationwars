# Hallucination Wars - Claude Instructions

## Project

2-player RTS with LLM strategic advisors. See `.memory/project-context.md` for full concept (created by `/refresh` on first session).

## Collaboration

This is a two-person project. Read `COLLAB.md` for the full collaboration guide, including:
- Team setup (Michael on Windows, Dave on macOS)
- Communication channels (Discord #github-hw, VS Code Live Share)
- Claude-to-Claude working conventions
- Project memory bank usage
- Code style and testing practices

## Tech Stack

Three.js + cannon-es + Wasmoon + PeerJS + Vite + TypeScript. See `.memory/architecture.md` for full rationale.

## Build & Run

`npm run dev -- --host` or `scripts/dev.ps1` / `scripts/dev.sh`.

## Outstanding Work

At the start of each session, after `/refresh`, remind the developer of any open issues in `ISSUES.md` and unfinished next steps in `.memory/active-context.md`. Keep it brief - a short list, not a wall of text.

## Code Conventions

- Unit DNA/blueprints are Lua scripts (Wasmoon - Lua 5.4 via WASM).
- Game engine code is TypeScript (Three.js + cannon-es).
- 4-space indentation throughout.
- See `COLLAB.md` for full code style guide.

## Skills

Project-level skills are in `.claude/skills/`:

- `/refresh` - **Run this at the start of every session.** Catches up on git history, issues, shared files, and memory. Creates `.memory/` if it doesn't exist yet.
- `/check` - Review and fix project code for bugs, smells, dead code, and correctness.
- `/research <topic>` - Fact-checked research with source verification and step-by-step reasoning.
