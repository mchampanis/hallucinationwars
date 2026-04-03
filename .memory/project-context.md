# Hallucination Wars - Project Context

## What Is It

A 2-player RTS where each side has an LLM as strategic advisor. The LLM isn't just a chatbot - it actively designs units, defines mechanics, plans resource strategy, and evolves technology trees in real time. Players talk to their LLM at any point during play.

## Core Loop

1. **Prep Phase** - Explore procedural map, mine materials, consult LLM to design units/tech from gathered resources.
2. **Combat Phase** - Fight the opponent without knowing their tech tree or unit composition.
3. **Scavenge Phase** (ongoing during combat) - Steal "DNA" (Lua code fragments) and materials from defeated enemy units. DNA encodes partial blueprints, strategy hints, physics tweaks. Incorporate stolen tech into next-gen units.

## Key Design Pillars

### Material-Driven Innovation
- Materials have no predetermined use. The LLM decides what's buildable from what's available.
- Must follow physical logic: wood -> bows, sulphur -> gunpowder, iron -> armor, etc.
- Mining/gathering is a strategic activity, not a boring click-fest.
- Some basic units (miners) are assumed available from the start.

### LLM as Constrained Strategist
- LLM usage costs tokens. Tokens are a finite, stealable resource.
- LLM can choose to spend few tokens on a small/fast model or many tokens on a large/powerful model.
- This prevents the game from being "two perfect AIs reaching identical conclusions."
- Token scarcity forces interesting tradeoffs: spend big on one brilliant unit design, or spread tokens across many small decisions?

### Fog of War + Tech Espionage
- Neither side knows what the other has built until combat.
- Defeated units drop DNA fragments (partial Lua) - never the full picture unless very lucky.
- Stolen DNA + materials go home for reverse engineering and next-gen development.

### Emergent Fun Over Optimal Play
- Physics should be a bit dumb/loose - units doing hilarious things is a feature.
- Dumb strategies (million kamikaze drones) should be viable and entertaining.
- Quirkiness and surprise matter more than perfect balance.
- The game should make players laugh as much as it makes them think.

### Accessibility of Terrain
- Nothing is truly off-limits on the map. Mountains, water, cliffs - all reachable if your LLM designs a unit that can handle it.
- Clever unit design (climbing units, amphibious units, flying units) unlocks terrain advantages.

## Technical Direction

- **Platform**: PlayCanvas (under evaluation - web-based, JS/TS, good for multiplayer)
- **Scripting**: Lua for unit DNA/blueprints (embeddable, inspectable, stealable)
- **Map**: Procedural generation - mountains, trees, water, resources, roads/paths
- **Players**: 2 (Michael + Dave, each with their own LLM advisor)

## Players / Stakeholders

- Michael (@mchampanis) - co-lead, Windows dev environment
- Dave (@ahoydave) - co-lead, macOS dev environment
- Claude - LLM advisor in-game AND development partner

## Collaboration Setup

- **Repo**: git@github.com:mchampanis/hallucinationwars.git
- **IDE**: VS Code with Live Share for pairing
- **Comms**: Discord `#github-hw` channel (GitHub webhook active)
- **Platforms**: Windows (Michael) + macOS (Dave)
- **Discord bot**: Cortex (separate repo) - live updates between developers and their Claudes

## Open Questions

- Is PlayCanvas the right choice? Need to evaluate multiplayer support, Lua embedding, physics engine quality.
- How exactly does the token economy work mechanically? Starting pool, earn rate, steal mechanics.
- How does the LLM integration actually work at runtime? API calls from game client? Server-side?
- What's the prep phase time limit? Fixed timer, resource threshold, player-triggered?
- How do we prevent one player from just hoarding and never fighting?
- Networking architecture - peer-to-peer or dedicated server?
- How do we sandbox Lua execution for safety?
