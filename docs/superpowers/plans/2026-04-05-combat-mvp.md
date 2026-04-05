# Combat MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add turret control, projectile firing, ground-impact explosions, area damage with falloff, and cooldown tracking — all scriptable from Lua.

**Architecture:** `ProjectileManager` (new `src/projectiles.ts`) owns all live projectiles and explosion logic. `UnitManager.update()` accepts a `ProjectileManager` argument and calls `fire()` when a Lua script requests it. Pure physics math functions are extracted for unit testing; Three.js rendering code is not. `UnitSensors` and `UnitActuators` grow new fields; `Unit` interface grows turret state.

**Tech Stack:** Three.js, Wasmoon (Lua 5.4 via WASM), Vitest

---

## File Map

| File | Change |
|---|---|
| `src/lua-behavior.ts` | Extend `UnitSensors`, `UnitActuators`, `tick()`, `DEFAULT_SCRIPT` |
| `src/units.ts` | Extend `Unit` interface, spawn logic, `updateUnit()`, `UnitManager.update()` |
| `src/projectiles.ts` | **New** — pure physics functions + `ProjectileManager` class |
| `src/game.ts` | Wire `ProjectileManager` into animate loop |
| `tests/lua-behavior.test.ts` | Add new sensor/actuator tests; update existing `tick()` calls |
| `tests/projectile-physics.test.ts` | **New** — pure function tests |

---

## Task 1: Extend Lua interface (`UnitSensors`, `UnitActuators`, `tick`)

**Files:**
- Modify: `src/lua-behavior.ts`
- Modify: `tests/lua-behavior.test.ts`

- [ ] **Step 1: Write failing tests for new sensor/actuator fields**

Add to `tests/lua-behavior.test.ts` inside the `describe("LuaBehaviorEngine.tick"` block, before the closing `});`:

```typescript
    it("passes turret sensors to Lua", async () => {
        const env = assertEnv(await engine.compile(`
            function tick(self, dt)
                self.thrust = self.turret_yaw
                self.steer = self.turret_pitch
            end
        `));
        const out = await engine.tick(env, {
            x: 0, z: 0, yaw: 0, moveCommand: null,
            turretYaw: 0.5, turretPitch: 0.3, fireCooldown: 0, nearestEnemy: null,
        }, 0.016);
        expect(out.thrust).toBeCloseTo(0.5, 3);
        expect(out.steer).toBeCloseTo(0.3, 3);
    });

    it("reads turret_yaw, turret_pitch, fire actuators from Lua", async () => {
        const env = assertEnv(await engine.compile(`
            function tick(self, dt)
                self.turret_yaw = 1.0
                self.turret_pitch = 0.4
                self.fire = true
            end
        `));
        const out = await engine.tick(env, {
            x: 0, z: 0, yaw: 0, moveCommand: null,
            turretYaw: 0, turretPitch: 0, fireCooldown: 0, nearestEnemy: null,
        }, 0.016);
        expect(out.turretYaw).toBeCloseTo(1.0, 3);
        expect(out.turretPitch).toBeCloseTo(0.4, 3);
        expect(out.fire).toBe(true);
    });

    it("clamps turret_yaw to [-PI, PI]", async () => {
        const env = assertEnv(await engine.compile(`
            function tick(self, dt) self.turret_yaw = 99 end
        `));
        const out = await engine.tick(env, {
            x: 0, z: 0, yaw: 0, moveCommand: null,
            turretYaw: 0, turretPitch: 0, fireCooldown: 0, nearestEnemy: null,
        }, 0.016);
        expect(out.turretYaw).toBeCloseTo(Math.PI, 4);
    });

    it("clamps turret_pitch to [0, 0.6]", async () => {
        const env = assertEnv(await engine.compile(`
            function tick(self, dt) self.turret_pitch = -5 end
        `));
        const out = await engine.tick(env, {
            x: 0, z: 0, yaw: 0, moveCommand: null,
            turretYaw: 0, turretPitch: 0, fireCooldown: 0, nearestEnemy: null,
        }, 0.016);
        expect(out.turretPitch).toBe(0);
    });

    it("passes nearest_enemy flat fields when enemy present", async () => {
        const env = assertEnv(await engine.compile(`
            function tick(self, dt)
                self.thrust = self.nearest_enemy_dist or 0
            end
        `));
        const out = await engine.tick(env, {
            x: 0, z: 0, yaw: 0, moveCommand: null,
            turretYaw: 0, turretPitch: 0, fireCooldown: 2.0,
            nearestEnemy: { x: 10, z: 0, dist: 10, health: 80 },
        }, 0.016);
        expect(out.thrust).toBeCloseTo(10, 3);
    });

    it("nearest_enemy fields are absent when no enemy", async () => {
        const env = assertEnv(await engine.compile(`
            function tick(self, dt)
                self.thrust = self.nearest_enemy_dist or -1
            end
        `));
        const out = await engine.tick(env, {
            x: 0, z: 0, yaw: 0, moveCommand: null,
            turretYaw: 0, turretPitch: 0, fireCooldown: 0, nearestEnemy: null,
        }, 0.016);
        expect(out.thrust).toBeCloseTo(-1, 3);
    });

    it("passes cooldown sensor to Lua", async () => {
        const env = assertEnv(await engine.compile(`
            function tick(self, dt)
                self.thrust = self.cooldown
            end
        `));
        const out = await engine.tick(env, {
            x: 0, z: 0, yaw: 0, moveCommand: null,
            turretYaw: 0, turretPitch: 0, fireCooldown: 3.5, nearestEnemy: null,
        }, 0.016);
        expect(out.thrust).toBeCloseTo(3.5, 3);
    });
```

- [ ] **Step 2: Run tests — expect TypeScript compile errors + test failures**

```bash
npm test 2>&1 | tail -30
```

Expected: errors about missing fields on `UnitSensors` and missing `turretYaw`/`turretPitch`/`fire` on `UnitActuators`.

- [ ] **Step 3: Update `UnitSensors` and `UnitActuators` in `src/lua-behavior.ts`**

Replace the two interfaces:

```typescript
export interface UnitSensors {
    x: number;
    z: number;
    yaw: number;
    moveCommand: { x: number; z: number } | null;
    turretYaw: number;
    turretPitch: number;
    fireCooldown: number;
    nearestEnemy: { x: number; z: number; dist: number; health: number } | null;
}

export interface UnitActuators {
    thrust: number;
    steer: number;
    turretYaw: number;
    turretPitch: number;
    fire: boolean;
    error?: string;
}
```

- [ ] **Step 4: Update `tick()` in `src/lua-behavior.ts`**

Replace the entire `tick` method:

```typescript
async tick(env: UnitLuaEnv, sensors: UnitSensors, dt: number): Promise<UnitActuators> {
    const self: Record<string, unknown> = {
        x: sensors.x,
        z: sensors.z,
        yaw: sensors.yaw,
        thrust: 0,
        steer: 0,
        turret_yaw: sensors.turretYaw,
        turret_pitch: sensors.turretPitch,
        cooldown: sensors.fireCooldown,
        fire: false,
    };
    if (sensors.moveCommand !== null) {
        self.target_x = sensors.moveCommand.x;
        self.target_z = sensors.moveCommand.z;
    }
    if (sensors.nearestEnemy !== null) {
        self.nearest_enemy_x = sensors.nearestEnemy.x;
        self.nearest_enemy_z = sensors.nearestEnemy.z;
        self.nearest_enemy_dist = sensors.nearestEnemy.dist;
        self.nearest_enemy_health = sensors.nearestEnemy.health;
    }

    try {
        await env.tickFn(self, dt);
    } catch (e) {
        return {
            thrust: 0, steer: 0,
            turretYaw: sensors.turretYaw, turretPitch: sensors.turretPitch,
            fire: false, error: String(e),
        };
    }

    const thrust = Math.max(-1, Math.min(1, (self.thrust as number) ?? 0));
    const steer = Math.max(-1, Math.min(1, (self.steer as number) ?? 0));
    const turretYaw = Math.max(-Math.PI, Math.min(Math.PI,
        typeof self.turret_yaw === "number" ? self.turret_yaw : sensors.turretYaw));
    const turretPitch = Math.max(0, Math.min(0.6,
        typeof self.turret_pitch === "number" ? self.turret_pitch : sensors.turretPitch));
    const fire = self.fire === true;
    return { thrust, steer, turretYaw, turretPitch, fire };
}
```

- [ ] **Step 5: Fix existing `tick()` calls in `tests/lua-behavior.test.ts`**

Every existing call `engine.tick(env, { x: 0, z: 0, yaw: 0, moveCommand: null }, 0.016)` must gain the new required fields. There are 7 such calls. Replace each with:

```typescript
engine.tick(env, { x: 0, z: 0, yaw: 0, moveCommand: null, turretYaw: 0, turretPitch: 0, fireCooldown: 0, nearestEnemy: null }, 0.016)
```

The calls with `moveCommand: { x: ..., z: ... }` only need the four new fields added; leave the rest unchanged.

- [ ] **Step 6: Run tests — expect new tests to pass, all existing tests still pass**

```bash
npm test 2>&1 | tail -20
```

Expected: all 23 tests pass (16 existing + 7 new).

- [ ] **Step 7: Commit**

```bash
git add src/lua-behavior.ts tests/lua-behavior.test.ts
git commit -m "feat: extend Lua interface with turret sensors/actuators and nearest-enemy"
```

---

## Task 2: Pure projectile physics functions

**Files:**
- Create: `src/projectiles.ts`
- Create: `tests/projectile-physics.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/projectile-physics.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
    computeInitialVelocity,
    stepProjectile,
    explosionDamage,
    GRAVITY,
    MUZZLE_VELOCITY,
} from "../src/projectiles";

describe("computeInitialVelocity", () => {
    it("zero pitch fires horizontally at full muzzle velocity along +Z when yaw=0", () => {
        const v = computeInitialVelocity(0, 0, MUZZLE_VELOCITY);
        expect(v.vx).toBeCloseTo(0, 4);
        expect(v.vy).toBeCloseTo(0, 4);
        expect(v.vz).toBeCloseTo(MUZZLE_VELOCITY, 4);
    });

    it("pitch PI/2 fires straight up with no horizontal component", () => {
        const v = computeInitialVelocity(0, Math.PI / 2, 40);
        expect(v.vy).toBeCloseTo(40, 3);
        expect(Math.sqrt(v.vx * v.vx + v.vz * v.vz)).toBeCloseTo(0, 3);
    });

    it("yaw PI/2 fires along +X at pitch 0", () => {
        const v = computeInitialVelocity(Math.PI / 2, 0, 40);
        expect(v.vx).toBeCloseTo(40, 4);
        expect(v.vz).toBeCloseTo(0, 4);
    });

    it("total speed equals muzzle velocity for any yaw/pitch", () => {
        const v = computeInitialVelocity(1.2, 0.3, 40);
        const speed = Math.sqrt(v.vx * v.vx + v.vy * v.vy + v.vz * v.vz);
        expect(speed).toBeCloseTo(40, 4);
    });

    it("pitch 0.3 rad gives correct vertical component", () => {
        const v = computeInitialVelocity(0, 0.3, 40);
        expect(v.vy).toBeCloseTo(Math.sin(0.3) * 40, 4);
    });
});

describe("stepProjectile", () => {
    it("moves along velocity vector in dt", () => {
        const result = stepProjectile(
            { x: 0, y: 10, z: 0 },
            { vx: 0, vy: 0, vz: 40 },
            0.1
        );
        expect(result.pos.z).toBeCloseTo(4, 5);
        expect(result.pos.y).toBeCloseTo(10, 5);
    });

    it("reduces vy by GRAVITY each step", () => {
        const result = stepProjectile(
            { x: 0, y: 10, z: 0 },
            { vx: 0, vy: 0, vz: 0 },
            1.0
        );
        expect(result.vel.vy).toBeCloseTo(-GRAVITY, 5);
    });

    it("position uses velocity from start of step (symplectic integration)", () => {
        // vy starts at 0, so y should not change in the first step despite gravity applying to vel
        const result = stepProjectile(
            { x: 0, y: 10, z: 0 },
            { vx: 0, vy: 0, vz: 0 },
            1.0
        );
        // pos.y += vy_before_gravity * dt = 0 * 1 = 0
        expect(result.pos.y).toBeCloseTo(10, 5);
    });

    it("projectile starting higher travels further horizontally before reaching y=0", () => {
        const vel = computeInitialVelocity(0, 0.25, 40);
        const v = { vx: vel.vx, vy: vel.vy, vz: vel.vz };

        let posHigh = { x: 0, y: 5, z: 0 };
        let posLow  = { x: 0, y: 0, z: 0 };
        let vHigh = { ...v };
        let vLow  = { ...v };
        let rangeHigh = 0, rangeLow = 0;

        const dt = 0.016;
        for (let i = 0; i < 600; i++) {
            const rH = stepProjectile(posHigh, vHigh, dt);
            const rL = stepProjectile(posLow, vLow, dt);
            if (rangeHigh === 0 && rH.pos.y <= 0) rangeHigh = rH.pos.z;
            if (rangeLow  === 0 && rL.pos.y <= 0) rangeLow  = rL.pos.z;
            posHigh = rH.pos; vHigh = rH.vel;
            posLow  = rL.pos; vLow  = rL.vel;
        }
        expect(rangeHigh).toBeGreaterThan(rangeLow);
    });
});

describe("explosionDamage", () => {
    it("returns max damage at distance 0", () => {
        expect(explosionDamage(0, 8, 40)).toBeCloseTo(40, 5);
    });

    it("returns 0 at or beyond blast radius", () => {
        expect(explosionDamage(8, 8, 40)).toBe(0);
        expect(explosionDamage(10, 8, 40)).toBe(0);
    });

    it("returns half damage at half radius", () => {
        expect(explosionDamage(4, 8, 40)).toBeCloseTo(20, 5);
    });

    it("damage is monotonically decreasing with distance", () => {
        const d0 = explosionDamage(0, 8, 40);
        const d2 = explosionDamage(2, 8, 40);
        const d6 = explosionDamage(6, 8, 40);
        expect(d0).toBeGreaterThan(d2);
        expect(d2).toBeGreaterThan(d6);
    });
});
```

- [ ] **Step 2: Run tests — expect import error (file doesn't exist yet)**

```bash
npm test 2>&1 | grep -A5 "projectile-physics"
```

Expected: error about missing module `../src/projectiles`.

- [ ] **Step 3: Create `src/projectiles.ts` with pure functions only**

```typescript
// Pure physics functions — no Three.js. Tested directly.

export const GRAVITY = 12;           // m/s² (slightly faster than real for snappier feel)
export const MUZZLE_VELOCITY = 40;   // m/s
export const BLAST_RADIUS = 8;       // metres
export const MAX_DAMAGE = 40;        // HP (2-3 shots to kill from 100 HP)
export const FIRE_COOLDOWN = 5.0;    // seconds between shots
export const MAX_PROJECTILE_AGE = 10; // seconds before silent cleanup
export const MAX_TURRET_PITCH = 0.6; // radians (~35°)

export function computeInitialVelocity(
    worldYaw: number,
    pitch: number,
    muzzleVel: number,
): { vx: number; vy: number; vz: number } {
    const horizontal = Math.cos(pitch) * muzzleVel;
    return {
        vx: Math.sin(worldYaw) * horizontal,
        vy: Math.sin(pitch) * muzzleVel,
        vz: Math.cos(worldYaw) * horizontal,
    };
}

export function stepProjectile(
    pos: { x: number; y: number; z: number },
    vel: { vx: number; vy: number; vz: number },
    dt: number,
): {
    pos: { x: number; y: number; z: number };
    vel: { vx: number; vy: number; vz: number };
} {
    return {
        pos: {
            x: pos.x + vel.vx * dt,
            y: pos.y + vel.vy * dt,
            z: pos.z + vel.vz * dt,
        },
        vel: {
            vx: vel.vx,
            vy: vel.vy - GRAVITY * dt,
            vz: vel.vz,
        },
    };
}

export function explosionDamage(dist: number, blastRadius: number, maxDamage: number): number {
    if (dist >= blastRadius) return 0;
    return maxDamage * (1 - dist / blastRadius);
}
```

- [ ] **Step 4: Run tests — pure physics tests should pass**

```bash
npm test 2>&1 | tail -20
```

Expected: all tests pass (23 + 13 new = 36 total).

- [ ] **Step 5: Commit**

```bash
git add src/projectiles.ts tests/projectile-physics.test.ts
git commit -m "feat: add projectile physics pure functions with tests"
```

---

## Task 3: `ProjectileManager` class

**Files:**
- Modify: `src/projectiles.ts` (append class to existing file)

No unit tests for the Three.js class — follow the existing project pattern of testing pure math separately.

- [ ] **Step 1: Add Three.js imports at the top of `src/projectiles.ts`**

Add these two lines at the very top of the file, before the existing constants:

```typescript
import * as THREE from "three";
import type { TerrainQuery } from "./terrain";
```

- [ ] **Step 2: Append supporting types and `ProjectileManager` class at the bottom of `src/projectiles.ts`**

Add after the `explosionDamage` function:

```typescript
interface Damageable {
    team: string;
    position: THREE.Vector3;
    health: number;
}

interface LiveProjectile {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    ownerTeam: string;
    age: number;
    mesh: THREE.Mesh;
}

interface Explosion {
    mesh: THREE.Mesh;
    age: number;
}

export class ProjectileManager {
    private projectiles: LiveProjectile[] = [];
    private explosions: Explosion[] = [];
    private scene: THREE.Scene;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    fire(origin: THREE.Vector3, worldYaw: number, worldPitch: number, ownerTeam: string): void {
        const vel = computeInitialVelocity(worldYaw, worldPitch, MUZZLE_VELOCITY);
        const geo = new THREE.SphereGeometry(0.15, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(origin);
        this.scene.add(mesh);
        this.projectiles.push({
            position: origin.clone(),
            velocity: new THREE.Vector3(vel.vx, vel.vy, vel.vz),
            ownerTeam,
            age: 0,
            mesh,
        });
    }

    update(delta: number, terrain: TerrainQuery, units: Damageable[]): void {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.age += delta;

            const result = stepProjectile(
                { x: p.position.x, y: p.position.y, z: p.position.z },
                { vx: p.velocity.x, vy: p.velocity.y, vz: p.velocity.z },
                delta,
            );
            p.position.set(result.pos.x, result.pos.y, result.pos.z);
            p.velocity.set(result.vel.vx, result.vel.vy, result.vel.vz);
            p.mesh.position.copy(p.position);

            const groundY = terrain.getHeightAt(p.position.x, p.position.z);
            if (p.position.y <= groundY || p.age > MAX_PROJECTILE_AGE) {
                this.removeMesh(p.mesh);
                this.projectiles.splice(i, 1);
                if (p.position.y <= groundY) {
                    this.explode(p.position, p.ownerTeam, units);
                }
            }
        }

        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.age += delta;
            const t = exp.age / 0.4; // 0.4s animation
            if (t >= 1) {
                this.removeMesh(exp.mesh);
                this.explosions.splice(i, 1);
            } else {
                exp.mesh.scale.setScalar(t * BLAST_RADIUS);
                (exp.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
            }
        }
    }

    private explode(position: THREE.Vector3, ownerTeam: string, units: Damageable[]): void {
        const geo = new THREE.SphereGeometry(1, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 1 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position);
        this.scene.add(mesh);
        this.explosions.push({ mesh, age: 0 });

        for (const unit of units) {
            if (unit.team === ownerTeam) continue;
            const dist = unit.position.distanceTo(position);
            const dmg = explosionDamage(dist, BLAST_RADIUS, MAX_DAMAGE);
            if (dmg > 0) {
                unit.health = Math.max(0, unit.health - dmg);
            }
        }
    }

    private removeMesh(mesh: THREE.Mesh): void {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
    }
}
```

- [ ] **Step 3: Run tests — all should still pass (no new tests, no broken tests)**

```bash
npm test 2>&1 | tail -10
```

Expected: 36 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/projectiles.ts
git commit -m "feat: add ProjectileManager with fire/explode/area-damage"
```

---

## Task 4: Extend `Unit` interface and spawn

**Files:**
- Modify: `src/units.ts`

- [ ] **Step 1: Add turret fields to `Unit` interface**

In `src/units.ts`, find the `Unit` interface and add after `name: string;`:

```typescript
    turretYaw: number;
    turretPitch: number;
    fireCooldown: number;
    turretMesh: THREE.Object3D | null;
    barrelMesh: THREE.Object3D | null;
```

- [ ] **Step 2: Add `findTurretNodes` method to `UnitManager`**

Add this private method anywhere before `spawnUnit`:

```typescript
private findTurretNodes(modelRoot: THREE.Group | null): {
    turretMesh: THREE.Object3D | null;
    barrelMesh: THREE.Object3D | null;
} {
    if (!modelRoot) return { turretMesh: null, barrelMesh: null };
    let turretMesh: THREE.Object3D | null = null;
    let barrelMesh: THREE.Object3D | null = null;
    modelRoot.traverse((child) => {
        const name = child.name.toLowerCase();
        if (!turretMesh && name.includes("turret")) turretMesh = child;
        if (!barrelMesh && name.includes("barrel")) barrelMesh = child;
    });
    return { turretMesh, barrelMesh };
}
```

- [ ] **Step 3: Initialize turret fields in `spawnUnit`**

In `spawnUnit`, find where the `unit` object is constructed. Add these five fields after `modelRoot,`:

```typescript
            turretYaw: 0,
            turretPitch: 0,
            fireCooldown: 0,
            turretMesh: findResult.turretMesh,
            barrelMesh: findResult.barrelMesh,
```

Also, just before the unit object construction, add:

```typescript
        const findResult = this.findTurretNodes(modelRoot);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/units.ts
git commit -m "feat: add turret fields to Unit interface and spawn"
```

---

## Task 5: Fire logic, cooldown, turret visuals, nearest-enemy sensor

**Files:**
- Modify: `src/units.ts`

- [ ] **Step 1: Import `ProjectileManager` and `FIRE_COOLDOWN` in `src/units.ts`**

Add at the top of `src/units.ts` after the existing imports:

```typescript
import { ProjectileManager, FIRE_COOLDOWN } from "./projectiles";
```

- [ ] **Step 2: Add `findNearestEnemy` method to `UnitManager`**

Add this private method:

```typescript
private findNearestEnemy(
    unit: Unit,
): { x: number; z: number; dist: number; health: number } | null {
    let nearest: Unit | null = null;
    let nearestDist = Infinity;
    for (const other of this.units) {
        if (other.team === unit.team || other.health <= 0) continue;
        const dx = other.position.x - unit.position.x;
        const dz = other.position.z - unit.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = other;
        }
    }
    if (!nearest) return null;
    return { x: nearest.position.x, z: nearest.position.z, dist: nearestDist, health: nearest.health };
}
```

- [ ] **Step 3: Update `UnitManager.update` signature to accept `ProjectileManager`**

Change:

```typescript
async update(delta: number): Promise<void> {
    for (const unit of this.units) {
        await this.updateUnit(unit, delta);
    }
}
```

To:

```typescript
async update(delta: number, projectileManager: ProjectileManager): Promise<void> {
    for (const unit of this.units) {
        await this.updateUnit(unit, delta, projectileManager);
    }
}
```

- [ ] **Step 4: Update `updateUnit` signature and sensor construction**

Change:

```typescript
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
```

To:

```typescript
private async updateUnit(unit: Unit, delta: number, projectileManager: ProjectileManager): Promise<void> {
    // Run Lua behavior
    if (unit.luaEnv) {
        const nearestEnemy = this.findNearestEnemy(unit);
        const out = await this.luaBehavior.tick(
            unit.luaEnv,
            {
                x: unit.position.x,
                z: unit.position.z,
                yaw: unit.yaw,
                moveCommand: unit.moveCommand,
                turretYaw: unit.turretYaw,
                turretPitch: unit.turretPitch,
                fireCooldown: unit.fireCooldown,
                nearestEnemy,
            },
            delta,
        );
```

- [ ] **Step 5: Apply turret actuators and fire logic inside `updateUnit`**

After the steer/thrust application block (after `if (this.terrain.isPassable(newX, newZ)) { ... }`), add:

```typescript
            // Apply turret actuators
            unit.turretYaw = out.turretYaw;
            unit.turretPitch = out.turretPitch;

            // Fire if requested and cooldown allows
            if (out.fire && unit.fireCooldown <= 0) {
                const worldYaw = unit.yaw + unit.turretYaw;
                const muzzleOffset = new THREE.Vector3(
                    Math.sin(worldYaw) * 1.5,
                    1.5,
                    Math.cos(worldYaw) * 1.5,
                );
                const origin = unit.position.clone().add(muzzleOffset);
                projectileManager.fire(origin, worldYaw, unit.turretPitch, unit.team);
                unit.fireCooldown = FIRE_COOLDOWN;
            }

            // Cooldown tick
            if (unit.fireCooldown > 0) {
                unit.fireCooldown = Math.max(0, unit.fireCooldown - delta);
            }
```

- [ ] **Step 6: Add turret visual update in `updateUnit`**

In the "Update visuals" section of `updateUnit`, after the health bar colour update, add:

```typescript
        // Turret / barrel visual rotation
        if (unit.turretMesh) {
            unit.turretMesh.rotation.y = unit.turretYaw;
        }
        if (unit.barrelMesh) {
            unit.barrelMesh.rotation.x = -unit.turretPitch;
        }
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/units.ts
git commit -m "feat: wire turret actuators, firing, cooldown and nearest-enemy sensor into UnitManager"
```

---

## Task 6: Wire `ProjectileManager` into `Game` and update `DEFAULT_SCRIPT`

**Files:**
- Modify: `src/game.ts`
- Modify: `src/lua-behavior.ts`

- [ ] **Step 1: Add `ProjectileManager` to `Game`**

In `src/game.ts`, add the import:

```typescript
import { ProjectileManager } from "./projectiles";
```

Add a private field to the `Game` class (alongside the other private fields):

```typescript
    private projectiles: ProjectileManager;
```

In the `Game` constructor, after `this.units = new UnitManager(...)`:

```typescript
        this.projectiles = new ProjectileManager(this.scene);
```

- [ ] **Step 2: Update `animate` to call both update methods**

In `Game.animate`, change:

```typescript
        await this.units.update(delta);
```

To:

```typescript
        await this.units.update(delta, this.projectiles);
        this.projectiles.update(delta, this.terrain, this.units.getAllUnits());
```

- [ ] **Step 3: Update `DEFAULT_SCRIPT` in `src/lua-behavior.ts`**

Replace the entire `DEFAULT_SCRIPT` constant:

```typescript
export const DEFAULT_SCRIPT = `\
function tick(self, dt)
  -- Movement toward player-issued move command
  if self.target_x ~= nil then
    local dx = self.target_x - self.x
    local dz = self.target_z - self.z
    local dist = math.sqrt(dx * dx + dz * dz)
    if dist >= 0.5 then
      local desired_yaw = math.atan(dx, dz)
      local angle_diff = desired_yaw - self.yaw
      while angle_diff >  math.pi do angle_diff = angle_diff - 2 * math.pi end
      while angle_diff < -math.pi do angle_diff = angle_diff + 2 * math.pi end
      self.steer  = math.max(-1, math.min(1, angle_diff * 2))
      self.thrust = math.max(0, math.cos(angle_diff))
    else
      self.thrust = 0
      self.steer  = 0
    end
  else
    self.thrust = 0
    self.steer  = 0
  end

  -- Combat: aim turret at nearest enemy and fire when ready
  if self.nearest_enemy_dist ~= nil and self.nearest_enemy_dist < 60 then
    local dx = self.nearest_enemy_x - self.x
    local dz = self.nearest_enemy_z - self.z
    local world_bearing = math.atan(dx, dz)
    self.turret_yaw   = world_bearing - self.yaw
    self.turret_pitch = 0.3
    if self.cooldown <= 0 then
      self.fire = true
    end
  end
end
`;
```

- [ ] **Step 4: Verify TypeScript compiles and tests pass**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -15
```

Expected: no TypeScript errors, all 36 tests pass.

- [ ] **Step 5: Smoke test in browser**

```bash
npm run dev -- --host
```

Open the game. After ~5 seconds units should start firing shells at the enemy team. Shells should arc ballistically, hit the ground, and trigger expanding orange explosion spheres. Health bars should decrease. Check the browser console for errors.

- [ ] **Step 6: Commit**

```bash
git add src/game.ts src/lua-behavior.ts
git commit -m "feat: wire ProjectileManager into game loop and update default Lua script with firing logic"
```
