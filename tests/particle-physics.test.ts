// @vitest-environment node
import { describe, it, expect } from "vitest";
import { stepParticle, createExplosionParticles, createMuzzleFlashParticles, createDebrisParticles, createLingeringSmokeParticles, createBarrelSmokePuff } from "../src/particles";

describe("stepParticle", () => {
    it("moves position along velocity vector in dt", () => {
        const p = { x: 0, y: 5, z: 0, vx: 0, vy: 0, vz: 10, age: 0, lifetime: 1, r: 1, g: 0, b: 0 };
        const next = stepParticle(p, 0.1, 0);
        expect(next.z).toBeCloseTo(1, 5);
        expect(next.y).toBeCloseTo(5, 5);
    });

    it("applies gravity to vy each step", () => {
        const p = { x: 0, y: 10, z: 0, vx: 0, vy: 0, vz: 0, age: 0, lifetime: 1, r: 1, g: 0, b: 0 };
        const next = stepParticle(p, 1.0, 9.8);
        expect(next.vy).toBeCloseTo(-9.8, 5);
    });

    it("position uses velocity from start of step (gravity applied after move)", () => {
        const p = { x: 0, y: 10, z: 0, vx: 0, vy: 0, vz: 0, age: 0, lifetime: 1, r: 1, g: 0, b: 0 };
        const next = stepParticle(p, 1.0, 9.8);
        // vy was 0 at start of step so y should not change
        expect(next.y).toBeCloseTo(10, 5);
    });

    it("increments age by dt", () => {
        const p = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0.3, lifetime: 1, r: 1, g: 0, b: 0 };
        const next = stepParticle(p, 0.016, 0);
        expect(next.age).toBeCloseTo(0.316, 5);
    });

    it("preserves lifetime", () => {
        const p = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, lifetime: 0.8, r: 1, g: 0, b: 0 };
        const next = stepParticle(p, 0.1, 0);
        expect(next.lifetime).toBe(0.8);
    });

    it("particle is dead when age >= lifetime", () => {
        const p = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0.8, lifetime: 0.8, r: 1, g: 0, b: 0 };
        expect(p.age >= p.lifetime).toBe(true);
    });
});

describe("createExplosionParticles", () => {
    it("returns the requested number of particles", () => {
        const particles = createExplosionParticles(0, 0, 0, 60);
        expect(particles).toHaveLength(60);
    });

    it("all particles start at the given position", () => {
        const particles = createExplosionParticles(10, 2, -5, 60);
        for (const p of particles) {
            expect(p.x).toBeCloseTo(10, 5);
            expect(p.y).toBeCloseTo(2, 5);
            expect(p.z).toBeCloseTo(-5, 5);
        }
    });

    it("particles have varied velocity directions (not all pointing the same way)", () => {
        const particles = createExplosionParticles(0, 0, 0, 60);
        const firstVx = particles[0].vx;
        const allSameVx = particles.every(p => Math.abs(p.vx - firstVx) < 0.001);
        expect(allSameVx).toBe(false);
    });

    it("all particles have positive speed", () => {
        const particles = createExplosionParticles(0, 0, 0, 60);
        for (const p of particles) {
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
            expect(speed).toBeGreaterThan(0);
        }
    });

    it("all particles have positive lifetime", () => {
        const particles = createExplosionParticles(0, 0, 0, 60);
        for (const p of particles) {
            expect(p.lifetime).toBeGreaterThan(0);
        }
    });

    it("all particles start with age 0", () => {
        const particles = createExplosionParticles(0, 0, 0, 60);
        for (const p of particles) {
            expect(p.age).toBe(0);
        }
    });
});

describe("createMuzzleFlashParticles", () => {
    it("returns the requested number of particles", () => {
        const particles = createMuzzleFlashParticles(0, 1, 0, 0, 0, 20);
        expect(particles).toHaveLength(20);
    });

    it("all particles start at the given position", () => {
        const particles = createMuzzleFlashParticles(5, 2, 3, 0, 0, 20);
        for (const p of particles) {
            expect(p.x).toBeCloseTo(5, 5);
            expect(p.y).toBeCloseTo(2, 5);
            expect(p.z).toBeCloseTo(3, 5);
        }
    });

    it("particles have shorter lifetime than explosion particles", () => {
        const flashParticles = createMuzzleFlashParticles(0, 0, 0, 0, 0, 20);
        const explosionParticles = createExplosionParticles(0, 0, 0, 60);
        const maxFlash = Math.max(...flashParticles.map(p => p.lifetime));
        const maxExplosion = Math.max(...explosionParticles.map(p => p.lifetime));
        expect(maxFlash).toBeLessThan(maxExplosion);
    });

    it("all particles have positive lifetime", () => {
        const particles = createMuzzleFlashParticles(0, 0, 0, 0, 0, 20);
        for (const p of particles) {
            expect(p.lifetime).toBeGreaterThan(0);
        }
    });
});

describe("createDebrisParticles", () => {
    it("returns the requested number of particles", () => {
        expect(createDebrisParticles(0, 0, 0, 50)).toHaveLength(50);
    });

    it("all particles start at the given position", () => {
        const particles = createDebrisParticles(3, 1, -7, 50);
        for (const p of particles) {
            expect(p.x).toBeCloseTo(3, 5);
            expect(p.y).toBeCloseTo(1, 5);
            expect(p.z).toBeCloseTo(-7, 5);
        }
    });

    it("particles have strong upward velocity component on average", () => {
        const particles = createDebrisParticles(0, 0, 0, 50);
        const avgVy = particles.reduce((s, p) => s + p.vy, 0) / particles.length;
        expect(avgVy).toBeGreaterThan(0);
    });

    it("all particles have positive lifetime", () => {
        for (const p of createDebrisParticles(0, 0, 0, 50)) {
            expect(p.lifetime).toBeGreaterThan(0);
        }
    });
});

describe("createLingeringSmokeParticles", () => {
    it("returns the requested number of particles", () => {
        expect(createLingeringSmokeParticles(0, 0, 0, 80)).toHaveLength(80);
    });

    it("all particles start at the given position", () => {
        const particles = createLingeringSmokeParticles(5, 2, -3, 80);
        for (const p of particles) {
            expect(p.x).toBeCloseTo(5, 5);
            expect(p.y).toBeCloseTo(2, 5);
            expect(p.z).toBeCloseTo(-3, 5);
        }
    });

    it("particles have longer lifetime than explosion particles", () => {
        const smoke = createLingeringSmokeParticles(0, 0, 0, 80);
        const explosion = createExplosionParticles(0, 0, 0, 60);
        const minSmoke = Math.min(...smoke.map(p => p.lifetime));
        const maxExplosion = Math.max(...explosion.map(p => p.lifetime));
        expect(minSmoke).toBeGreaterThan(maxExplosion);
    });

    it("all particles drift upward (positive vy)", () => {
        for (const p of createLingeringSmokeParticles(0, 0, 0, 80)) {
            expect(p.vy).toBeGreaterThan(0);
        }
    });
});

describe("createBarrelSmokePuff", () => {
    it("returns the requested number of particles", () => {
        expect(createBarrelSmokePuff(0, 0, 0, 10)).toHaveLength(10);
    });

    it("all particles start at the given position", () => {
        const particles = createBarrelSmokePuff(1, 2, 3, 10);
        for (const p of particles) {
            expect(p.x).toBeCloseTo(1, 5);
            expect(p.y).toBeCloseTo(2, 5);
            expect(p.z).toBeCloseTo(3, 5);
        }
    });

    it("all particles drift upward on average", () => {
        const particles = createBarrelSmokePuff(0, 0, 0, 10);
        const avgVy = particles.reduce((s, p) => s + p.vy, 0) / particles.length;
        expect(avgVy).toBeGreaterThan(0);
    });

    it("all particles have positive lifetime", () => {
        for (const p of createBarrelSmokePuff(0, 0, 0, 10)) {
            expect(p.lifetime).toBeGreaterThan(0);
        }
    });
});
