import * as THREE from "three";

// ---- Pure particle state (no Three.js, fully testable) ----

export interface Particle {
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    age: number;
    lifetime: number;
    r: number; g: number; b: number;
}

export function stepParticle(p: Particle, dt: number, gravity: number): Particle {
    return {
        x: p.x + p.vx * dt,
        y: p.y + p.vy * dt,
        z: p.z + p.vz * dt,
        vx: p.vx,
        vy: p.vy - gravity * dt,
        vz: p.vz,
        age: p.age + dt,
        lifetime: p.lifetime,
        r: p.r, g: p.g, b: p.b,
    };
}

export function createExplosionParticles(x: number, y: number, z: number, count: number): Particle[] {
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = 4 + Math.random() * 18;
        const vx = Math.sin(phi) * Math.cos(theta) * speed;
        const vy = Math.abs(Math.sin(phi) * Math.sin(theta)) * speed; // bias upward
        const vz = Math.cos(phi) * speed;

        // Fire palette: orange/yellow core, with smoke sprinkled in
        const t = Math.random();
        let r: number, g: number, b: number;
        if (t < 0.15) {
            // Dark smoke
            const grey = 0.15 + Math.random() * 0.25;
            r = grey; g = grey; b = grey;
        } else if (t < 0.5) {
            // Bright yellow-white core
            r = 1.0; g = 0.85 + Math.random() * 0.15; b = 0.3 + Math.random() * 0.3;
        } else {
            // Orange-red
            r = 1.0; g = Math.random() * 0.45; b = 0;
        }

        particles.push({
            x, y, z,
            vx, vy, vz,
            age: 0,
            lifetime: 0.5 + Math.random() * 0.8,
            r, g, b,
        });
    }
    return particles;
}

export function createMuzzleFlashParticles(
    x: number, y: number, z: number,
    yaw: number, pitch: number,
    count: number,
): Particle[] {
    const particles: Particle[] = [];
    const fwdX = Math.sin(yaw) * Math.cos(pitch);
    const fwdY = Math.sin(pitch);
    const fwdZ = Math.cos(yaw) * Math.cos(pitch);

    for (let i = 0; i < count; i++) {
        // Mostly forward-biased but with wide blast spread so it's visible from any angle
        const forwardBias = 0.6;
        const spread = 1.6;
        const speed = 8 + Math.random() * 14;
        const vx = (fwdX * forwardBias + (Math.random() - 0.5) * spread) * speed;
        const vy = (fwdY * forwardBias + (Math.random() - 0.5) * spread + 0.3) * speed;
        const vz = (fwdZ * forwardBias + (Math.random() - 0.5) * spread) * speed;

        // Bright white-yellow so additive blending makes it pop
        const bright = 0.8 + Math.random() * 0.2;
        particles.push({
            x, y, z,
            vx, vy, vz,
            age: 0,
            lifetime: 0.06 + Math.random() * 0.08,
            r: 1.0, g: bright, b: bright * 0.4,
        });
    }
    return particles;
}

export function createDebrisParticles(x: number, y: number, z: number, count: number): Particle[] {
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 10;
        // Strong upward bias — dirt fountains up then falls back
        const vx = Math.cos(theta) * speed * 0.8;
        const vy = 3 + Math.random() * 8;
        const vz = Math.sin(theta) * speed * 0.8;

        // Earth tones: dark brown, sandy, dusty grey
        const tone = Math.random();
        let r: number, g: number, b: number;
        if (tone < 0.4) {
            r = 0.35 + Math.random() * 0.15; g = 0.22 + Math.random() * 0.1; b = 0.08;
        } else if (tone < 0.7) {
            r = 0.6 + Math.random() * 0.2; g = 0.5 + Math.random() * 0.15; b = 0.3;
        } else {
            const grey = 0.45 + Math.random() * 0.2;
            r = grey; g = grey; b = grey;
        }

        particles.push({ x, y, z, vx, vy, vz, age: 0, lifetime: 0.8 + Math.random() * 0.8, r, g, b });
    }
    return particles;
}

export function createLingeringSmokeParticles(x: number, y: number, z: number, count: number): Particle[] {
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const outward = 0.2 + Math.random() * 0.9;
        // Dark sooty charcoal — battles leave black smoke, not white clouds
        const grey = 0.18 + Math.random() * 0.2;
        particles.push({
            x, y, z,
            vx: Math.cos(theta) * outward,
            vy: 0.2 + Math.random() * 0.55,
            vz: Math.sin(theta) * outward,
            age: 0,
            lifetime: 4.0 + Math.random() * 3.0, // 4–7 s — hangs in the air
            r: grey, g: grey * 0.9, b: grey * 0.8,
        });
    }
    return particles;
}

export function createExhaustParticles(x: number, y: number, z: number, count: number): Particle[] {
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
        const grey = 0.2 + Math.random() * 0.15;
        particles.push({
            x, y, z,
            vx: (Math.random() - 0.5) * 0.6,
            vy: 0.5 + Math.random() * 0.8,
            vz: (Math.random() - 0.5) * 0.6,
            age: 0,
            lifetime: 1.0 + Math.random() * 0.8,
            r: grey, g: grey * 0.85, b: grey * 0.75,
        });
    }
    return particles;
}

export function createBarrelSmokePuff(x: number, y: number, z: number, count: number): Particle[] {
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
        const grey = 0.5 + Math.random() * 0.3;
        particles.push({
            x, y, z,
            vx: (Math.random() - 0.5) * 0.8,
            vy: 0.4 + Math.random() * 1.0,  // rises upward
            vz: (Math.random() - 0.5) * 0.8,
            age: 0,
            lifetime: 1.2 + Math.random() * 1.0,
            r: grey, g: grey, b: grey,
        });
    }
    return particles;
}

export function createTrailPuff(x: number, y: number, z: number, count: number): Particle[] {
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y, z,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 0.5 + Math.random() * 1.0,  // smoke drifts upward
            vz: (Math.random() - 0.5) * 1.5,
            age: 0,
            lifetime: 0.4 + Math.random() * 0.25,
            r: 0.75 + Math.random() * 0.15,
            g: 0.75 + Math.random() * 0.15,
            b: 0.75 + Math.random() * 0.15,
        });
    }
    return particles;
}

// ---- Three.js particle effect ----

const PARTICLE_GRAVITY = 5;

interface ParticleEffectConfig {
    size: number;
    blending: THREE.Blending;
    gravity?: number; // overrides PARTICLE_GRAVITY when set
}

export class ParticleEffect {
    private particles: Particle[];
    private points: THREE.Points;
    private positions: Float32Array;
    private colors: Float32Array;
    private gravity: number;

    constructor(particles: Particle[], scene: THREE.Scene, config: ParticleEffectConfig) {
        this.particles = particles;
        this.gravity = config.gravity ?? PARTICLE_GRAVITY;

        this.positions = new Float32Array(particles.length * 3);
        this.colors = new Float32Array(particles.length * 3);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
        geo.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));

        const mat = new THREE.PointsMaterial({
            size: config.size,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            blending: config.blending,
            depthWrite: false,
            sizeAttenuation: true,
        });

        this.points = new THREE.Points(geo, mat);
        scene.add(this.points);
        this.syncBuffers();
    }

    update(dt: number): void {
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i] = stepParticle(this.particles[i], dt, this.gravity);
        }
        const aliveCount = this.particles.filter(p => p.age < p.lifetime).length;
        (this.points.material as THREE.PointsMaterial).opacity = aliveCount / this.particles.length;
        this.syncBuffers();
    }

    isDone(): boolean {
        return this.particles.every(p => p.age >= p.lifetime);
    }

    dispose(scene: THREE.Scene): void {
        scene.remove(this.points);
        this.points.geometry.dispose();
        (this.points.material as THREE.Material).dispose();
    }

    private syncBuffers(): void {
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const alive = p.age < p.lifetime;
            this.positions[i * 3]     = alive ? p.x : 1e9;
            this.positions[i * 3 + 1] = alive ? p.y : 1e9;
            this.positions[i * 3 + 2] = alive ? p.z : 1e9;
            this.colors[i * 3]     = p.r;
            this.colors[i * 3 + 1] = p.g;
            this.colors[i * 3 + 2] = p.b;
        }
        (this.points.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
        (this.points.geometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
    }
}

// ---- Manager: owns all active effects ----

const EXPLOSION_CONFIG:     ParticleEffectConfig = { size: 0.7,  blending: THREE.AdditiveBlending };
const FLASH_CONFIG:         ParticleEffectConfig = { size: 1.8,  blending: THREE.AdditiveBlending };
const TRAIL_CONFIG:         ParticleEffectConfig = { size: 0.55, blending: THREE.NormalBlending };
const DEBRIS_CONFIG:        ParticleEffectConfig = { size: 0.45, blending: THREE.NormalBlending, gravity: 10 };
const SMOKE_CONFIG:         ParticleEffectConfig = { size: 4.5,  blending: THREE.NormalBlending, gravity: 0 };
const BARREL_SMOKE_CONFIG:  ParticleEffectConfig = { size: 1.4,  blending: THREE.NormalBlending, gravity: 0 };
const EXHAUST_CONFIG:       ParticleEffectConfig = { size: 0.9,  blending: THREE.NormalBlending, gravity: 0 };

export class ParticleManager {
    private effects: ParticleEffect[] = [];
    private scene: THREE.Scene;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    spawnExplosion(position: THREE.Vector3): void {
        const particles = createExplosionParticles(position.x, position.y, position.z, 250);
        this.effects.push(new ParticleEffect(particles, this.scene, EXPLOSION_CONFIG));
    }

    spawnMuzzleFlash(position: THREE.Vector3, yaw: number, pitch: number): void {
        const particles = createMuzzleFlashParticles(
            position.x, position.y, position.z, yaw, pitch, 60,
        );
        this.effects.push(new ParticleEffect(particles, this.scene, FLASH_CONFIG));
    }

    spawnTrail(position: THREE.Vector3): void {
        const particles = createTrailPuff(position.x, position.y, position.z, 12);
        this.effects.push(new ParticleEffect(particles, this.scene, TRAIL_CONFIG));
    }

    spawnDebris(position: THREE.Vector3): void {
        const particles = createDebrisParticles(position.x, position.y, position.z, 50);
        this.effects.push(new ParticleEffect(particles, this.scene, DEBRIS_CONFIG));
    }

    spawnLingeringSmoke(position: THREE.Vector3): void {
        const particles = createLingeringSmokeParticles(position.x, position.y, position.z, 80);
        this.effects.push(new ParticleEffect(particles, this.scene, SMOKE_CONFIG));
    }

    spawnBarrelSmoke(position: THREE.Vector3): void {
        const particles = createBarrelSmokePuff(position.x, position.y, position.z, 10);
        this.effects.push(new ParticleEffect(particles, this.scene, BARREL_SMOKE_CONFIG));
    }

    spawnExhaust(position: THREE.Vector3): void {
        const particles = createExhaustParticles(position.x, position.y, position.z, 6);
        this.effects.push(new ParticleEffect(particles, this.scene, EXHAUST_CONFIG));
    }

    update(dt: number): void {
        for (let i = this.effects.length - 1; i >= 0; i--) {
            this.effects[i].update(dt);
            if (this.effects[i].isDone()) {
                this.effects[i].dispose(this.scene);
                this.effects.splice(i, 1);
            }
        }
    }
}
