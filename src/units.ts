import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/addons/utils/SkeletonUtils.js";
import { TerrainQuery } from "./terrain";
import { LuaBehaviorEngine, DEFAULT_SCRIPT, UnitLuaEnv } from "./lua-behavior";

const MAX_SPEED = 8;
const MAX_TURN_RATE = 2.5;
const ERROR_LOG_MAX = 20;
const UNIT_RADIUS = 0.5;
const TANK_SCALE = 0.2;
// Half-dimensions of the tank footprint used for terrain slope sampling
const CONFORM_HALF_LEN = 1.0;
const CONFORM_HALF_WIDTH = 0.6;

export type Team = "red" | "blue";

export interface Unit {
    id: number;
    team: Team;
    mesh: THREE.Group;
    body: THREE.Mesh;
    modelRoot: THREE.Group | null;
    healthBar: THREE.Mesh;
    healthBg: THREE.Mesh;
    selectionRing: THREE.Mesh;
    position: THREE.Vector3;
    yaw: number;
    moveCommand: { x: number; z: number } | null;
    health: number;
    maxHealth: number;
    selected: boolean;
    hovered: boolean;
    name: string;
    turretYaw: number;
    turretPitch: number;
    fireCooldown: number;
    turretMesh: THREE.Object3D | null;
    barrelMesh: THREE.Object3D | null;
    luaScript: string;
    luaEnv: UnitLuaEnv | null;
    errorLog: string[];
}

let nextId = 0;

export class UnitManager {
    private units: Unit[] = [];
    private scene: THREE.Scene;
    private terrain: TerrainQuery;
    private tankTemplate: THREE.Group | null = null;
    private luaBehavior: LuaBehaviorEngine;

    constructor(scene: THREE.Scene, terrain: TerrainQuery, luaBehavior: LuaBehaviorEngine) {
        this.scene = scene;
        this.terrain = terrain;
        this.luaBehavior = luaBehavior;
    }

    async preload(): Promise<void> {
        const loader = new GLTFLoader();
        try {
            const gltf = await loader.loadAsync(import.meta.env.BASE_URL + "assets/models/tank_1.glb");
            this.tankTemplate = gltf.scene;
        } catch (e) {
            console.warn("Failed to load tank model, using capsule fallback", e);
        }
    }

    private buildTankModel(team: Team): THREE.Group | null {
        if (!this.tankTemplate) return null;
        const model = skeletonClone(this.tankTemplate) as THREE.Group;
        model.scale.setScalar(TANK_SCALE);
        model.rotation.y = Math.PI / 2; // model's natural front is -X; rotate to face +Z (forward)

        // Lift so the hull bottom sits at y=0.
        // updateMatrixWorld must be called first so Box3.setFromObject uses correct transforms.
        // (Without it, SkinnedMesh world matrices are stale and the bbox is wrong.)
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        model.position.y = -box.min.y;

        const tint =
            team === "red"
                ? new THREE.Color(1.0, 0.35, 0.35)
                : new THREE.Color(0.35, 0.5, 1.0);
        model.traverse((child) => {
            if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                const applyTint = (m: THREE.Material): THREE.Material => {
                    const mat = (m as THREE.MeshStandardMaterial).clone();
                    mat.color.multiply(tint);
                    return mat;
                };
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(applyTint);
                } else {
                    child.material = applyTint(child.material);
                }
            }
        });
        return model;
    }

    spawnTestUnits(): void {
        const redNames = ["Scout Alpha", "Warrior Beta", "Archer Gamma", "Engineer Delta"];
        const blueNames = ["Drone Epsilon", "Tank Zeta", "Ranger Eta", "Builder Theta"];

        // Red team - spawn on one side
        for (let i = 0; i < 4; i++) {
            const x = -30 + (i % 2) * 4;
            const z = -30 + Math.floor(i / 2) * 4;
            this.spawnUnit("red", x, z, redNames[i]);
        }

        // Blue team - spawn on opposite side
        for (let i = 0; i < 4; i++) {
            const x = 30 + (i % 2) * 4;
            const z = 30 + Math.floor(i / 2) * 4;
            this.spawnUnit("blue", x, z, blueNames[i]);
        }
    }

    private findTurretNodes(modelRoot: THREE.Group | null): {
        turretMesh: THREE.Object3D | null;
        barrelMesh: THREE.Object3D | null;
    } {
        if (!modelRoot) return { turretMesh: null, barrelMesh: null };
        let turretMesh: THREE.Object3D | null = null;
        let barrelMesh: THREE.Object3D | null = null;
        modelRoot.traverse((child) => {
            const name = child.name.toLowerCase();
            if (!turretMesh && name.includes("turret")) turretMesh = child;
            if (!barrelMesh && name.includes("barrel")) barrelMesh = child;
        });
        return { turretMesh, barrelMesh };
    }

    private spawnUnit(team: Team, x: number, z: number, name: string): Unit {
        const group = new THREE.Group();

        // Find passable spawn point near requested position
        const spawnPos = this.findPassableNear(x, z);
        const h = this.terrain.getHeightAt(spawnPos.x, spawnPos.z);

        // Invisible hitbox used for raycasting and hover/selection
        const bodyGeo = new THREE.BoxGeometry(2.0, 1.5, 3.0);
        const bodyMat = new THREE.MeshBasicMaterial({ visible: false });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.75;
        group.add(body);

        // Visual model - GLB tank or capsule fallback
        const modelRoot = this.buildTankModel(team);
        if (modelRoot) {
            group.add(modelRoot);
        } else {
            const fallbackGeo = new THREE.CapsuleGeometry(UNIT_RADIUS, 1.0, 4, 8);
            const fallbackMat = new THREE.MeshLambertMaterial({
                color: team === "red" ? 0xcc3333 : 0x3333cc,
            });
            const fallback = new THREE.Mesh(fallbackGeo, fallbackMat);
            fallback.castShadow = true;
            fallback.position.y = 1.0;
            group.add(fallback);
        }

        // Selection ring
        const ringGeo = new THREE.RingGeometry(1.8, 2.1, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
        ring.visible = false;
        group.add(ring);

        // Health bar background
        const hbBgGeo = new THREE.PlaneGeometry(1.2, 0.15);
        const hbBgMat = new THREE.MeshBasicMaterial({
            color: 0x333333,
            side: THREE.DoubleSide,
        });
        const hbBg = new THREE.Mesh(hbBgGeo, hbBgMat);
        hbBg.position.y = 2.5;
        group.add(hbBg);

        // Health bar fill
        const hbGeo = new THREE.PlaneGeometry(1.2, 0.15);
        const hbMat = new THREE.MeshBasicMaterial({
            color: 0x00cc00,
            side: THREE.DoubleSide,
        });
        const hb = new THREE.Mesh(hbGeo, hbMat);
        hb.position.y = 2.5;
        hb.position.z = 0.01;
        group.add(hb);

        group.position.set(spawnPos.x, h, spawnPos.z);
        this.scene.add(group);

        const findResult = this.findTurretNodes(modelRoot);

        const unit: Unit = {
            id: nextId++,
            team,
            mesh: group,
            body,
            modelRoot,
            healthBar: hb,
            healthBg: hbBg,
            selectionRing: ring,
            position: group.position,
            yaw: 0,
            moveCommand: null,
            health: 100,
            maxHealth: 100,
            selected: false,
            hovered: false,
            name,
            turretYaw: 0,
            turretPitch: 0,
            fireCooldown: 0,
            turretMesh: findResult.turretMesh,
            barrelMesh: findResult.barrelMesh,
            luaScript: DEFAULT_SCRIPT,
            luaEnv: null,
            errorLog: [],
        };

        this.units.push(unit);
        this.initUnitLua(unit); // async fire-and-forget
        return unit;
    }

    private async initUnitLua(unit: Unit): Promise<void> {
        const result = await this.luaBehavior.compile(unit.luaScript);
        if (result instanceof Error) {
            unit.errorLog.push(result.message);
            if (unit.errorLog.length > ERROR_LOG_MAX) unit.errorLog.shift();
        } else {
            unit.luaEnv = result;
        }
    }

    async setUnitScript(unit: Unit, script: string): Promise<Error | null> {
        const result = await this.luaBehavior.compile(script);
        if (result instanceof Error) return result;
        if (unit.luaEnv) this.luaBehavior.destroyEnv(unit.luaEnv);
        unit.luaEnv = result;
        unit.luaScript = script;
        unit.errorLog = [];
        return null;
    }

    private findPassableNear(x: number, z: number): { x: number; z: number } {
        if (this.terrain.isPassable(x, z)) {
            return { x, z };
        }
        // Spiral search for passable terrain
        for (let r = 2; r < 30; r += 2) {
            for (let a = 0; a < Math.PI * 2; a += 0.5) {
                const nx = x + Math.cos(a) * r;
                const nz = z + Math.sin(a) * r;
                if (this.terrain.isPassable(nx, nz)) {
                    return { x: nx, z: nz };
                }
            }
        }
        return { x, z };
    }

    async update(delta: number): Promise<void> {
        for (const unit of this.units) {
            await this.updateUnit(unit, delta);
        }
    }

    private async updateUnit(unit: Unit, delta: number): Promise<void> {
        // Run Lua behavior
        if (unit.luaEnv) {
            const out = await this.luaBehavior.tick(
                unit.luaEnv,
                {
                    x: unit.position.x,
                    z: unit.position.z,
                    yaw: unit.yaw,
                    moveCommand: unit.moveCommand,
                    turretYaw: unit.turretYaw,
                    turretPitch: unit.turretPitch,
                    fireCooldown: unit.fireCooldown,
                    nearestEnemy: null,
                },
                delta,
            );
            if (out.error) {
                unit.errorLog.push(out.error);
                if (unit.errorLog.length > ERROR_LOG_MAX) unit.errorLog.shift();
                return;
            }

            // Apply actuators
            unit.yaw += out.steer * MAX_TURN_RATE * delta;
            const newX = unit.position.x + Math.sin(unit.yaw) * out.thrust * MAX_SPEED * delta;
            const newZ = unit.position.z + Math.cos(unit.yaw) * out.thrust * MAX_SPEED * delta;
            if (this.terrain.isPassable(newX, newZ)) {
                unit.position.x = newX;
                unit.position.z = newZ;
            }
        }

        // Always snap to terrain height and conform rotation to slope
        unit.position.y = this.terrain.getHeightAt(unit.position.x, unit.position.z);
        this.conformToTerrain(unit);

        // Update visuals
        unit.selectionRing.visible = unit.selected || unit.hovered;
        if (unit.hovered && !unit.selected) {
            (unit.selectionRing.material as THREE.MeshBasicMaterial).color.setHex(0xffff00);
        } else {
            (unit.selectionRing.material as THREE.MeshBasicMaterial).color.setHex(0x00ff00);
        }

        const healthPct = unit.health / unit.maxHealth;
        unit.healthBar.scale.x = healthPct;
        unit.healthBar.position.x = -(1 - healthPct) * 0.6;
        const hbColor = (unit.healthBar.material as THREE.MeshBasicMaterial).color;
        if (healthPct > 0.6) hbColor.setHex(0x00cc00);
        else if (healthPct > 0.3) hbColor.setHex(0xcccc00);
        else hbColor.setHex(0xcc0000);

        if (unit.modelRoot) {
            unit.modelRoot.traverse((child) => {
                if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
                    const mat = child.material as THREE.MeshStandardMaterial;
                    if (mat.emissive) {
                        mat.emissive.setHex(unit.hovered ? 0x222222 : 0x000000);
                    }
                }
            });
        }
    }

    private conformToTerrain(unit: Unit): void {
        const { x, z } = unit.position;
        const sinY = Math.sin(unit.yaw);
        const cosY = Math.cos(unit.yaw);

        // Sample terrain height at 4 corners of the tank footprint
        const hFL = this.terrain.getHeightAt(x + sinY * CONFORM_HALF_LEN - cosY * CONFORM_HALF_WIDTH, z + cosY * CONFORM_HALF_LEN + sinY * CONFORM_HALF_WIDTH);
        const hFR = this.terrain.getHeightAt(x + sinY * CONFORM_HALF_LEN + cosY * CONFORM_HALF_WIDTH, z + cosY * CONFORM_HALF_LEN - sinY * CONFORM_HALF_WIDTH);
        const hBL = this.terrain.getHeightAt(x - sinY * CONFORM_HALF_LEN - cosY * CONFORM_HALF_WIDTH, z - cosY * CONFORM_HALF_LEN + sinY * CONFORM_HALF_WIDTH);
        const hBR = this.terrain.getHeightAt(x - sinY * CONFORM_HALF_LEN + cosY * CONFORM_HALF_WIDTH, z - cosY * CONFORM_HALF_LEN - sinY * CONFORM_HALF_WIDTH);

        const hFront = (hFL + hFR) * 0.5;
        const hBack  = (hBL + hBR) * 0.5;
        const hLeft  = (hFL + hBL) * 0.5;
        const hRight = (hFR + hBR) * 0.5;

        // Build surface vectors along the tank's forward and right axes
        const forward = new THREE.Vector3(sinY * 2 * CONFORM_HALF_LEN, hFront - hBack, cosY * 2 * CONFORM_HALF_LEN).normalize();
        const right   = new THREE.Vector3(cosY * 2 * CONFORM_HALF_WIDTH, hRight - hLeft, -sinY * 2 * CONFORM_HALF_WIDTH).normalize();

        // Surface normal = forward × right
        const normal = new THREE.Vector3().crossVectors(forward, right).normalize();

        // Re-derive right so all three axes are orthogonal
        right.crossVectors(normal, forward).normalize();

        // Build and apply rotation from the three orthogonal basis vectors
        const matrix = new THREE.Matrix4().makeBasis(right, normal, forward);
        unit.mesh.setRotationFromMatrix(matrix);
    }

    raycastUnit(raycaster: THREE.Raycaster): Unit | null {
        let closest: Unit | null = null;
        let closestDist = Infinity;

        for (const unit of this.units) {
            const hits = raycaster.intersectObject(unit.body);
            if (hits.length > 0 && hits[0].distance < closestDist) {
                closest = unit;
                closestDist = hits[0].distance;
            }
        }
        return closest;
    }

    selectOnly(unit: Unit): void {
        this.deselectAll();
        unit.selected = true;
    }

    toggleSelection(unit: Unit): void {
        unit.selected = !unit.selected;
    }

    selectMultiple(units: Unit[]): void {
        this.deselectAll();
        for (const u of units) {
            u.selected = true;
        }
    }

    deselectAll(): void {
        for (const u of this.units) {
            u.selected = false;
        }
    }

    setHover(unit: Unit, hovered: boolean): void {
        unit.hovered = hovered;
    }

    getSelected(): Unit[] {
        return this.units.filter((u) => u.selected);
    }

    getAllUnits(): Unit[] {
        return this.units;
    }

    stopSelected(): void {
        for (const u of this.units) {
            if (u.selected) {
                u.moveCommand = null;
            }
        }
    }

    getUnitsById(ids: number[]): Unit[] {
        const idSet = new Set(ids);
        return this.units.filter((u) => idSet.has(u.id));
    }

    getVisibleUnitsOfTeam(team: string, camera: THREE.Camera): Unit[] {
        const frustum = new THREE.Frustum();
        const projScreenMatrix = new THREE.Matrix4();
        projScreenMatrix.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse
        );
        frustum.setFromProjectionMatrix(projScreenMatrix);

        return this.units.filter((u) => {
            if (u.team !== team) return false;
            const pos = u.position.clone();
            pos.y += 1; // Center of unit
            return frustum.containsPoint(pos);
        });
    }

    moveSelectedTo(point: THREE.Vector3): void {
        const selected = this.getSelected();
        if (selected.length === 0) return;

        if (selected.length === 1) {
            selected[0].moveCommand = { x: point.x, z: point.z };
            return;
        }

        // Formation spread for multiple units
        const spacing = 2.5;
        const cols = Math.ceil(Math.sqrt(selected.length));
        for (let i = 0; i < selected.length; i++) {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const offset = new THREE.Vector3(
                (col - (cols - 1) / 2) * spacing,
                0,
                (row - (cols - 1) / 2) * spacing
            );
            const target = point.clone().add(offset);
            if (this.terrain.isPassable(target.x, target.z)) {
                selected[i].moveCommand = { x: target.x, z: target.z };
            } else {
                selected[i].moveCommand = { x: point.x, z: point.z };
            }
        }
    }

    getUnitsInScreenBox(
        start: THREE.Vector2,
        end: THREE.Vector2,
        camera: THREE.Camera
    ): Unit[] {
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);

        const result: Unit[] = [];
        const screenPos = new THREE.Vector3();

        for (const unit of this.units) {
            screenPos.copy(unit.position);
            screenPos.y += 1; // Center of unit
            screenPos.project(camera);

            const sx = (screenPos.x + 1) / 2 * window.innerWidth;
            const sy = (-screenPos.y + 1) / 2 * window.innerHeight;

            if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
                result.push(unit);
            }
        }
        return result;
    }
}
