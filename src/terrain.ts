import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

// Terrain configuration
const MAP_SIZE = 200;
const SEGMENTS = 200;
const MAX_HEIGHT = 25;
const WATER_LEVEL = 2.0;

// Biome thresholds (by elevation)
const DEEP_WATER = 0.5;
const SHALLOW_WATER = WATER_LEVEL;
const SAND = 3.0;
const PLAINS = 8.0;
const FOREST = 14.0;
const ROCK = 20.0;
// Above ROCK = snow/mountain peaks

// Biome colors
const COLOR_DEEP_WATER = new THREE.Color(0x1a4a6e);
const COLOR_SHALLOW_WATER = new THREE.Color(0x2a7ab5);
const COLOR_SAND = new THREE.Color(0xc2b280);
const COLOR_PLAINS = new THREE.Color(0x5a8c3c);
const COLOR_FOREST = new THREE.Color(0x2d5a1e);
const COLOR_ROCK = new THREE.Color(0x6b6b6b);
const COLOR_SNOW = new THREE.Color(0xe8e8f0);

export interface TerrainQuery {
    getHeightAt(x: number, z: number): number;
    isWater(x: number, z: number): boolean;
    isPassable(x: number, z: number): boolean;
    getMapSize(): number;
}

export class Terrain implements TerrainQuery {
    private heightData: Float32Array;
    private geometry: THREE.PlaneGeometry;
    private mesh: THREE.Mesh;
    private waterMesh: THREE.Mesh;
    private trees: THREE.InstancedMesh;

    constructor(scene: THREE.Scene) {
        this.heightData = new Float32Array((SEGMENTS + 1) * (SEGMENTS + 1));
        this.geometry = new THREE.PlaneGeometry(
            MAP_SIZE, MAP_SIZE, SEGMENTS, SEGMENTS
        );

        this.generateHeightmap();
        this.applyHeightmap();
        this.colorVertices();

        const material = new THREE.MeshLambertMaterial({
            vertexColors: true,
        });

        this.mesh = new THREE.Mesh(this.geometry, material);
        this.mesh.receiveShadow = true;
        this.mesh.rotation.x = -Math.PI / 2;
        scene.add(this.mesh);

        this.waterMesh = this.createWater();
        scene.add(this.waterMesh);

        this.trees = this.createTrees();
        scene.add(this.trees);
    }

    private generateHeightmap(): void {
        const noise = createNoise2D();

        for (let j = 0; j <= SEGMENTS; j++) {
            for (let i = 0; i <= SEGMENTS; i++) {
                const x = (i / SEGMENTS) * MAP_SIZE - MAP_SIZE / 2;
                const z = (j / SEGMENTS) * MAP_SIZE - MAP_SIZE / 2;

                // Layered noise for natural terrain
                let h = 0;
                h += noise(x * 0.008, z * 0.008) * 1.0;   // continental
                h += noise(x * 0.02, z * 0.02) * 0.5;      // hills
                h += noise(x * 0.06, z * 0.06) * 0.15;     // detail
                h += noise(x * 0.15, z * 0.15) * 0.05;     // micro

                // Normalize from [-1.7, 1.7] to [0, 1]
                h = (h + 1.7) / 3.4;

                // Apply curve for more interesting terrain (flatter plains, sharper peaks)
                h = Math.pow(h, 1.5);

                // Scale to max height
                h *= MAX_HEIGHT;

                // Push edges down to create island-like shape
                const dx = x / (MAP_SIZE / 2);
                const dz = z / (MAP_SIZE / 2);
                const distFromCenter = Math.sqrt(dx * dx + dz * dz);
                const edgeFalloff = Math.max(0, 1 - Math.pow(distFromCenter * 0.9, 3));
                h *= edgeFalloff;

                this.heightData[j * (SEGMENTS + 1) + i] = h;
            }
        }
    }

    private applyHeightmap(): void {
        const positions = this.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const h = this.heightData[i];
            positions.setZ(i, h);
        }
        positions.needsUpdate = true;
        this.geometry.computeVertexNormals();
    }

    private colorVertices(): void {
        const positions = this.geometry.attributes.position;
        const colors = new Float32Array(positions.count * 3);
        const color = new THREE.Color();

        for (let i = 0; i < positions.count; i++) {
            const h = this.heightData[i];
            this.getBiomeColor(h, color);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        this.geometry.setAttribute(
            "color",
            new THREE.BufferAttribute(colors, 3)
        );
    }

    private getBiomeColor(height: number, target: THREE.Color): void {
        if (height < DEEP_WATER) {
            target.copy(COLOR_DEEP_WATER);
        } else if (height < SHALLOW_WATER) {
            target.lerpColors(COLOR_DEEP_WATER, COLOR_SHALLOW_WATER,
                (height - DEEP_WATER) / (SHALLOW_WATER - DEEP_WATER));
        } else if (height < SAND) {
            target.lerpColors(COLOR_SAND, COLOR_PLAINS,
                (height - SHALLOW_WATER) / (SAND - SHALLOW_WATER));
        } else if (height < PLAINS) {
            target.copy(COLOR_PLAINS);
        } else if (height < FOREST) {
            target.lerpColors(COLOR_PLAINS, COLOR_FOREST,
                (height - PLAINS) / (FOREST - PLAINS));
        } else if (height < ROCK) {
            target.lerpColors(COLOR_FOREST, COLOR_ROCK,
                (height - FOREST) / (ROCK - FOREST));
        } else {
            target.lerpColors(COLOR_ROCK, COLOR_SNOW,
                Math.min(1, (height - ROCK) / 5));
        }
    }

    private createWater(): THREE.Mesh {
        const waterGeo = new THREE.PlaneGeometry(MAP_SIZE * 1.5, MAP_SIZE * 1.5);
        const waterMat = new THREE.MeshLambertMaterial({
            color: 0x2288bb,
            transparent: true,
            opacity: 0.7,
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.rotation.x = -Math.PI / 2;
        water.position.y = WATER_LEVEL;
        return water;
    }

    private createTrees(): THREE.InstancedMesh {
        // Simple tree: cone on a cylinder
        const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.0, 5);
        const leavesGeo = new THREE.ConeGeometry(0.8, 2.0, 6);
        leavesGeo.translate(0, 1.5, 0);

        const merged = new THREE.BufferGeometry();
        const mergedGeometries = mergeSimple(trunkGeo, leavesGeo);

        const material = new THREE.MeshLambertMaterial({ color: 0x228b22 });
        const maxTrees = 3000;
        const trees = new THREE.InstancedMesh(mergedGeometries, material, maxTrees);
        trees.castShadow = true;

        const noise = createNoise2D();
        const matrix = new THREE.Matrix4();
        const color = new THREE.Color();
        let count = 0;

        for (let i = 0; i < 8000 && count < maxTrees; i++) {
            const x = (Math.random() - 0.5) * MAP_SIZE * 0.9;
            const z = (Math.random() - 0.5) * MAP_SIZE * 0.9;
            const h = this.getHeightAt(x, z);

            // Trees only in forest biome range
            if (h < PLAINS || h > FOREST) continue;

            // Cluster trees using noise
            const density = noise(x * 0.05, z * 0.05);
            if (density < 0.1) continue;

            const scale = 0.7 + Math.random() * 0.6;
            matrix.makeScale(scale, scale, scale);
            matrix.setPosition(x, h, z);

            // Vary tree color slightly
            const greenVariance = 0.8 + Math.random() * 0.4;
            color.setRGB(0.1 * greenVariance, 0.4 * greenVariance, 0.08 * greenVariance);
            trees.setColorAt(count, color);
            trees.setMatrixAt(count, matrix);
            count++;
        }

        trees.count = count;
        trees.instanceMatrix.needsUpdate = true;
        if (trees.instanceColor) trees.instanceColor.needsUpdate = true;

        return trees;
    }

    getHeightAt(x: number, z: number): number {
        // Convert world coords to grid coords
        const gx = ((x + MAP_SIZE / 2) / MAP_SIZE) * SEGMENTS;
        const gz = ((z + MAP_SIZE / 2) / MAP_SIZE) * SEGMENTS;

        const ix = Math.floor(gx);
        const iz = Math.floor(gz);

        if (ix < 0 || ix >= SEGMENTS || iz < 0 || iz >= SEGMENTS) {
            return 0;
        }

        // Bilinear interpolation
        const fx = gx - ix;
        const fz = gz - iz;

        const h00 = this.heightData[iz * (SEGMENTS + 1) + ix];
        const h10 = this.heightData[iz * (SEGMENTS + 1) + ix + 1];
        const h01 = this.heightData[(iz + 1) * (SEGMENTS + 1) + ix];
        const h11 = this.heightData[(iz + 1) * (SEGMENTS + 1) + ix + 1];

        const h0 = h00 * (1 - fx) + h10 * fx;
        const h1 = h01 * (1 - fx) + h11 * fx;

        return h0 * (1 - fz) + h1 * fz;
    }

    isWater(x: number, z: number): boolean {
        return this.getHeightAt(x, z) < WATER_LEVEL;
    }

    isPassable(x: number, z: number): boolean {
        const h = this.getHeightAt(x, z);
        return h >= WATER_LEVEL && h < ROCK;
    }

    getMesh(): THREE.Mesh {
        return this.mesh;
    }

    getMapSize(): number {
        return MAP_SIZE;
    }

    getWaterLevel(): number {
        return WATER_LEVEL;
    }
}

// Simple geometry merge helper (avoids importing extra libraries)
function mergeSimple(
    geo1: THREE.BufferGeometry,
    geo2: THREE.BufferGeometry
): THREE.BufferGeometry {
    const pos1 = geo1.attributes.position;
    const pos2 = geo2.attributes.position;
    const norm1 = geo1.attributes.normal;
    const norm2 = geo2.attributes.normal;

    const totalVerts = pos1.count + pos2.count;
    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);

    for (let i = 0; i < pos1.count * 3; i++) {
        positions[i] = (pos1.array as Float32Array)[i];
        normals[i] = (norm1.array as Float32Array)[i];
    }
    const offset = pos1.count * 3;
    for (let i = 0; i < pos2.count * 3; i++) {
        positions[offset + i] = (pos2.array as Float32Array)[i];
        normals[offset + i] = (norm2.array as Float32Array)[i];
    }

    const idx1 = geo1.index;
    const idx2 = geo2.index;

    if (idx1 && idx2) {
        const totalIdx = idx1.count + idx2.count;
        const indices = new Uint32Array(totalIdx);
        for (let i = 0; i < idx1.count; i++) {
            indices[i] = idx1.array[i];
        }
        for (let i = 0; i < idx2.count; i++) {
            indices[idx1.count + i] = idx2.array[i] + pos1.count;
        }
        const merged = new THREE.BufferGeometry();
        merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
        merged.setIndex(new THREE.BufferAttribute(indices, 1));
        return merged;
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    return merged;
}
