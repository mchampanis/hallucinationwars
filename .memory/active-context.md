# Active Context

## Current Focus
Tech stack decided. Design issues filed. Ready to start prototyping or continue design discussions with Dave.

## Recent Decisions
- **Tech stack**: Three.js + cannon-es + Wasmoon + PeerJS + Vite + TypeScript
- **PlayCanvas rejected**: engine-only mode is second-class, docs assume cloud editor
- **.memory/ is now committed** (shared between both Claudes, attributed entries)
- Token economy: starting balance + miner income + steal from enemy. Real model tiers, cross-provider allowed.
- LLM integration: player's own API key, game-mediated proxy enforces token budget. LLM does NOT control game in real-time.
- Player control: player moves units with mouse, Lua scripts define unit internals, LLM provides map overlay suggestions.
- Lua sandbox: absolute safety, no OS access, Wasmoon WASM sandbox, stripped stdlib.
- Prep phase: no fixed timer, StarCraft-style economic pressure prevents turtling.
- Main branch protected, all changes via branches + PRs.

## What Needs to Happen Next
1. **Dave onboarding** - Accept GitHub invite, clone, run setup, `/refresh`.
2. **Prototype scope** - Define smallest playable slice and start building.
3. **Resolve HW-003** - Material system rules (properties? validation? minimum material set?).
4. **Discord bot** - Separate project or part of this one? For live updates between developers and their Claudes.
5. **Design doc consolidation** - Issues HW-002 through HW-007 have a lot of open questions. Some need Dave's input before deciding.
