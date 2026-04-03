# Active Context

## Current Focus
First prototype built - procedural map, units, camera, mouse controls, UI. Awaiting Mike's visual feedback.

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
1. **Mike tests prototype** - Run `npm run dev -- --host`, check map/controls/units, give feedback.
2. **Dave onboarding** - Accept GitHub invite, clone, run setup, `/refresh`.
3. **Iterate on prototype** - Based on feedback: tweak terrain, camera feel, unit movement, UI.
4. **Team assignment** - Add player team concept (URL param or UI toggle) so each player controls their own units.
5. **Cortex integration** - Discord bot is in a separate repo (Cortex). Wire it up for cross-Claude context sharing.
6. **Design doc consolidation** - Issues HW-002 through HW-007 have open questions needing Dave's input.
