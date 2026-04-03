# Collaboration Guide

This document is for both human developers and their Claude instances. If you're Claude, read this alongside `CLAUDE.md` and the `.memory/` directory.

## Team

| Who | GitHub | Platform | Role |
|-----|--------|----------|------|
| Michael | @mchampanis | Windows | Co-lead |
| Dave | @ahoydave | macOS | Co-lead |

Both developers use Claude Code as their AI pair programmer.

## Communication

- **Discord**: `#github-hw` channel for async discussion. GitHub webhook posts all repo activity there automatically.
- **VS Code Live Share**: For real-time pairing sessions. Workspace is pre-configured (see `.vscode/`).
- **GitHub**: `main` is protected. All changes go through feature branches and PRs.

## Development Setup

### Prerequisites

- Node.js (LTS)
- Git
- VS Code with recommended extensions (prompted on first open)

### First-Time Setup

**macOS:**
```bash
git clone git@github.com:mchampanis/hallucinationwars.git
cd hallucinationwars
bash scripts/setup.sh
```

**Windows (PowerShell):**
```powershell
git clone git@github.com:mchampanis/hallucinationwars.git
cd hallucinationwars
.\scripts\setup.ps1
```

The setup scripts check dependencies and install VS Code extensions (Live Share, Lua, ESLint, Prettier, EditorConfig).

## Claude-to-Claude Collaboration

Both developers run their own Claude Code instance. To keep both Claudes in sync:

### Shared Context

- **`.memory/` directory** is gitignored - it is local to each developer's machine. Each Claude maintains its own memory bank independently.
- **`CLAUDE.md`** and **`COLLAB.md`** are committed - changes here are shared via git and picked up by both Claudes.
- **`ISSUES.md`** is committed - both Claudes should read it for known bugs and track new ones there.
- **Design discussions, decisions, and task context belong in committed files** so the other developer's Claude can see them. If you discuss something significant with your Claude - a design decision, a tradeoff, a new idea - make sure it lands in `ISSUES.md` (if it's a problem/feature), `README.md` (if it changes the project description), or `COLLAB.md` (if it changes how we work). Don't let important context live only in one Claude's conversation history.

### Working Conventions

- **Start every session with `/refresh`.** This catches you up on everything - git history, issues, shared files, memory. If `.memory/` doesn't exist yet, `/refresh` will create it for you.
- **Never commit autonomously.** Your human handles all git operations.
- **One task at a time** unless told otherwise.
- **Ask before rewriting.** Never throw away an existing implementation without explicit permission.
- **Stay on task.** If you spot something unrelated that needs fixing, add it to `ISSUES.md` instead of fixing it.
- **No destructive operations** without explanation and explicit approval.
- **Surface decisions into committed files.** If a conversation produces a design decision, architecture choice, or new task, write it to the appropriate shared file before the session ends. The other developer's Claude can't read your chat history.

### Cross-Platform Notes

- Line endings are normalized to LF via `.gitattributes` and `.editorconfig`.
- Use forward slashes in code and config. OS-specific paths only in platform-specific scripts.
- Test on both platforms when touching build scripts or file I/O.

## Project Memory Bank

Maintain a `.memory/` directory as persistent context across sessions. This is gitignored (each developer has their own).

### Files

| File | Purpose | When to create |
|------|---------|----------------|
| `project-context.md` | Project goal, scope, key constraints | When the project is initialized |
| `active-context.md` | Current focus, recent decisions, logical next steps | After the first task |
| `architecture.md` | Patterns, tech choices, system structure | Once the system takes shape |
| `progress.md` | Session journal - decisions, problems, context git log won't capture | After each working session |

### Rules

- **Always read before working.** At the start of every task, read all `.memory/` files to load context.
- **Always update after working.** After completing a task, update `active-context.md` with current state and next steps, and append a timestamped entry to `progress.md`.
- **Keep architecture current.** If a task changes patterns or structure, update `architecture.md` immediately.
- **progress.md is for context, not diffs.** Record decisions, tradeoffs, blockers. Don't duplicate git log.
- **Task tracking stays in ISSUES.md.** "Next steps" in `active-context.md` means the logical continuation of current work, not the backlog.

## Git Conventions

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>): <description>

[optional body]
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`, `ci`

Examples:
```
feat(units): add Lua blueprint parser
fix(physics): prevent units clipping through terrain
docs(collab): add token economy design notes
refactor(map): extract resource placement into generator
chore: update VS Code extensions list
```

### Branch Naming

Use `type/short-description` branches that mirror commit types:

| Prefix | Use |
|--------|-----|
| `feat/` | New features (`feat/unit-designer`, `feat/procedural-map`) |
| `fix/` | Bug fixes (`fix/lua-sandbox-escape`, `fix/pathfinding-crash`) |
| `refactor/` | Code restructuring (`refactor/material-system`) |
| `docs/` | Documentation only (`docs/token-economy`) |
| `chore/` | Tooling, deps, config (`chore/eslint-setup`) |
| `test/` | Test additions/changes (`test/combat-resolution`) |

Keep branch names short and lowercase with hyphens. `main` is protected - all changes go through branches and PRs.

## Code Style

- 4-space indentation throughout.
- Match the style of surrounding code. Consistency within a file beats external standards.
- Prefer simple, readable solutions over clever ones.
- Use idiomatic patterns for the language in use.
- Comments describe *what* and *why*, not *when* or *how the code changed*.
- Prefer ASCII equivalents: `->` not `→`, `...` not `…`, `-` not `—`.
- Run formatters/linters before considering work done.

## Testing

We practice TDD:

1. Write a failing test that defines the desired behaviour
2. Run it to confirm it fails as expected
3. Write the minimal code to make it pass
4. Confirm the test passes
5. Refactor while keeping tests green

## Skills

Project-level skills are available in `.claude/skills/`:

| Skill | Command | Description |
|-------|---------|-------------|
| check | `/check` | Review all code for bugs, smells, dead code, correctness |
| research | `/research <topic>` | Fact-checked research with source verification |
| refresh | `/refresh` | Catch up on all project state - git history, issues, shared files, memory |
