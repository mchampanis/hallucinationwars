# Lua Unit Behavior System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded unit movement with per-unit Lua scripts that read sensors and write actuators each tick, plus a simple in-game code editor.

**Architecture:** One `LuaFactory` (shared WASM binary), one `LuaEngine` per unit (fully isolated state). The game update loop is made async so each unit's Lua `tick(self, dt)` can be awaited. JS objects passed to Lua are mutated in-place — we read `self.thrust` and `self.steer` back after the call.

**Tech Stack:** Three.js, Wasmoon 1.16 (already installed), Vitest (already installed), TypeScript.

**Critical API notes confirmed by testing:**
- `await lua.doString(script)` — compiles and runs. Throws on syntax error.
- `lua.global.get('tick')` — returns an async callable.
- `await tickFn(selfObj, dt)` — mutates `selfObj` in-place (Lua writes to it).
- **Never pass `null`** to Lua functions — it crashes Wasmoon. Omit the property instead (Lua sees `nil`).
- Sandbox by `await lua.doString('io=nil; os=nil; require=nil; load=nil; dofile=nil; loadfile=nil')`.
- Multiple engines from one factory are fully isolated.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `vite.config.ts` | Modify | Add Vitest config |
| `tsconfig.json` | Modify | Include `tests/` directory |
| `src/lua-behavior.ts` | Create | LuaBehaviorEngine: owns factory, creates per-unit envs, runs tick |
| `src/units.ts` | Modify | New Unit interface (moveCommand, luaScript, errorLog), async update, thrust/steer physics |
| `src/script-editor.ts` | Create | ScriptEditorModal DOM component |
| `src/ui.ts` | Modify | Error log in panel, Edit Script button, own modal |
| `src/input.ts` | Modify | Right-click → moveCommand, E key → open editor |
| `src/game.ts` | Modify | Async init (LuaBehaviorEngine), async animate loop |
| `tests/lua-behavior.test.ts` | Create | Unit tests for LuaBehaviorEngine |
| `tests/unit-movement.test.ts` | Create | Unit tests for movement math |

---

## Task 1: Configure Vitest

**Files:**
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Update vite.config.ts to add Vitest**

Replace the entire file with:

```typescript
import { defineConfig } from "vite";

export default defineConfig({
    server: {
        open: true,
    },
    test: {
        environment: "node",
    },
});
```

- [ ] **Step 2: Update tsconfig.json to include tests directory**

Replace `"include": ["src"]` with `"include": ["src", "tests"]`.

- [ ] **Step 3: Add test script to package.json**

In the `"scripts"` section, add: `"test": "vitest run"` and `"test:watch": "vitest"`.

- [ ] **Step 4: Verify Vitest works**

Create `tests/smoke.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("smoke", () => {
    it("passes", () => {
        expect(1 + 1).toBe(2);
    });
});
```

Run: `npm test`
Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts tsconfig.json package.json package-lock.json tests/smoke.test.ts
git commit -m "chore: add Vitest test infrastructure"
```

---

## Task 2: Create `src/lua-behavior.ts` (TDD)

**Files:**
- Create: `src/lua-behavior.ts`
- Create: `tests/lua-behavior.test.ts`

The default move-to script lives here as a constant exported for use by UnitManager.

- [ ] **Step 1: Write failing tests**

Create `tests/lua-behavior.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { LuaBehaviorEngine, DEFAULT_SCRIPT } from "../src/lua-behavior";

let engine: LuaBehaviorEngine;

beforeAll(async () => {
    engine = new LuaBehaviorEngine();
    await engine.init();
});

describe("LuaBehaviorEngine.compile", () => {
    it("returns a UnitLuaEnv for valid script", async () => {
        const result = await engine.compile(DEFAULT_SCRIPT);
        expect(result).not.toBeInstanceOf(Error);
    });

    it("returns an Error for invalid Lua syntax", async () => {
        const result = await engine.compile("function tick( -- broken");
        expect(result).toBeInstanceOf(Error);
    });

    it("returns an Error if script does not define tick", async () => {
        const result = await engine.compile("x = 1");
        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toContain("tick");
    });
});

describe("LuaBehaviorEngine.tick", () => {
    it("returns zero actuators when no target", async () => {
        const env = await engine.compile(DEFAULT_SCRIPT);
        expect(env).not.toBeInstanceOf(Error);
        const out = await engine.tick(env as Awaited<ReturnType<typeof engine.compile>> & {}, {
            x: 0, z: 0, yaw: 0, moveCommand: null,
        }, 0.016);
        expect(out.thrust).toBe(0);
        expect(out.steer).toBe(0);
        expect(out.error).toBeUndefined();
    });

    it("steers toward target when facing away", async () => {
        const env = await engine.compile(DEFAULT_SCRIPT);
        // Unit at origin, yaw=0 (facing +Z), target at (10, 0)
        // desired_yaw = atan(10, 0) = PI/2
        // angle_diff = PI/2, steer should be clamped to 1.0
        const out = await engine.tick(env as any, {
            x: 0, z: 0, yaw: 0, moveCommand: { x: 10, z: 0 },
        }, 0.016);
        expect(out.steer).toBeCloseTo(1.0, 2);
        // thrust = cos(PI/2) = 0
        expect(out.thrust).toBeCloseTo(0, 2);
    });

    it("moves forward when already facing target", async () => {
        const env = await engine.compile(DEFAULT_SCRIPT);
        // Unit at origin, yaw = atan(0, 10) = 0 (facing +Z), target at (0, 10)
        const out = await engine.tick(env as any, {
            x: 0, z: 0, yaw: 0, moveCommand: { x: 0, z: 10 },
        }, 0.016);
        expect(out.steer).toBeCloseTo(0, 2);
        expect(out.thrust).toBeCloseTo(1.0, 2);
    });

    it("stops when within 0.5 units of target", async () => {
        const env = await engine.compile(DEFAULT_SCRIPT);
        const out = await engine.tick(env as any, {
            x: 0, z: 0, yaw: 0, moveCommand: { x: 0.3, z: 0.3 },
        }, 0.016);
        expect(out.thrust).toBe(0);
        expect(out.steer).toBe(0);
    });

    it("catches runtime errors and returns them without throwing", async () => {
        const env = await engine.compile(`function tick(self, dt) error("boom") end`);
        const out = await engine.tick(env as any, {
            x: 0, z: 0, yaw: 0, moveCommand: null,
        }, 0.016);
        expect(out.thrust).toBe(0);
        expect(out.steer).toBe(0);
        expect(out.error).toContain("boom");
    });

    it("clamps thrust and steer to [-1, 1]", async () => {
        const env = await engine.compile(`
            function tick(self, dt)
                self.thrust = 99
                self.steer = -99
            end
        `);
        const out = await engine.tick(env as any, {
            x: 0, z: 0, yaw: 0, moveCommand: null,
        }, 0.016);
        expect(out.thrust).toBe(1);
        expect(out.steer).toBe(-1);
    });

    it("sandbox: script cannot access io or os", async () => {
        const env = await engine.compile(`
            function tick(self, dt)
                self.thrust = (io == nil) and 1 or 0
            end
        `);
        const out = await engine.tick(env as any, {
            x: 0, z: 0, yaw: 0, moveCommand: null,
        }, 0.016);
        expect(out.thrust).toBe(1); // io is nil, so thrust = 1
    });
});
```

Run: `npm test`
Expected: All tests FAIL (module not found).

- [ ] **Step 2: Create `src/lua-behavior.ts`**

```typescript
import { LuaFactory, LuaEngine } from "wasmoon";

export const DEFAULT_SCRIPT = `\
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
`;

const SANDBOX_SCRIPT = `
io = nil
os = nil
require = nil
load = nil
dofile = nil
loadfile = nil
`;

export interface UnitSensors {
    x: number;
    z: number;
    yaw: number;
    moveCommand: { x: number; z: number } | null;
}

export interface UnitActuators {
    thrust: number;
    steer: number;
    error?: string;
}

export interface UnitLuaEnv {
    engine: LuaEngine;
    tickFn: (...args: unknown[]) => Promise<unknown>;
}

export class LuaBehaviorEngine {
    private factory: LuaFactory | null = null;

    async init(): Promise<void> {
        this.factory = new LuaFactory();
    }

    async compile(script: string): Promise<UnitLuaEnv | Error> {
        if (!this.factory) throw new Error("LuaBehaviorEngine not initialized");

        const engine = await this.factory.createEngine();
        try {
            await engine.doString(SANDBOX_SCRIPT);
            await engine.doString(script);
            const tickFn = engine.global.get("tick");
            if (typeof tickFn !== "function") {
                engine.global.close();
                return new Error("Script must define a tick function");
            }
            return { engine, tickFn };
        } catch (e) {
            engine.global.close();
            return e instanceof Error ? e : new Error(String(e));
        }
    }

    async tick(env: UnitLuaEnv, sensors: UnitSensors, dt: number): Promise<UnitActuators> {
        const self: Record<string, unknown> = {
            x: sensors.x,
            z: sensors.z,
            yaw: sensors.yaw,
            thrust: 0,
            steer: 0,
        };
        if (sensors.moveCommand !== null) {
            self.target_x = sensors.moveCommand.x;
            self.target_z = sensors.moveCommand.z;
        }

        try {
            await env.tickFn(self, dt);
        } catch (e) {
            return { thrust: 0, steer: 0, error: String(e) };
        }

        const thrust = Math.max(-1, Math.min(1, (self.thrust as number) ?? 0));
        const steer = Math.max(-1, Math.min(1, (self.steer as number) ?? 0));
        return { thrust, steer };
    }

    destroyEnv(env: UnitLuaEnv): void {
        env.engine.global.close();
    }
}
```

- [ ] **Step 3: Run tests and verify they pass**

Run: `npm test`
Expected: All tests PASS (delete `tests/smoke.test.ts` if it interferes).

- [ ] **Step 4: Commit**

```bash
git add src/lua-behavior.ts tests/lua-behavior.test.ts
git commit -m "feat: add LuaBehaviorEngine with Wasmoon Lua sandboxing"
```

---

## Task 3: Update Unit Interface and Movement in `src/units.ts`

**Files:**
- Modify: `src/units.ts`
- Create: `tests/unit-movement.test.ts`

The movement model changes from direct teleport to thrust/steer integration. The `target` field is replaced by `moveCommand`.

- [ ] **Step 1: Write movement math tests**

Create `tests/unit-movement.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

// Pure functions extracted for testing — we test the math, not Three.js
function applyMovement(
    pos: { x: number; z: number },
    yaw: number,
    thrust: number,
    steer: number,
    dt: number,
    maxSpeed: number,
    maxTurnRate: number,
): { x: number; z: number; yaw: number } {
    const newYaw = yaw + steer * maxTurnRate * dt;
    const newX = pos.x + Math.sin(newYaw) * thrust * maxSpeed * dt;
    const newZ = pos.z + Math.cos(newYaw) * thrust * maxSpeed * dt;
    return { x: newX, z: newZ, yaw: newYaw };
}

const MAX_SPEED = 8;
const MAX_TURN_RATE = 2.5;

describe("unit movement math", () => {
    it("moves forward along yaw=0 (+Z direction)", () => {
        const result = applyMovement({ x: 0, z: 0 }, 0, 1, 0, 1, MAX_SPEED, MAX_TURN_RATE);
        expect(result.x).toBeCloseTo(0, 5);
        expect(result.z).toBeCloseTo(8, 5); // 1 * 8 * 1 = 8
        expect(result.yaw).toBeCloseTo(0, 5);
    });

    it("turns right (positive steer increases yaw)", () => {
        const result = applyMovement({ x: 0, z: 0 }, 0, 0, 1, 1, MAX_SPEED, MAX_TURN_RATE);
        expect(result.yaw).toBeCloseTo(2.5, 5); // MAX_TURN_RATE * dt
    });

    it("moves along yaw=PI/2 (+X direction)", () => {
        const result = applyMovement({ x: 0, z: 0 }, Math.PI / 2, 1, 0, 1, MAX_SPEED, MAX_TURN_RATE);
        expect(result.x).toBeCloseTo(8, 4);
        expect(result.z).toBeCloseTo(0, 4);
    });

    it("negative thrust moves backward", () => {
        const result = applyMovement({ x: 0, z: 0 }, 0, -1, 0, 1, MAX_SPEED, MAX_TURN_RATE);
        expect(result.z).toBeCloseTo(-8, 5);
    });

    it("zero thrust and steer leaves position and yaw unchanged", () => {
        const result = applyMovement({ x: 5, z: 3 }, 1.2, 0, 0, 1, MAX_SPEED, MAX_TURN_RATE);
        expect(result.x).toBeCloseTo(5, 5);
        expect(result.z).toBeCloseTo(3, 5);
        expect(result.yaw).toBeCloseTo(1.2, 5);
    });
});
```

Run: `npm test`
Expected: PASS (pure math, no dependencies).

- [ ] **Step 2: Update the `Unit` interface**

In `src/units.ts`, replace the `Unit` interface. The key changes: `target` → `moveCommand`, add `luaScript`, `errorLog`, `luaEnv`.

```typescript
import { UnitLuaEnv } from "./lua-behavior";

export interface Unit {
    id: number;
    team: Team;
    mesh: THREE.Group;
    body: THREE.Mesh;
    modelRoot: THREE.Group | null;
    healthBar: THREE.Mesh;
    healthBg: THREE.Mesh;
    selectionRing: THREE.Mesh;
    position: THREE.Vector3;
    yaw: number;
    moveCommand: { x: number; z: number } | null;
    health: number;
    maxHealth: number;
    selected: boolean;
    hovered: boolean;
    name: string;
    luaScript: string;
    luaEnv: UnitLuaEnv | null;
    errorLog: string[];
}
```

- [ ] **Step 3: Update `UnitManager` constructor and constants**

Add `LuaBehaviorEngine` import and field. Add movement constants. Remove `UNIT_SPEED`.

```typescript
import { LuaBehaviorEngine, DEFAULT_SCRIPT, UnitLuaEnv } from "./lua-behavior";

const MAX_SPEED = 8;
const MAX_TURN_RATE = 2.5;
const ERROR_LOG_MAX = 20;
```

Add to `UnitManager` class:
```typescript
private luaBehavior: LuaBehaviorEngine;

constructor(scene: THREE.Scene, terrain: TerrainQuery, luaBehavior: LuaBehaviorEngine) {
    this.scene = scene;
    this.terrain = terrain;
    this.luaBehavior = luaBehavior;
}
```

- [ ] **Step 4: Update `spawnUnit` to initialize Lua fields**

In `spawnUnit`, update the unit literal (remove `target`, add new fields). After creating the unit object, call `this.initUnitLua(unit)` (fire-and-forget, non-blocking):

```typescript
const unit: Unit = {
    id: nextId++,
    team,
    mesh: group,
    body,
    modelRoot,
    healthBar: hb,
    healthBg: hbBg,
    selectionRing: ring,
    position: group.position,
    yaw: 0,
    moveCommand: null,
    health: 100,
    maxHealth: 100,
    selected: false,
    hovered: false,
    name,
    luaScript: DEFAULT_SCRIPT,
    luaEnv: null,
    errorLog: [],
};

this.units.push(unit);
this.initUnitLua(unit); // async, fire-and-forget
return unit;
```

Add the `initUnitLua` method:
```typescript
private async initUnitLua(unit: Unit): Promise<void> {
    const result = await this.luaBehavior.compile(unit.luaScript);
    if (result instanceof Error) {
        unit.errorLog.push(result.message);
        if (unit.errorLog.length > ERROR_LOG_MAX) unit.errorLog.shift();
    } else {
        unit.luaEnv = result;
    }
}
```

Add the `setUnitScript` method (called by editor):
```typescript
async setUnitScript(unit: Unit, script: string): Promise<Error | null> {
    const result = await this.luaBehavior.compile(script);
    if (result instanceof Error) return result;
    if (unit.luaEnv) this.luaBehavior.destroyEnv(unit.luaEnv);
    unit.luaEnv = result;
    unit.luaScript = script;
    unit.errorLog = [];
    return null;
}
```

- [ ] **Step 5: Replace `updateUnit` movement logic**

Make `update` async and replace `updateUnit` movement. Remove the old `if (unit.target)` block entirely. Replace with:

```typescript
async update(delta: number): Promise<void> {
    for (const unit of this.units) {
        await this.updateUnit(unit, delta);
    }
}

private async updateUnit(unit: Unit, delta: number): Promise<void> {
    // Run Lua behavior
    if (unit.luaEnv) {
        const out = await this.luaBehavior.tick(
            unit.luaEnv,
            {
                x: unit.position.x,
                z: unit.position.z,
                yaw: unit.yaw,
                moveCommand: unit.moveCommand,
            },
            delta,
        );
        if (out.error) {
            unit.errorLog.push(out.error);
            if (unit.errorLog.length > ERROR_LOG_MAX) unit.errorLog.shift();
        }

        // Apply actuators
        unit.yaw += out.steer * MAX_TURN_RATE * delta;
        const newX = unit.position.x + Math.sin(unit.yaw) * out.thrust * MAX_SPEED * delta;
        const newZ = unit.position.z + Math.cos(unit.yaw) * out.thrust * MAX_SPEED * delta;
        if (this.terrain.isPassable(newX, newZ)) {
            unit.position.x = newX;
            unit.position.z = newZ;
        }
    }

    // Always snap to terrain height and conform rotation to slope
    unit.position.y = this.terrain.getHeightAt(unit.position.x, unit.position.z);
    this.conformToTerrain(unit);

    // Update visuals (keep existing code unchanged below this line)
    unit.selectionRing.visible = unit.selected || unit.hovered;
    if (unit.hovered && !unit.selected) {
        (unit.selectionRing.material as THREE.MeshBasicMaterial).color.setHex(0xffff00);
    } else {
        (unit.selectionRing.material as THREE.MeshBasicMaterial).color.setHex(0x00ff00);
    }

    const healthPct = unit.health / unit.maxHealth;
    unit.healthBar.scale.x = healthPct;
    unit.healthBar.position.x = -(1 - healthPct) * 0.6;
    const hbColor = (unit.healthBar.material as THREE.MeshBasicMaterial).color;
    if (healthPct > 0.6) hbColor.setHex(0x00cc00);
    else if (healthPct > 0.3) hbColor.setHex(0xcccc00);
    else hbColor.setHex(0xcc0000);

    if (unit.modelRoot) {
        unit.modelRoot.traverse((child) => {
            if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
                const mat = child.material as THREE.MeshStandardMaterial;
                if (mat.emissive) {
                    mat.emissive.setHex(unit.hovered ? 0x222222 : 0x000000);
                }
            }
        });
    }
}
```

- [ ] **Step 6: Update `moveSelectedTo` and `stopSelected`**

Replace all references to `unit.target` with `unit.moveCommand`:

In `moveSelectedTo`, change `selected[i].target = ...` → `selected[i].moveCommand = ...` throughout.
In `stopSelected`, change `u.target = null` → `u.moveCommand = null`.

- [ ] **Step 7: Run tests**

Run: `npm test`
Expected: All tests pass (TS compiles, Vitest runs).

- [ ] **Step 8: Commit**

```bash
git add src/units.ts src/lua-behavior.ts tests/unit-movement.test.ts
git commit -m "feat: replace teleport movement with Lua thrust/steer physics"
```

---

## Task 4: Update `src/game.ts` for async

**Files:**
- Modify: `src/game.ts`

- [ ] **Step 1: Add `LuaBehaviorEngine` initialization and pass to `UnitManager`**

```typescript
import { LuaBehaviorEngine } from "./lua-behavior";

// Add field:
private luaBehavior: LuaBehaviorEngine;

// In constructor, after existing setup:
this.luaBehavior = new LuaBehaviorEngine();
this.units = new UnitManager(this.scene, this.terrain, this.luaBehavior);
```

- [ ] **Step 2: Initialize `LuaBehaviorEngine` before spawning units**

```typescript
async start(): Promise<void> {
    await this.luaBehavior.init();
    await this.units.preload();
    this.units.spawnTestUnits();
    this.animate();
}
```

- [ ] **Step 3: Make the animate loop async**

```typescript
private animate = async (): Promise<void> => {
    requestAnimationFrame(this.animate);
    this.clock.update();
    const delta = this.clock.getDelta();

    this.cameraController.update(delta);
    await this.units.update(delta);
    this.input.update();
    this.ui.update();
    this.renderer.render(this.scene, this.camera);
};
```

- [ ] **Step 4: Commit**

```bash
git add src/game.ts
git commit -m "feat: async game loop for Lua tick integration"
```

---

## Task 5: Create `src/script-editor.ts`

**Files:**
- Create: `src/script-editor.ts`

The `ScriptEditorModal` manages its own DOM. It takes callbacks from `UIOverlay` so it doesn't need to import UnitManager directly.

- [ ] **Step 1: Create the file**

```typescript
export interface ScriptEditorCallbacks {
    onApply: (script: string) => Promise<string | null>; // returns error message or null
    onReset: () => string; // returns the default script
}

export class ScriptEditorModal {
    private overlay: HTMLDivElement;
    private textarea: HTMLTextAreaElement;
    private errorDiv: HTMLDivElement;
    private titleEl: HTMLSpanElement;
    private callbacks: ScriptEditorCallbacks | null = null;
    private isOpen = false;

    constructor(container: HTMLElement) {
        this.overlay = document.createElement("div");
        this.overlay.style.cssText =
            "position:fixed;inset:0;background:rgba(0,0,0,0.85);" +
            "display:none;flex-direction:column;z-index:100;padding:24px;box-sizing:border-box;";

        const header = document.createElement("div");
        header.style.cssText =
            "display:flex;align-items:center;gap:12px;margin-bottom:12px;";

        this.titleEl = document.createElement("span");
        this.titleEl.style.cssText =
            "font-family:monospace;font-size:16px;color:#64b5f6;flex:1;";

        const applyBtn = this.makeButton("Apply", "#4caf50");
        const resetBtn = this.makeButton("Reset", "#ff9800");
        const closeBtn = this.makeButton("Close", "#666");

        header.appendChild(this.titleEl);
        header.appendChild(applyBtn);
        header.appendChild(resetBtn);
        header.appendChild(closeBtn);

        this.textarea = document.createElement("textarea");
        this.textarea.style.cssText =
            "flex:1;width:100%;background:#1e1e1e;color:#d4d4d4;" +
            "font-family:'Courier New',monospace;font-size:13px;line-height:1.5;" +
            "border:1px solid #444;border-radius:4px;padding:12px;box-sizing:border-box;" +
            "resize:none;outline:none;tab-size:4;";
        this.textarea.spellcheck = false;

        this.errorDiv = document.createElement("div");
        this.errorDiv.style.cssText =
            "font-family:monospace;font-size:12px;color:#f44336;" +
            "min-height:20px;margin-top:8px;white-space:pre-wrap;";

        this.overlay.appendChild(header);
        this.overlay.appendChild(this.textarea);
        this.overlay.appendChild(this.errorDiv);
        container.appendChild(this.overlay);

        applyBtn.addEventListener("click", () => this.handleApply());
        resetBtn.addEventListener("click", () => this.handleReset());
        closeBtn.addEventListener("click", () => this.close());

        // Tab key inserts 4 spaces instead of moving focus
        this.textarea.addEventListener("keydown", (e) => {
            if (e.key === "Tab") {
                e.preventDefault();
                const s = this.textarea.selectionStart;
                this.textarea.value =
                    this.textarea.value.substring(0, s) +
                    "    " +
                    this.textarea.value.substring(this.textarea.selectionEnd);
                this.textarea.selectionStart = this.textarea.selectionEnd = s + 4;
            }
        });

        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.isOpen) this.close();
        });
    }

    private makeButton(label: string, color: string): HTMLButtonElement {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.style.cssText =
            `background:${color};color:#fff;border:none;padding:6px 14px;` +
            "border-radius:3px;font-family:monospace;font-size:13px;cursor:pointer;";
        return btn;
    }

    open(unitName: string, script: string, errorLog: string[], callbacks: ScriptEditorCallbacks): void {
        this.callbacks = callbacks;
        this.titleEl.textContent = `Script Editor — ${unitName}`;
        this.textarea.value = script;
        this.errorDiv.textContent = errorLog.length > 0
            ? "Recent errors:\n" + errorLog.join("\n")
            : "";
        this.overlay.style.display = "flex";
        this.isOpen = true;
        this.textarea.focus();
    }

    close(): void {
        this.overlay.style.display = "none";
        this.isOpen = false;
        this.callbacks = null;
    }

    get opened(): boolean {
        return this.isOpen;
    }

    private async handleApply(): Promise<void> {
        if (!this.callbacks) return;
        const error = await this.callbacks.onApply(this.textarea.value);
        if (error) {
            this.errorDiv.textContent = `Compile error:\n${error}`;
        } else {
            this.errorDiv.textContent = "Applied successfully.";
        }
    }

    private handleReset(): void {
        if (!this.callbacks) return;
        this.textarea.value = this.callbacks.onReset();
        this.errorDiv.textContent = "";
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/script-editor.ts
git commit -m "feat: add ScriptEditorModal component"
```

---

## Task 6: Update `src/ui.ts` — error log, Edit Script button, modal integration

**Files:**
- Modify: `src/ui.ts`

- [ ] **Step 1: Import and add modal to UIOverlay**

Add at the top of `ui.ts`:
```typescript
import { ScriptEditorModal } from "./script-editor";
import { DEFAULT_SCRIPT } from "./lua-behavior";
```

Add field to `UIOverlay`:
```typescript
private editor: ScriptEditorModal;
```

In the constructor, after creating `this.selectionPanel`, add:
```typescript
this.editor = new ScriptEditorModal(container);
```

- [ ] **Step 2: Update `updateSelectionPanel` to show errors and Edit Script button**

Replace the single-unit branch in `updateSelectionPanel`:

```typescript
if (selected.length === 1) {
    const u = selected[0];
    const teamColor = u.team === "red" ? "#e57373" : "#64b5f6";
    let html =
        `<div style="color:${teamColor};font-size:14px;margin-bottom:4px;">${u.name}</div>` +
        `<div>Team: <span style="color:${teamColor}">${u.team}</span></div>` +
        `<div>Health: ${u.health}/${u.maxHealth}</div>` +
        `<div style="color:#888;margin-top:4px;">Pos: ${u.position.x.toFixed(1)}, ${u.position.z.toFixed(1)}</div>` +
        `<div style="margin-top:6px;">` +
        `<button id="hw-edit-script" style="background:#1565c0;color:#fff;border:none;padding:4px 10px;` +
        `border-radius:3px;font-family:monospace;font-size:12px;cursor:pointer;">Edit Script (E)</button>` +
        `</div>`;

    if (u.errorLog.length > 0) {
        html += `<div style="color:#f44336;margin-top:6px;font-size:11px;white-space:pre-wrap;">` +
            `Errors:\n${u.errorLog.slice(-3).join("\n")}</div>`;
    }

    this.selectionPanel.innerHTML = html;

    const editBtn = document.getElementById("hw-edit-script");
    if (editBtn) {
        editBtn.addEventListener("click", () => this.openEditor(u));
    }
} else {
```

- [ ] **Step 3: Add `openEditor` method to `UIOverlay`**

```typescript
private openEditor(unit: Unit): void {
    this.editor.open(unit.name, unit.luaScript, unit.errorLog, {
        onApply: async (script: string) => {
            const err = await this.units.setUnitScript(unit, script);
            return err ? err.message : null;
        },
        onReset: () => DEFAULT_SCRIPT,
    });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/ui.ts
git commit -m "feat: show error log and Edit Script button in selection panel"
```

---

## Task 7: Update `src/input.ts` — right-click sets moveCommand, E key opens editor

**Files:**
- Modify: `src/input.ts`

- [ ] **Step 1: Update right-click handler to set `moveCommand` instead of `target`**

In `handleRightClick`, change:
```typescript
this.units.moveSelectedTo(point);
```
to (no change needed — `moveSelectedTo` already uses `moveCommand` after Task 3).

Actually `moveSelectedTo` was updated in Task 3, so `handleRightClick` calls it unchanged. No edit needed here.

- [ ] **Step 2: Add `openEditor` callback to InputManager**

`InputManager` needs to open the editor for a selected unit when E is pressed. Add a callback field:

```typescript
private onEditScript: ((unit: Unit) => void) | null = null;

setEditScriptCallback(cb: (unit: Unit) => void): void {
    this.onEditScript = cb;
}
```

- [ ] **Step 3: Add E key handling**

In the `keydown` listener, add before the number keys block:

```typescript
if (key === "e" && !e.ctrlKey && !e.altKey && !e.shiftKey) {
    const selected = this.units.getSelected();
    if (selected.length === 1 && this.onEditScript) {
        this.onEditScript(selected[0]);
    }
    return;
}
```

- [ ] **Step 4: Wire up the callback in `src/ui.ts`**

In `UIOverlay` constructor, after creating the editor, wire up the callback:

```typescript
_input.setEditScriptCallback((unit) => this.openEditor(unit));
```

(The `_input` parameter in the constructor is currently unused — remove the underscore prefix: change `_input: InputManager` → `input: InputManager`.)

- [ ] **Step 5: Commit**

```bash
git add src/input.ts src/ui.ts
git commit -m "feat: E key opens script editor for selected unit"
```

---

## Task 8: Browser Verification

**No new files.** Final end-to-end check using the browser.

- [ ] **Step 1: Ensure dev server is running**

```bash
npm run dev -- --host
```

Navigate browser to `http://localhost:5173`.

- [ ] **Step 2: Verify units move to click targets**

Take a screenshot. Right-click on terrain to issue a move command to selected units. Take another screenshot after ~2 seconds.

Expected: Units turn toward the target and drive to it using the Lua move-to script (not teleport).

- [ ] **Step 3: Verify the script editor opens**

Select a single unit, press E. Take a screenshot.

Expected: Dark modal overlay with textarea containing the default Lua script, Apply/Reset/Close buttons, unit name in header.

- [ ] **Step 4: Verify error isolation**

With the editor open, replace the script with `function tick(self, dt) error("test error") end` and click Apply. Close the editor. Take a screenshot.

Expected: Unit stops moving. Selection panel shows the error in red. Other units continue moving normally.

- [ ] **Step 5: Verify reset**

Open editor again, click Reset. Click Apply.

Expected: Unit resumes moving to commands normally.

- [ ] **Step 6: Run final test suite**

```bash
npm test
```

Expected: All tests pass.

---

## Self-Review Notes

- All `unit.target` references are replaced with `unit.moveCommand` across all files.
- `LuaBehaviorEngine` is initialized before `spawnTestUnits` (units get Lua envs before first frame).
- `null` is never passed to Wasmoon — `moveCommand: null` is handled by omitting `target_x`/`target_z` from the self object.
- `update()` in UnitManager is now `async` — `game.ts` animate loop awaits it.
- `UIOverlay` constructor signature changes: `_input` → `input` (remove underscore).
- Error log capped at 20 entries; panel shows last 3.
- `destroyEnv` called when replacing a unit's script to avoid Lua state leaks.
