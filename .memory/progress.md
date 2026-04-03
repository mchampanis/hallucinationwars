# Progress Log

## 2026-04-03

### Session: Project Kickoff
- Michael described the full game concept for Hallucination Wars.
- Core idea: 2-player RTS where each player has an LLM (Claude) as strategic advisor.
- LLM designs units from gathered materials, plans strategy, reverse-engineers stolen tech.
- Units carry Lua "DNA" that can be partially stolen on defeat.
- Token economy constrains LLM usage - creates interesting resource tradeoffs.
- Fun/quirkiness prioritized over perfect balance - dumb physics and wild strategies are features.
- Procedural map with all terrain types, nothing truly inaccessible.
- PlayCanvas suggested as platform, needs evaluation.
- Memory bank initialized. No code yet.
- Added ahoydave as GitHub collaborator (push access). Invite sent.
- Set up VS Code workspace: settings.json, extensions.json (Live Share, Lua, ESLint, Prettier, EditorConfig).
- Created .editorconfig for cross-editor consistency.
- Created setup scripts: `scripts/setup.ps1` (Windows) and `scripts/setup.sh` (macOS).
- Updated README with dev setup and collaboration instructions.
- Discord #github-hw webhook already active (set up by Michael).
- Added ahoydave as GitHub collaborator, created COLLAB.md for cross-Claude reference.
- Copied /check and /research skills from global ~/.claude/skills/ into project .claude/skills/.
- Updated CLAUDE.md to reference COLLAB.md and project skills.
- Filed HW-001: collaborative Claude context sharing - the problem of two Claude instances working on the same codebase without shared context. Documented 6 potential approaches ranging from simple (shared context log) to complex (Discord integration).

### [Mike] Session: Platform Research + Design Decisions
- Researched web game engines. Evaluated PlayCanvas, Babylon.js, Three.js, Phaser, Excalibur, PixiJS, LittleJS, Kaplay.
- **Decided on Three.js + cannon-es + Wasmoon + PeerJS + Vite + TypeScript.**
- PlayCanvas rejected (editor-centric), Babylon.js rejected (overkill, physics too correct), Phaser rejected (2D only).
- cannon-es chosen for physics specifically because it's easy to make janky on purpose.
- Wasmoon chosen for Lua (official Lua 5.4 compiled to WASM). Fengari as fallback.
- Filed HW-002 (token economy), HW-003 (material system), HW-004 (LLM integration), HW-005 (player control vs LLM autonomy), HW-006 (Lua sandboxing), HW-007 (prep phase / game flow).
- Key design decisions locked: player controls units directly, LLM provides overlay suggestions, Lua defines unit internals. LLM does NOT control game in real-time. Each player uses own API key, can use different providers.
- .memory/ changed from gitignored to committed (shared between both Claudes).
- Main branch protected. Conventional commits and branch naming adopted.
- Added /refresh skill for session onboarding.
- Multiple /check passes cleaned up typos, broken references, gitignore issues, ETHICS.md plurality.

### [Mike] Session: First Prototype
- Initialized Vite + TypeScript project with Three.js, cannon-es, simplex-noise.
- Built procedural terrain: heightmap with layered simplex noise, island falloff, biome vertex coloring (water/sand/plains/forest/rock/snow), ~3000 instanced trees.
- Camera: perspective with WASD pan, Q/E rotate, scroll zoom, middle-mouse orbit. Follows terrain height.
- Mouse input: left click select, shift+click add, drag box select, right click move-to. Hover highlighting.
- Units: 8 test capsules (4 red, 4 blue), health bars, selection rings, basic move-toward-target with terrain following and passability checks. Formation spread for multi-unit move.
- UI: resource bar (placeholder), selection panel, minimap with unit dots, controls hint overlay.
- Fixed Three.js deprecation warnings (Clock->Timer, PCFSoftShadowMap->PCFShadowMap).
- No team ownership enforcement yet - both teams selectable by anyone. Deferred to networking phase.
- Prototype not yet tested by Mike (away from PC).
