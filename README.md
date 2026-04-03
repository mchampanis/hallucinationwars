# Hallucination Wars

A 2-player RTS where each side has an LLM as strategic advisor. The LLM designs units from gathered materials, plans resource strategy, and reverse-engineers stolen tech - all within a token budget that forces real tradeoffs.

## Concept

- **Prep Phase**: Explore a procedural map, mine materials, consult your LLM to design units and tech from what you've gathered. No hardcoded recipes - the LLM decides what's buildable following physical logic (wood -> bows, sulphur -> gunpowder, etc).
- **Combat Phase**: Fight blind against the opponent's unknown composition. Steal "DNA" (Lua code fragments) and materials from defeated units.
- **Evolution**: Feed stolen DNA to your LLM for reverse-engineering. Incorporate enemy tech into next-gen units.

## Design Pillars

- **LLM as constrained strategist** - Token budget forces interesting decisions: spend big on one brilliant design, or spread across many small calls?
- **Emergent fun over optimal play** - Dumb physics, hilarious failures, and absurd strategies are features.
- **Nothing is off-limits** - All terrain is reachable if you design the right unit for it.
- **Fog of war + tech espionage** - You never know what the other side built until you're fighting it.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [Git](https://git-scm.com/)
- [VS Code](https://code.visualstudio.com/)

### Quick Start

Clone the repo and run the setup script for your platform:

```bash
git clone git@github.com:mchampanis/hallucinationwars.git
cd hallucinationwars
```

**macOS:**
```bash
bash scripts/setup.sh
```

**Windows (PowerShell):**
```powershell
.\scripts\setup.ps1
```

The setup script checks dependencies and installs recommended VS Code extensions (Live Share, Lua, ESLint, Prettier, EditorConfig).

### Running

```bash
npm install
npm run dev -- --host
```

Or use the run scripts: `.\scripts\dev.ps1` (Windows) / `bash scripts/dev.sh` (macOS). The dev server is LAN-accessible so both developers can view it.

### Claude Code Onboarding

Both developers use [Claude Code](https://claude.ai/code) as their AI pair programmer. After cloning and running the setup script:

1. Open the project in Claude Code
2. Run `/refresh` to get a full summary of the project state, open issues, and next steps
3. If this is your first session, `/refresh` will also create your local `.memory/` directory

Other available skills: `/check` (review code for bugs and smells) and `/research <topic>` (fact-checked research). See `COLLAB.md` for the full collaboration guide.

### Collaboration

- **Live Share**: Open the project in VS Code, start or join a Live Share session. The workspace is pre-configured with `liveshare.populateGitCoAuthors` enabled so commits reflect both contributors.
- **GitHub**: `main` is protected. Work on feature branches, merge via PR. Coordinate on Discord `#github-hw` (webhook active).
- **Discord**: All GitHub activity (pushes, PRs, issues) posts to `#github-hw` automatically.

## Status

Prototype: procedural terrain with biomes, camera controls, unit selection/movement, basic UI. No networking, LLM, or Lua integration yet.

## Ethics

See [ETHICS.md](ETHICS.md) for our position on AI-assisted development.

## License

MIT
