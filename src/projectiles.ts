import * as THREE from "three";
import type { TerrainQuery } from "./terrain";

export const GRAVITY = 12;           // m/s² (slightly faster than real for snappier feel)
export const MUZZLE_VELOCITY = 40;   // m/s
export const BLAST_RADIUS = 8;       // metres
export const MAX_DAMAGE = 40;        // HP (2-3 shots to kill from 100 HP)
export const FIRE_COOLDOWN = 5.0;    // seconds between shots
export const MAX_PROJECTILE_AGE = 10; // seconds before silent cleanup
export const MAX_TURRET_PITCH = 0.6; // radians (~35°)
export const EXPLOSION_DURATION = 0.4; // seconds for explosion animation

// --- Pure physics (no Three.js, tested directly) ---

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
            const hitGround = p.position.y <= groundY;
            const expired = p.age > MAX_PROJECTILE_AGE;

            if (hitGround || expired) {
                this.removeMesh(p.mesh);
                this.projectiles.splice(i, 1);
                if (hitGround) {
                    const impactPoint = new THREE.Vector3(p.position.x, groundY, p.position.z);
                    this.explode(impactPoint, p.ownerTeam, units);
                }
            }
        }

        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.age += delta;
            const t = exp.age / EXPLOSION_DURATION;
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
