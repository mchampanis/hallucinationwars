# Active Context

## Current Focus
Prototype playable. SC2-style controls implemented. Dave contributed 3D tank models (PR #2). Iterating on feel and controls.

## Recent Decisions
- **Tech stack**: Three.js + cannon-es + Wasmoon + PeerJS + Vite + TypeScript
- **PlayCanvas rejected**: engine-only mode is second-class, docs assume cloud editor
- **.memory/ is now committed** (shared between both Claudes, attributed entries)
- Token economy: starting balance + miner income + steal from enemy. Real model tiers, cross-provider allowed.
- LLM integration: player's own API key, game-mediated proxy enforces token budget. LLM does NOT control game in real-time.
- Player control: player moves units with mouse, Lua scripts define unit internals, LLM provides map overlay suggestions.
- Lua sandbox: absolute safety, no OS access, Wasmoon WASM sandbox, stripped stdlib.
- Prep phase: no fixed timer, StarCraft-style economic pressure prevents turtling.
- **Branch protection dropped** - both devs push to main directly, feature branches only for multi-day/experimental work.
- **SC2-style controls** - left-click select, left-drag box select, right-click move, MMB pan, arrow keys pan. WASD removed to free A/S/H for unit commands. Attack-move (A), stop (S), hold (H), control groups (Ctrl+0-9).
- **Edge pan fix** - mouse position persists when leaving canvas so edge panning works in browser.

## What Needs to Happen Next
1. **Dave onboarding** - Accept GitHub invite, clone, run setup, `/refresh`.
2. **Team assignment** - Add player team concept (URL param or UI toggle) so each player controls their own units.
3. **Iterate on prototype** - Tweak terrain, camera feel, unit movement, UI based on playtesting.
4. **Cortex integration** - Discord bot is in a separate repo (Cortex). Wire it up for cross-Claude context sharing.
5. **Design doc consolidation** - Issues HW-002 through HW-008 have open questions needing Dave's input.
