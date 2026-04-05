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
