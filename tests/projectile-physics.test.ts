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
