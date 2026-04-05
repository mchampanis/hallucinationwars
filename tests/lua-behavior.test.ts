// @vitest-environment node
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { LuaBehaviorEngine, DEFAULT_SCRIPT, UnitLuaEnv } from "../src/lua-behavior";

let engine: LuaBehaviorEngine;
const envsToCleanup: UnitLuaEnv[] = [];

beforeAll(async () => {
    engine = new LuaBehaviorEngine();
    await engine.init();
});

afterEach(() => {
    for (const env of envsToCleanup) {
        engine.destroyEnv(env);
    }
    envsToCleanup.length = 0;
});

function assertEnv(result: UnitLuaEnv | Error): UnitLuaEnv {
    if (result instanceof Error) throw result;
    envsToCleanup.push(result);
    return result;
}

describe("LuaBehaviorEngine.compile", () => {
    it("returns a UnitLuaEnv for valid script", async () => {
        const result = await engine.compile(DEFAULT_SCRIPT);
        expect(result).not.toBeInstanceOf(Error);
        if (!(result instanceof Error)) engine.destroyEnv(result);
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
        const env = assertEnv(await engine.compile(DEFAULT_SCRIPT));
        const out = await engine.tick(env, { x: 0, z: 0, yaw: 0, moveCommand: null, turretYaw: 0, turretPitch: 0, fireCooldown: 0, nearestEnemy: null }, 0.016);
        expect(out.thrust).toBe(0);
        expect(out.steer).toBe(0);
        expect(out.error).toBeUndefined();
    });

    it("steers toward target when facing away", async () => {
        const env = assertEnv(await engine.compile(DEFAULT_SCRIPT));
        // Unit at origin, yaw=0 (facing +Z), target at (10, 0)
        // desired_yaw = atan(10, 0) = PI/2, angle_diff = PI/2 → steer clamped to 1.0
        const out = await engine.tick(env, { x: 0, z: 0, yaw: 0, moveCommand: { x: 10, z: 0 }, turretYaw: 0, turretPitch: 0, fireCooldown: 0, nearestEnemy: null }, 0.016);
        expect(out.steer).toBeCloseTo(1.0, 2);
        expect(out.thrust).toBeCloseTo(0, 2); // cos(PI/2) = 0
    });

    it("moves forward when already facing target", async () => {
        const env = assertEnv(await engine.compile(DEFAULT_SCRIPT));
        // yaw=0 faces +Z, target at (0, 10) — straight ahead
        const out = await engine.tick(env, { x: 0, z: 0, yaw: 0, moveCommand: { x: 0, z: 10 }, turretYaw: 0, turretPitch: 0, fireCooldown: 0, nearestEnemy: null }, 0.016);
        expect(out.steer).toBeCloseTo(0, 2);
        expect(out.thrust).toBeCloseTo(1.0, 2);
    });

    it("stops when within 0.5 units of target", async () => {
        const env = assertEnv(await engine.compile(DEFAULT_SCRIPT));
        const out = await engine.tick(env, { x: 0, z: 0, yaw: 0, moveCommand: { x: 0.3, z: 0.3 }, turretYaw: 0, turretPitch: 0, fireCooldown: 0, nearestEnemy: null }, 0.016);
        expect(out.thrust).toBe(0);
        expect(out.steer).toBe(0);
    });

    it("catches runtime errors and returns them without throwing", async () => {
        const env = assertEnv(await engine.compile(`function tick(self, dt) error("boom") end`));
        const out = await engine.tick(env, { x: 0, z: 0, yaw: 0, moveCommand: null, turretYaw: 0, turretPitch: 0, fireCooldown: 0, nearestEnemy: null }, 0.016);
        expect(out.thrust).toBe(0);
        expect(out.steer).toBe(0);
        expect(out.error).toContain("boom");
    });

    it("clamps thrust and steer to [-1, 1]", async () => {
        const env = assertEnv(await engine.compile(
            `function tick(self, dt) self.thrust = 99; self.steer = -99 end`
        ));
        const out = await engine.tick(env, { x: 0, z: 0, yaw: 0, moveCommand: null, turretYaw: 0, turretPitch: 0, fireCooldown: 0, nearestEnemy: null }, 0.016);
        expect(out.thrust).toBe(1);
        expect(out.steer).toBe(-1);
    });

    it("sandbox: io and debug are nil", async () => {
        const env = assertEnv(await engine.compile(`
            function tick(self, dt)
                self.thrust = (io == nil and debug == nil) and 1 or 0
            end
        `));
        const out = await engine.tick(env, { x: 0, z: 0, yaw: 0, moveCommand: null, turretYaw: 0, turretPitch: 0, fireCooldown: 0, nearestEnemy: null }, 0.016);
        expect(out.thrust).toBe(1);
    });

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
            nearestEnemy: { x: 10, z: 0, dist: 0.5, health: 80 },
        }, 0.016);
        expect(out.thrust).toBeCloseTo(0.5, 3);
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
            turretYaw: 0, turretPitch: 0, fireCooldown: 0.75, nearestEnemy: null,
        }, 0.016);
        expect(out.thrust).toBeCloseTo(0.75, 3);
    });
});
