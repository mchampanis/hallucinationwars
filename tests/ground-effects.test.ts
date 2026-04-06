// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildCraterShapePoints } from "../src/ground-effects";

describe("buildCraterShapePoints", () => {
    const seededRng = (seed: number) => {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    };

    it("returns 2 * numSpikes points (spike tip + notch per spike)", () => {
        const pts = buildCraterShapePoints(5, 8, seededRng(42));
        expect(pts).toHaveLength(16);
    });

    it("all spike tips are within outerRadius of origin", () => {
        const R = 5;
        const pts = buildCraterShapePoints(R, 8, seededRng(1));
        for (const p of pts) {
            const dist = Math.sqrt(p.x * p.x + p.y * p.y);
            expect(dist).toBeLessThanOrEqual(R + 1e-9);
        }
    });

    it("spike tips are farther from origin than notch points", () => {
        const pts = buildCraterShapePoints(5, 8, seededRng(99));
        for (let i = 0; i < pts.length; i += 2) {
            const tipDist = Math.sqrt(pts[i].x * pts[i].x + pts[i].y * pts[i].y);
            const notchDist = Math.sqrt(pts[i + 1].x * pts[i + 1].x + pts[i + 1].y * pts[i + 1].y);
            expect(tipDist).toBeGreaterThan(notchDist);
        }
    });

    it("different rng seeds produce different shapes", () => {
        const pts1 = buildCraterShapePoints(5, 8, seededRng(1));
        const pts2 = buildCraterShapePoints(5, 8, seededRng(999));
        const differs = pts1.some((p, i) => Math.abs(p.x - pts2[i].x) > 0.01 || Math.abs(p.y - pts2[i].y) > 0.01);
        expect(differs).toBe(true);
    });

    it("points are distributed around the full circle", () => {
        const pts = buildCraterShapePoints(5, 8, seededRng(7));
        // Expect points in all four quadrants
        const hasQ1 = pts.some(p => p.x > 0 && p.y > 0);
        const hasQ2 = pts.some(p => p.x < 0 && p.y > 0);
        const hasQ3 = pts.some(p => p.x < 0 && p.y < 0);
        const hasQ4 = pts.some(p => p.x > 0 && p.y < 0);
        expect(hasQ1 && hasQ2 && hasQ3 && hasQ4).toBe(true);
    });
});
