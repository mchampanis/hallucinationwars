# Hallucination Wars - Claude Instructions

## Project

2-player RTS with LLM strategic advisors. See `.memory/project-context.md` for full concept.

## Collaboration

This is a two-person project. Read `COLLAB.md` for the full collaboration guide, including:
- Team setup (Michael on Windows, Dave on macOS)
- Communication channels (Discord #github-hw, VS Code Live Share)
- Claude-to-Claude working conventions
- Project memory bank usage
- Code style and testing practices

## Tech Stack

TBD - currently in design phase. PlayCanvas under evaluation.

## Build & Run

No build system yet.

## Code Conventions

- Unit DNA/blueprints are Lua scripts.
- Game engine code will be JS/TS (PlayCanvas).
- 4-space indentation throughout.
- See `COLLAB.md` for full code style guide.

## Skills

Project-level skills are in `.claude/skills/`:

- `/refresh` - **Run this at the start of every session.** Catches up on git history, issues, shared files, and memory. Creates `.memory/` if it doesn't exist yet.
- `/check` - Review all project code for bugs, smells, dead code, and correctness.
- `/research <topic>` - Fact-checked research with source verification and step-by-step reasoning.
