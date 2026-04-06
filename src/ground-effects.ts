import * as THREE from "three";
import type { TerrainQuery } from "./terrain";

const SCORCH_RADIUS = 5.0;
const SCORCH_SPIKES = 11;
const TREAD_MARK_LIFETIME = 60;   // seconds
const TREAD_TRACK_SPACING = 0.85; // world units between left/right tracks

/** Returns 2*numSpikes points: alternating spike tip (outer) and notch (inner). */
export function buildCraterShapePoints(
    outerRadius: number,
    numSpikes: number,
    rng: () => number,
): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < numSpikes; i++) {
        const tipAngle = (i / numSpikes) * Math.PI * 2;
        const tipR = outerRadius * (0.65 + 0.35 * rng());
        pts.push({ x: Math.cos(tipAngle) * tipR, y: Math.sin(tipAngle) * tipR });

        const notchAngle = tipAngle + Math.PI / numSpikes;
        const notchR = outerRadius * (0.25 + 0.2 * rng());
        pts.push({ x: Math.cos(notchAngle) * notchR, y: Math.sin(notchAngle) * notchR });
    }
    return pts;
}

function buildCraterTexture(size: number): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2;

    // Blackened centre
    const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.35);
    inner.addColorStop(0, "rgba(5,3,2,1)");
    inner.addColorStop(1, "rgba(5,3,2,1)");
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Churned brown mid-ring
    const mid = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 0.85);
    mid.addColorStop(0, "rgba(5,3,2,0)");
    mid.addColorStop(0.3, "rgba(60,35,15,0.9)");
    mid.addColorStop(0.6, "rgba(80,50,25,0.85)");
    mid.addColorStop(1, "rgba(90,60,30,0)");
    ctx.fillStyle = mid;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Blend overall alpha: solid inside, fades at edges
    ctx.globalCompositeOperation = "destination-in";
    const alpha = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
    alpha.addColorStop(0, "rgba(0,0,0,1)");
    alpha.addColorStop(0.7, "rgba(0,0,0,0.95)");
    alpha.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = alpha;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
}

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
        const rng = () => Math.random();
        const pts = buildCraterShapePoints(SCORCH_RADIUS, SCORCH_SPIKES, rng);

        const shape = new THREE.Shape();
        shape.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
        shape.closePath();

        const geo = new THREE.ShapeGeometry(shape);
        const texture = buildCraterTexture(256);
        // Map the shape's local XY coords into [0,1] UV space centred on the mark
        const uvAttr = geo.attributes.uv;
        const posAttr = geo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
            uvAttr.setXY(
                i,
                posAttr.getX(i) / (SCORCH_RADIUS * 2) + 0.5,
                posAttr.getY(i) / (SCORCH_RADIUS * 2) + 0.5,
            );
        }

        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
        });

        // Random rotation for variety
        const rotAngle = Math.random() * Math.PI * 2;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = rotAngle;
        mesh.position.set(
            position.x,
            this.terrain.getHeightAt(position.x, position.z) + 0.05,
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
