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

### Open Questions

- **Token generation**: How do players earn tokens? Is it passive (time-based), active (mining a specific resource), or achievement-based (holding territory, winning skirmishes)?
- **Token theft**: How does stealing work? Raid enemy base? Loot from defeated units? Intercept/jam their LLM calls?
- **Model tiers**: How many tiers? Two (small/large) or a spectrum? Do we use real model tiers (haiku/sonnet/opus) or abstract them?
- **Context as resource**: If context window is token-gated, how does the player/LLM choose what to remember and what to forget? Can you "load" specific memories by spending tokens?
- **Information leakage**: Should spending a lot of tokens on a single call be detectable by the opponent? (e.g. "enemy is thinking hard about something" as an intel signal)
- **Anti-snowball**: How do we prevent the token-rich player from running away with the game? Diminishing returns? Expensive upkeep on complex units?
- **Dumb physics budget**: Should some token budget be reserved for the physics engine itself, so a token-starved player's units literally move worse or have jankier physics?

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
