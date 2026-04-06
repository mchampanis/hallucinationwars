import * as THREE from "three";
import type { TerrainQuery } from "./terrain";
import type { ParticleManager } from "./particles";
import type { GroundEffectsManager } from "./ground-effects";
import type { CameraController } from "./camera";

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

export class ProjectileManager {
    private projectiles: LiveProjectile[] = [];
    private scene: THREE.Scene;
    private particles: ParticleManager;
    private groundEffects: GroundEffectsManager;
    private camera: CameraController;

    constructor(scene: THREE.Scene, particles: ParticleManager, groundEffects: GroundEffectsManager, camera: CameraController) {
        this.scene = scene;
        this.particles = particles;
        this.groundEffects = groundEffects;
        this.camera = camera;
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
        this.particles.spawnMuzzleFlash(origin, worldYaw, worldPitch);
        this.particles.spawnBarrelSmoke(origin);
        this.camera.applyShake(origin, 0.35);
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

            // Emit a trail puff roughly every 33 ms so adjacent puffs overlap into a solid trail
            if (Math.floor((p.age - delta) / 0.033) < Math.floor(p.age / 0.033)) {
                this.particles.spawnTrail(p.position);
            }

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
    }

    private explode(position: THREE.Vector3, ownerTeam: string, units: Damageable[]): void {
        this.particles.spawnExplosion(position);
        this.particles.spawnDebris(position);
        this.particles.spawnLingeringSmoke(position);
        this.groundEffects.addScorchMark(position);
        this.camera.applyShake(position, 1.5);

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
