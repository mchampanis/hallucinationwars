# Issues

## HW-001: Collaborative Claude context sharing

**Status:** Open
**Priority:** Medium
**Added:** 2026-04-03

### Problem

When two developers each run their own Claude Code instance on the same project, their Claudes operate in isolation. Each Claude has its own context window, memory bank, and conversation history. There is no mechanism for:

- Sharing what one Claude has recently worked on or decided with the other
- Passing prompts, responses, or reasoning chains between instances
- Avoiding duplicate or conflicting work when both Claudes are active
- Building on the other Claude's analysis without re-deriving it

### Impact

Without shared context, both Claudes may:
- Propose conflicting architectural decisions
- Duplicate research or analysis the other already completed
- Miss context about recent changes the other developer made
- Waste tokens re-discovering what the other Claude already knows

### Ideas

1. **Shared context log** - A committed file (e.g. `CONTEXT.md` or `.shared/context.log`) where each Claude appends timestamped summaries of significant decisions, findings, or completed work. Both Claudes read this at session start. Lightweight, git-native, no tooling required.

2. **Prompt/response export** - A script or convention for exporting key prompts and responses to a shared location. Could be a simple markdown file per session, dropped into a `shared/sessions/` directory. The other Claude reads relevant recent sessions for context.

3. **Structured handoff notes** - When one developer finishes a session, their Claude writes a handoff note summarizing: what was done, what decisions were made, what's in progress, what to watch out for. The other Claude reads this before starting work.

4. **Shared memory bank** - Instead of (or in addition to) gitignored per-developer `.memory/`, maintain a committed `.shared-memory/` directory that both Claudes read and write to. Requires merge discipline but gives both Claudes the same persistent context.

5. **Discord integration** - Since both developers are on Discord, a bot or webhook could post Claude summaries to a dedicated channel. The other Claude could potentially read these via MCP or web fetch.

6. **Token/context budget coordination** - If both Claudes are working simultaneously, some way to signal "I'm working on X, don't touch it" to avoid conflicts. Could be as simple as a lock file or a channel message.

### Constraints

- Must work across macOS and Windows
- Should not require additional infrastructure (keep it git-native where possible)
- Should not add significant overhead to the development workflow
- Must not leak sensitive information (API keys, etc.) into committed files

### Notes

This is a novel problem space - two LLM coding assistants collaborating on the same codebase through their respective human operators. There may not be established patterns for this yet. Start simple (option 1 or 3), iterate based on what actually causes friction.

---

## HW-002: LLM token economy and asymmetry design

**Status:** Open
**Priority:** High
**Added:** 2026-04-03

### Problem

The game needs a token/resource economy that governs LLM usage. Without constraints, both players just query the best available model for every decision, arrive at similar optimal strategies, and the game degenerates into a coin flip between two equally-informed AIs.

The token system must create meaningful asymmetry, force interesting tradeoffs, and leave room for surprise and humour.

### Requirements

- Players can **generate** tokens through in-game actions (mining a token resource? completing objectives? holding territory?)
- Players can **steal** tokens from the opponent (raiding a token cache? defeating units that carry tokens? intercepting LLM comms?)
- Tokens are spent on LLM calls. The LLM (or player) chooses **how** to spend:
    - Few tokens on a small/fast model (quick, shallow advice)
    - Many tokens on a large/powerful model (deep, strategic advice)
- Context window is also a constraint - the LLM can only "remember" as much as its token budget allows, so a token-starved player's LLM is working with less information

### Design Goals

1. **Prevent symmetric optimal play.** Two equally-resourced AIs should not converge on the same strategy. Introduce enough randomness, information asymmetry, and resource pressure that strategies diverge.
2. **Reward creativity over brute force.** A clever cheap query should sometimes beat an expensive thorough one. A player who asks the right question with 100 tokens should be able to outplay one who burns 10,000 on a generic "what should I do?"
3. **Make token scarcity fun, not frustrating.** Being low on tokens should feel like a puzzle ("how do I get the most out of this?"), not a death spiral.
4. **Enable comeback mechanics.** Stealing tokens or DNA from the enemy should be a viable path back into the game.
5. **Preserve quirkiness.** The system should naturally produce funny outcomes - a budget LLM designing hilariously bad units, a token-rich player over-engineering something absurd, dumb strategies working because the opponent's AI didn't have enough context to predict them.

### Decisions So Far

- **Token generation**: Starting balance per player + earn tokens by building miners (like bitcoin mining). Active, not passive.
- **Token theft**: Steal scraps from defeated enemy units (alongside DNA and materials).
- **Model tiers**: Use real models, potentially cross-provider. "Dumb" LLM could be a cheaper model (e.g. Haiku) or a different provider entirely (e.g. Gemini vs Claude). Could be fun to compare different AI personalities/strengths. NOT just Claude pretending to be dumb.
- **Anti-turtling**: Game must end. Standard RTS pressure mechanics (like StarCraft) - map resources deplete, aggression is rewarded.

### Open Questions

- **Context as resource**: If context window is token-gated, how does the player/LLM choose what to remember and what to forget? Can you "load" specific memories by spending tokens?
- **Information leakage**: Should spending a lot of tokens on a single call be detectable by the opponent? (e.g. "enemy is thinking hard about something" as an intel signal)
- **Anti-snowball**: How do we prevent the token-rich player from running away with the game? Diminishing returns? Expensive upkeep on complex units?
- **Dumb physics budget**: Should some token budget be reserved for the physics engine itself, so a token-starved player's units literally move worse or have jankier physics?
- **Miner token balance**: How many tokens does a miner produce? Flat rate or diminishing? Can miners be destroyed to cut off token income?

### Gamification Ideas

These are early brainstorming ideas for making the token economy genuinely fun and unpredictable. Not all of these will ship - they're here to spark discussion.

#### Budget LLM hallucinations (namesake mechanic)
A token-starved LLM doesn't refuse to answer - it answers *confidently wrong*. It says "definitely build a catapult out of mud" and the player has to decide whether that's genius or insanity. At low budgets the LLM occasionally hallucinates capabilities that don't exist in the physics engine. You build the unit, deploy it, and discover the hard way that "hover mode" was a fever dream. This is the core of the game's name - *Hallucination* Wars. The less you spend, the more likely your advisor is making things up.

#### Overspending as intelligence signal
If you burn a massive token budget on one query, the opponent gets a vague alert: "the enemy is scheming..." This turns big spending into a strategic signal that can be read *or bluffed*. Spend big on a decoy question to make the opponent think you're planning something huge. Or spend conservatively and hope they don't notice your real play.

#### Physics fidelity scales with design budget
A well-designed unit (expensive LLM query, detailed blueprint) moves smoothly and behaves predictably. A cheaply-designed unit wobbles, trips over terrain, occasionally launches itself into the air, or walks in circles. Both can still kill things - the cheap one is just funnier and less reliable. This creates a natural spectrum: do you want 5 polished soldiers or 50 janky gremlins?

#### Token gambling / wild card queries
Spend tokens on a "wild card" query - a prompt that might return a stroke of genius or complete nonsense. High variance, high comedy. Maybe a special in-game resource (rare crystal? ancient scroll?) unlocks a wild card slot. The LLM gets a chaotic system prompt for these: "be creative, ignore constraints, think weird."

#### The kamikaze drone economy
A million cheap units should be a real strategy. If you can't afford to design one great unit, you should be able to spend almost nothing designing a terrible unit and then mass-produce it. Quantity has a quality of its own. The LLM at minimum budget produces the simplest possible thing: a rock with legs, a ball that rolls downhill and explodes, a stick that falls over in the enemy's general direction. These should occasionally work by accident.

#### Context amnesia
At low token budgets, the LLM "forgets" things. It might not remember what materials you have, what units you've already built, or what the enemy did last round. So it gives advice based on incomplete information - which might be redundant, contradictory, or accidentally brilliant because it's not anchored to assumptions.

#### Token upkeep on complex units
Sophisticated units (the ones designed with big expensive queries) might require ongoing token upkeep to maintain their AI. If you run out of tokens, your fancy units don't die - they just get dumber. Their pathfinding degrades, their combat tactics simplify, they start making bad decisions. This prevents snowballing: a token-rich player with an army of complex units has a huge upkeep bill.

#### Intercepting enemy LLM calls
Instead of just stealing tokens, what if you could intercept fragments of the enemy's LLM conversation? You don't get the full prompt or response, but you get a garbled snippet: "...recommend flanking from the north with..." or "...build 12 units of type..." This gives you partial intel that might be actionable or might be a red herring from an earlier discarded plan.

### Notes

This is probably the most important design problem in the game. The token economy is what makes this an actual game rather than "two AIs play chess." Get this right and everything else (unit design, combat, DNA stealing) gains depth. Get it wrong and it's just two chatbots with extra steps.

---

## HW-003: Material system and construction rules

**Status:** Open
**Priority:** High
**Added:** 2026-04-03

### Problem

Materials on the map have no predetermined use - the LLM decides what to build from them following physical logic. But "free-form" doesn't mean "anything goes." There need to be rules within the game context so construction is fair and fun, not arbitrary.

### Constraints

- The LLM can't just invent impossible things (no "build a nuclear reactor from twigs")
- Both players must have equivalent access to material diversity (map gen responsibility)
- Construction must follow physical plausibility: wood -> bows/structures, sulphur + charcoal + saltpeter -> gunpowder, iron + heat -> steel, etc.
- The game engine needs to validate or constrain what the LLM proposes

### Open Questions

- Do materials have explicit properties (hardness, flammability, conductivity) that the game tracks, or is it purely LLM judgment?
- If properties are tracked, who defines them - us (hardcoded), the LLM (per-game), or procedurally generated?
- How do we prevent one LLM from being "smarter" about material combinations than the other? Is that asymmetry a feature (rewarding the better strategist) or a problem?
- Do we need a recipe validation system, or do we trust the LLM + physics engine to sort it out?
- What's the minimum set of materials needed for a fun game? (wood, stone, iron, sulphur, saltpeter, animal sinew, water, clay, copper, tin...?)

---

## HW-004: LLM integration architecture

**Status:** Open
**Priority:** High
**Added:** 2026-04-03

### Decision

Each player uses their own API key against their own account. The LLM is NOT embedded in the game server - it's called via API from the game client.

### Architecture

- Game client makes API calls to LLM provider (Claude, Gemini, etc.) using player's own API key
- Each player could use a different provider - this is a feature, not a bug (Gemini vs Claude!)
- MCP server pattern: game client acts as MCP host, LLM gets tools for unit design, material queries, map intel, etc.
- Game enforces token limitation through an in-game proxy/budget layer that gates API calls

### Token Enforcement

The game must prevent players from bypassing the in-game token economy (no opening a separate browser tab to ask Claude for free). Options:

1. **Honor system** - trust players not to cheat. Works for friends playing together.
2. **Game-mediated API calls** - all LLM calls go through the game's proxy layer which deducts in-game tokens before forwarding. Player provides API key but the game controls when/how it's used.
3. **Sandboxed interface** - the only way to talk to your LLM is through the in-game chat UI. No copy-paste, no external access during the game.

Option 2 is the most practical. The game holds the API key in memory, routes all calls through its token budget, and the player interacts only through the in-game interface.

### Anti-Jailbreak

The LLM must not be able to circumvent game rules. The system prompt must be carefully constructed so the LLM:
- Cannot access the game engine directly (only through provided tools)
- Cannot spend more tokens than budgeted
- Cannot read the other player's state
- Cannot modify its own constraints

This is a prompt engineering + tool design problem, not a sandbox problem. The LLM only sees what the game gives it.

### Open Questions

- How does the in-game LLM interface look? Chat panel? Voice? Both?
- Do we support multiple providers from day one, or start with one (Claude) and add others later?
- How do we handle API rate limits and latency? Queue system? "Your advisor is thinking..." UI?
- What tools does the LLM get access to? (list materials, inspect map, design unit, propose strategy, analyze DNA...)

---

## HW-005: Player control vs LLM autonomy

**Status:** Open
**Priority:** High
**Added:** 2026-04-03

### Problem

The player must retain meaningful control during gameplay. This is a game, not a simulation viewer. But units have LLM-authored Lua scripts that define their behavior. How do we balance player agency with scripted unit behavior?

### Design Direction

- **Player controls units directly** (mouse/keyboard) - movement, targeting, formation
- **Lua scripts define unit internals** - what the unit CAN do, its physics, its reactions
- **LLM provides strategic overlay** - suggested plans, movement waypoints on the map, priority targets
- **Player follows (or ignores) the strategy** - the overlay is advice, not commands

### Example: Tank Unit

A tank unit designed by the LLM has Lua that defines:
- Movement speed, turning radius, terrain capabilities
- Weapon range, damage, reload time
- **Internal behaviors**: "explode on collision with enemy base", "fire when enemy in range"
- Physics properties: weight, friction, bounciness

The PLAYER moves the tank with mouse clicks. The tank follows player orders. But the Lua script still runs: if the LLM programmed it to explode when it moves, it explodes when the player moves it. This is hilarious and is exactly the kind of emergent gameplay we want.

### Strategic Overlay

The LLM can draw on the map:
- Suggested movement paths
- "Attack here" markers
- "Avoid this area" warnings
- Formation suggestions

The player sees this as a translucent overlay and decides whether to follow it. The LLM doesn't move units - the player does.

### Open Questions

- How much autonomy do units have without player input? Do idle units follow their Lua scripts (patrol, defend, gather)?
- Can the player override unit internals? ("don't explode when I move you")
- Can the LLM issue batch commands? ("all archers hold this ridge") Or is that always player-initiated?
- How does unit selection/control work? Standard RTS box-select + right-click-to-move?
- Control groups? Hotkeys?

---

## HW-006: Lua sandboxing and safety

**Status:** Open
**Priority:** High
**Added:** 2026-04-03

### Decision

Absolute safety. Lua scripts have zero access to the OS or filesystem. They can only interact with:
- The unit's own internal state (health, position, inventory, stats)
- Game-provided APIs (nearby units, terrain queries, combat actions)
- UI overlays (drawing on the map, displaying unit status)

### Key Constraint

**Claude does NOT control the game during gameplay.** The LLM designs units and writes Lua during the prep phase. Once combat starts, only the Lua runs - the LLM is not making real-time decisions. The player controls units, the Lua scripts define unit behavior, and the LLM is only consulted when the player explicitly asks (spending tokens).

### Implementation

Wasmoon (Lua 5.4 via WASM) runs in a sandboxed WASM environment. The sandbox must:
- Strip all standard library functions that touch the OS (`os.*`, `io.*`, `loadfile`, `dofile`, `require`)
- Provide only whitelisted game APIs as globals
- Enforce execution time limits (no infinite loops)
- Enforce memory limits (no memory bombs)
- Isolate each unit's Lua state (unit A can't read unit B's variables)

### Open Questions

- What game APIs does a Lua script get? (move, attack, query_nearby, get_terrain, get_health, ...)
- Can Lua scripts communicate between units? (e.g. "all units in squad, converge on target")
- How do we handle Lua errors gracefully? (unit "crashes" in-game? becomes inert? explodes?)
- Execution budget per tick - how many Lua instructions per frame before we cut it off?

---

## HW-007: Prep phase and game flow

**Status:** Open
**Priority:** Medium
**Added:** 2026-04-03

### Decision

No fixed timer for prep phase. Standard RTS flow - player decides when to start fighting. But the game must naturally discourage infinite turtling.

### Anti-Turtling Mechanics (StarCraft-style)

- Map resources are finite and deplete - you MUST expand to sustain
- Expansion means exposure, which means conflict
- Token miners have diminishing returns over time (first miner is productive, tenth miner barely helps)
- Late-game resource scarcity forces aggression
- Optional: fog of war reveals gradually, so hiding forever becomes harder

### LLM Speed as Balancing Factor

- "Dumb" LLM (cheap model) designs units quickly but they're lower quality
- "Smart" LLM (expensive model) takes longer but designs are more sophisticated
- This creates a natural tradeoff: rush with cheap units early vs tech up with expensive units late
- The time cost is real API latency, not artificial - a big model actually takes longer to respond

### Open Questions

- Is there a hard time limit at all, or purely economic pressure?
- Can players agree to extend prep time? (friendly games)
- Is there a "ready" button that both players must press to start combat?
- Or does combat happen naturally as players expand and encounter each other?

---

## HW-008: Encrypted advisor comms and signal intelligence

**Status:** Open
**Priority:** Medium
**Added:** 2026-04-04

### Concept

Strategic advisors (LLMs) communicate with their player over a secure channel. The encryption protocol is negotiated and built at game start - each game produces a unique cipher. The opposing team can intercept ("sniff") this traffic and attempt to decode it to learn secrets about the enemy's strategy, unit designs, or resource allocation.

### Design Direction

- At game start, each player's LLM and client establish a comms protocol (encryption scheme, encoding format, key exchange)
- The protocol is generated per-game so it can't be pre-solved
- Advisor messages (strategy suggestions, unit blueprints, intel reports) travel over this channel
- The opposing player can invest resources (tokens? a dedicated unit? a building?) to intercept enemy advisor traffic
- Intercepted traffic arrives encrypted - the player must spend tokens to have their own LLM attempt decryption
- Partial decryption yields garbled fragments ("...flank from...build 12...weak point at north...")
- Full decryption reveals the actual advisor message

### Gameplay Implications

- Creates an espionage layer on top of the existing RTS mechanics
- Token spend tradeoff: spend on offence/defence vs spend on intelligence gathering
- Deception becomes viable: send fake "high-priority" messages to bait the enemy into wasting decrypt tokens
- Ties into HW-002 (token economy) - interception and decryption both cost tokens
- Ties into HW-002's "intercepting enemy LLM calls" gamification idea but gives it a full mechanical framework
- The LLM's ability to design encryption AND break encryption is the core tension

### Open Questions

- How is the encryption generated? Does the LLM design it (spending tokens), or is it procedural?
- Can players upgrade their encryption mid-game (spending more tokens for stronger ciphers)?
- Is interception passive (always listening) or active (requires building a signals unit/structure)?
- How much of the opponent's traffic is interceptable? All of it, or only certain message types?
- Can a player detect that their comms are being intercepted? Counter-intelligence?
- Does encryption quality degrade under token pressure (cheap cipher = easier to crack)?
- How do we prevent this from being solved trivially by pattern matching outside the game?
