import * as THREE from "three";
import type { TerrainQuery } from "./terrain";

const SCORCH_RADIUS = 5.0;
const TREAD_MARK_LIFETIME = 60;   // seconds
const TREAD_TRACK_SPACING = 0.85; // world units between left/right tracks

interface TreadMark {
    material: THREE.MeshBasicMaterial;
    mesh: THREE.Mesh;
    age: number;
}

export class GroundEffectsManager {
    private treadMarks: TreadMark[] = [];
    private scene: THREE.Scene;
    private terrain: TerrainQuery;

    constructor(scene: THREE.Scene, terrain: TerrainQuery) {
        this.scene = scene;
        this.terrain = terrain;
    }

    addScorchMark(position: THREE.Vector3): void {
        const geo = new THREE.CircleGeometry(SCORCH_RADIUS, 20);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x080503,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(
            position.x,
            this.terrain.getHeightAt(position.x, position.z) + 0.06,
            position.z,
        );
        this.scene.add(mesh);
        // Scorch marks are permanent — never removed
    }

    addTreadMark(position: THREE.Vector3, yaw: number): void {
        // Right-perpendicular to the tank's forward direction
        const rightX = Math.cos(yaw);
        const rightZ = -Math.sin(yaw);

        for (const side of [-1, 1]) {
            const tx = position.x + rightX * TREAD_TRACK_SPACING * side;
            const tz = position.z + rightZ * TREAD_TRACK_SPACING * side;
            const h = this.terrain.getHeightAt(tx, tz);

            const geo = new THREE.PlaneGeometry(0.3, 0.9);
            const mat = new THREE.MeshBasicMaterial({
                color: 0x0d0905,
                transparent: true,
                opacity: 0.6,
                depthWrite: false,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.rotation.z = -yaw;
            mesh.position.set(tx, h + 0.06, tz);
            this.scene.add(mesh);

            this.treadMarks.push({ mesh, material: mat, age: 0 });
        }
    }

    update(delta: number): void {
        for (let i = this.treadMarks.length - 1; i >= 0; i--) {
            const mark = this.treadMarks[i];
            mark.age += delta;
            if (mark.age >= TREAD_MARK_LIFETIME) {
                this.scene.remove(mark.mesh);
                mark.mesh.geometry.dispose();
                mark.material.dispose();
                this.treadMarks.splice(i, 1);
            } else {
                // Stay solid for most of lifetime, then fade out quickly at the end
                const t = mark.age / TREAD_MARK_LIFETIME;
                mark.material.opacity = 0.6 * Math.max(0, 1 - t * t * t);
            }
        }
    }
}
