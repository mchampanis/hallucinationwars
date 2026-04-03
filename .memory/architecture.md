# Hallucination Wars - Architecture

## Status: Pre-Development (Design Phase)

No code yet. This document captures architectural thinking as it forms.

## Tech Stack (Decided 2026-04-03)

| Layer | Technology | Why |
|-------|-----------|-----|
| Rendering | Three.js (isometric OrthographicCamera) | Flexible, massive ecosystem (5M weekly npm downloads), "building with Legos" feel. Not an opinionated engine - we control the architecture |
| Physics | cannon-es | Lightweight (~100KB), pure JS, easy to hack for intentional jankiness. Crank restitution + random impulses = funny units |
| Lua Scripting | Wasmoon (Lua 5.4 via WASM) | Official Lua compiled to WASM, ~200KB. Thin wrapper, Lua 5.4 is current. Fengari as fallback |
| Networking | PeerJS (WebRTC P2P) | Good enough for 2-player testing. Upgrade path to server if needed |
| Terrain | THREE.Terrain or custom heightmap | Procedural generation well-documented for Three.js |
| Build | Vite + TypeScript | Fast, modern, lightweight |
| LLM Integration | Multi-provider API (Claude, Gemini, etc.) | Each player uses own API key. Different providers = different strategies = fun asymmetry |

### Why Not Other Engines

- **PlayCanvas**: Engine-only mode is second-class citizen. Most docs/tutorials assume cloud editor.
- **Babylon.js**: Overkill. Havok physics actively resists being janky. Massive API surface.
- **Phaser**: 2D only. Can't do terrain elevation or 2.5D without hackery.

## Key Architectural Decisions

### Lua Embedding (Wasmoon)
- Units are defined by Lua scripts that encode: construction blueprint, behavior/AI, combat stats, movement capabilities, physics properties.
- When a unit is defeated, fragments of its Lua are dropped as "DNA."
- Wasmoon runs in WASM sandbox - inherently isolated from OS/filesystem.
- Must strip `os.*`, `io.*`, `loadfile`, `dofile`, `require` from Lua stdlib.
- Must enforce execution time limits and memory limits per unit.
- Each unit gets isolated Lua state.

### LLM Integration
- **NOT real-time control.** LLM designs units and writes Lua during prep phase. During combat, only Lua runs.
- Player consults LLM by spending tokens (in-game chat interface).
- All API calls go through game's token budget proxy layer.
- Each player uses own API key, can use different providers (Claude vs Gemini etc).
- LLM gets game tools via MCP pattern: list materials, inspect map, design unit, propose strategy, analyze DNA.

### Player Control Model
- **Player controls units** with mouse/keyboard (move, attack, select, group).
- **Lua scripts define unit internals** (what it CAN do, reactions, physics).
- **LLM provides strategic overlay** (suggested paths, targets, warnings on map).
- Player follows or ignores the overlay. LLM doesn't move units.
- Unit Lua still runs during player control: if LLM programmed "explode on move", it explodes when player moves it.

### Token Economy
- Starting balance per player.
- Earn tokens by building miners (active, like bitcoin mining).
- Steal token scraps from defeated enemy units.
- Spend on LLM calls - cheap model (fast, shallow) or expensive model (slow, deep).
- Real model tiers, potentially cross-provider. NOT Claude pretending to be dumb.
- Game-mediated API calls prevent bypassing token budget.

### Material System
- Materials have physical properties, no hardcoded recipes.
- LLM interprets materials and proposes logical constructions.
- Game engine validates that proposed constructions are physically plausible.
- Need fairness rules within the free-form system (see HW-003).
- Examples: wood + sinew -> bow, sulphur + charcoal + saltpeter -> gunpowder, iron + heat -> steel

### DNA / Code Fragments
- Each unit's full Lua is split into semantic chunks (movement, combat, construction, strategy).
- On defeat, 1-3 random chunks drop.
- Chunks are partially obfuscated/truncated - never clean code.
- Reconstruction requires LLM interpretation + player materials.

## Procedural Map Requirements
- Biomes: forest, mountain, plains, water, desert/wasteland
- Resources distributed with some clustering (iron near mountains, wood in forests, etc.)
- Roads/paths for easier movement but predictable routes
- Strategic chokepoints (mountain passes, river crossings)
- Both sides start with roughly equivalent access to resource diversity
- Fog of war - only see what your units can see
- Resources are finite and deplete (anti-turtling)
