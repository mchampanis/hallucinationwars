# Lua Unit Behavior System — Design Spec

**Date:** 2026-04-05  
**Status:** Approved

## Overview

Each unit runs its own Lua script (Lua 5.4 via Wasmoon) that is called every game tick. The script reads sensors (position, heading, move command) and writes actuators (thrust, steer). The engine integrates those outputs into world movement. User commands arrive as data the script can read — the script decides what to do with them.

This separates world rules (engine) from unit decisions (Lua), allowing both to evolve independently.

## Movement Model

The current direct-teleport model is replaced with a script-driven one.

**Constants (engine-owned):**
- `MAX_SPEED = 8` units/sec
- `MAX_TURN_RATE = 2.5` rad/sec

**Each frame, per unit:**
1. Run the unit's Lua `tick(self, dt)` function
2. Read `self.thrust` and `self.steer` back from the Lua environment
3. Update `unit.yaw += steer * MAX_TURN_RATE * dt`
4. Move position forward along new yaw by `thrust * MAX_SPEED * dt`
5. Terrain passability check — if blocked, don't move

`unit.target` is replaced by `unit.moveCommand: {x: number, z: number} | null`, set by right-click. The script reads this and clears it (sets thrust/steer to 0) when it arrives.

## Lua Runtime Architecture

- **One shared Wasmoon LuaEngine** for all units (not one per unit — avoids ~2-4MB WASM cost per instance)
- **Per-unit Lua environment table** — each unit's `tick` function runs in its own sandboxed Lua table, giving full isolation without separate VMs
- **Available stdlib:** `math`, `table`, `string` only — `io`, `os`, `require`, `load`, `dofile` are removed from the sandbox

## Lua API

The engine constructs a `self` table and passes it into `tick(self, dt)` each frame.

**Sensors (read by script):**
```lua
self.x, self.z       -- world position (numbers)
self.yaw             -- heading in radians (0 = +Z, pi/2 = +X)
self.target_x        -- move command destination (nil if no command)
self.target_z        -- move command destination (nil if no command)
```

**Actuators (written by script):**
```lua
self.thrust          -- forward speed [-1, 1], clamped by engine
self.steer           -- turn rate [-1, 1], clamped by engine
```

## Default Move-To Script

Every unit starts with this script. It steers toward the move command target and throttles based on heading alignment.

```lua
function tick(self, dt)
  if self.target_x == nil then
    self.thrust = 0
    self.steer = 0
    return
  end

  local dx = self.target_x - self.x
  local dz = self.target_z - self.z
  local dist = math.sqrt(dx * dx + dz * dz)

  if dist < 0.5 then
    self.thrust = 0
    self.steer = 0
    return
  end

  local desired_yaw = math.atan(dx, dz)
  local angle_diff = desired_yaw - self.yaw
  while angle_diff >  math.pi do angle_diff = angle_diff - 2 * math.pi end
  while angle_diff < -math.pi do angle_diff = angle_diff + 2 * math.pi end

  self.steer  = math.max(-1, math.min(1, angle_diff * 2))
  self.thrust = math.max(0, math.cos(angle_diff))
end
```

## Error Handling

- Every `tick` call is wrapped in `pcall` — script errors never propagate to the engine
- Each unit stores `errorLog: string[]` (capped at 20 entries)
- Errors are shown in the selection panel when a single unit is selected (red text)
- The script editor also shows the error log
- A unit with a broken script simply applies `thrust = 0, steer = 0` (stays still)

## Code Editor

A modal overlay for editing a unit's Lua script.

**Trigger:** Press `E` with exactly one unit selected, or click an "Edit Script" button in the selection panel.

**Contents:**
- Header: unit name
- `<textarea>` — monospace font, dark theme, fills the modal
- Error log section — shows recent errors from the unit (empty if clean)
- **Apply** button — compiles the script; on success installs it on the unit; on failure shows the Lua compile error inline
- **Reset** button — restores the default move-to script
- **Close / Escape** — closes without applying

**Ownership:** A `ScriptEditorModal` class manages the modal HTML. `UIOverlay` owns an instance and opens/closes it.

**Game state during edit:** The game continues running. The unit executes its current (pre-edit) script until Apply is pressed.

## New TypeScript Interfaces

```typescript
// Added to Unit:
moveCommand: { x: number; z: number } | null;  // replaces target
luaScript: string;                               // current script source
errorLog: string[];                              // recent runtime errors

// New class:
class LuaBehaviorEngine {
  // Owns the shared Wasmoon LuaEngine
  // compile(source: string): LuaEnv | Error
  // tick(env: LuaEnv, self: UnitSensors, dt: number): UnitActuators
}
```

## Files Affected

- `src/units.ts` — replace `target` with `moveCommand`, add `luaScript`/`errorLog`, integrate `LuaBehaviorEngine` into `updateUnit`
- `src/lua-behavior.ts` — new file, owns the Wasmoon engine and per-unit sandboxes
- `src/ui.ts` — show errors in selection panel, add "Edit Script" button, own `ScriptEditorModal`
- `src/script-editor.ts` — new file, the modal component
- `src/input.ts` — `E` key opens editor for selected unit; right-click sets `moveCommand` instead of `target`
- `package.json` — add `wasmoon` dependency
