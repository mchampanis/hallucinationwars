import { describe, it, expect } from "vitest";

// Pure movement math — extracted here to test without Three.js
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
        expect(result.z).toBeCloseTo(8, 5);
        expect(result.yaw).toBeCloseTo(0, 5);
    });

    it("turns right (positive steer increases yaw)", () => {
        const result = applyMovement({ x: 0, z: 0 }, 0, 0, 1, 1, MAX_SPEED, MAX_TURN_RATE);
        expect(result.yaw).toBeCloseTo(2.5, 5);
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
