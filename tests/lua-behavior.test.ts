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
        const out = await engine.tick(env, { x: 0, z: 0, yaw: 0, moveCommand: null }, 0.016);
        expect(out.thrust).toBe(0);
        expect(out.steer).toBe(0);
        expect(out.error).toBeUndefined();
    });

    it("steers toward target when facing away", async () => {
        const env = assertEnv(await engine.compile(DEFAULT_SCRIPT));
        // Unit at origin, yaw=0 (facing +Z), target at (10, 0)
        // desired_yaw = atan(10, 0) = PI/2, angle_diff = PI/2 → steer clamped to 1.0
        const out = await engine.tick(env, { x: 0, z: 0, yaw: 0, moveCommand: { x: 10, z: 0 } }, 0.016);
        expect(out.steer).toBeCloseTo(1.0, 2);
        expect(out.thrust).toBeCloseTo(0, 2); // cos(PI/2) = 0
    });

    it("moves forward when already facing target", async () => {
        const env = assertEnv(await engine.compile(DEFAULT_SCRIPT));
        // yaw=0 faces +Z, target at (0, 10) — straight ahead
        const out = await engine.tick(env, { x: 0, z: 0, yaw: 0, moveCommand: { x: 0, z: 10 } }, 0.016);
        expect(out.steer).toBeCloseTo(0, 2);
        expect(out.thrust).toBeCloseTo(1.0, 2);
    });

    it("stops when within 0.5 units of target", async () => {
        const env = assertEnv(await engine.compile(DEFAULT_SCRIPT));
        const out = await engine.tick(env, { x: 0, z: 0, yaw: 0, moveCommand: { x: 0.3, z: 0.3 } }, 0.016);
        expect(out.thrust).toBe(0);
        expect(out.steer).toBe(0);
    });

    it("catches runtime errors and returns them without throwing", async () => {
        const env = assertEnv(await engine.compile(`function tick(self, dt) error("boom") end`));
        const out = await engine.tick(env, { x: 0, z: 0, yaw: 0, moveCommand: null }, 0.016);
        expect(out.thrust).toBe(0);
        expect(out.steer).toBe(0);
        expect(out.error).toContain("boom");
    });

    it("clamps thrust and steer to [-1, 1]", async () => {
        const env = assertEnv(await engine.compile(
            `function tick(self, dt) self.thrust = 99; self.steer = -99 end`
        ));
        const out = await engine.tick(env, { x: 0, z: 0, yaw: 0, moveCommand: null }, 0.016);
        expect(out.thrust).toBe(1);
        expect(out.steer).toBe(-1);
    });

    it("sandbox: io and debug are nil", async () => {
        const env = assertEnv(await engine.compile(`
            function tick(self, dt)
                self.thrust = (io == nil and debug == nil) and 1 or 0
            end
        `));
        const out = await engine.tick(env, { x: 0, z: 0, yaw: 0, moveCommand: null }, 0.016);
        expect(out.thrust).toBe(1);
    });
});
