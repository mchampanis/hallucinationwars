---
name: refresh
description: Catch up on all shared project state - files, issues, decisions, and recent changes.
disable-model-invocation: true
---

Bring yourself fully up to date with the current state of the project. Another developer (and their Claude) may have made changes since your last session.

1. Run `git log --oneline -20` to see recent commits.
2. Run `git diff HEAD~5 --stat` to see what files changed recently (adjust range if needed).
3. Read all of these files in full:
    - `CLAUDE.md`
    - `COLLAB.md`
    - `ISSUES.md`
    - `README.md`
4. Read all files in `.memory/` if they exist:
    - `.memory/project-context.md`
    - `.memory/active-context.md`
    - `.memory/architecture.md`
    - `.memory/progress.md`
5. Summarise to the developer:
    - What the project is and its current status
    - Recent changes (from git log) and who made them
    - All open issues and their status
    - Current focus and next steps (from active-context.md)
    - Anything that looks like it needs attention or is blocked
6. If `.memory/` files don't exist yet (first session for this developer), create them based on what you learned from the committed files. Use the memory bank structure described in `COLLAB.md`.
