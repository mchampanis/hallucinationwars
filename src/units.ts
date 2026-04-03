import * as THREE from "three";
import { TerrainQuery } from "./terrain";

const UNIT_SPEED = 8;
const UNIT_RADIUS = 0.5;

export type Team = "red" | "blue";

export interface Unit {
    id: number;
    team: Team;
    mesh: THREE.Group;
    body: THREE.Mesh;
    healthBar: THREE.Mesh;
    healthBg: THREE.Mesh;
    selectionRing: THREE.Mesh;
    position: THREE.Vector3;
    target: THREE.Vector3 | null;
    health: number;
    maxHealth: number;
    selected: boolean;
    hovered: boolean;
    name: string;
}

let nextId = 0;

export class UnitManager {
    private units: Unit[] = [];
    private scene: THREE.Scene;
    private terrain: TerrainQuery;

    constructor(scene: THREE.Scene, terrain: TerrainQuery) {
        this.scene = scene;
        this.terrain = terrain;
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

    private spawnUnit(team: Team, x: number, z: number, name: string): Unit {
        const group = new THREE.Group();

        // Find passable spawn point near requested position
        const spawnPos = this.findPassableNear(x, z);
        const h = this.terrain.getHeightAt(spawnPos.x, spawnPos.z);

        // Body - capsule shape
        const bodyGeo = new THREE.CapsuleGeometry(UNIT_RADIUS, 1.0, 4, 8);
        const bodyMat = new THREE.MeshLambertMaterial({
            color: team === "red" ? 0xcc3333 : 0x3333cc,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        body.position.y = 1.0;
        group.add(body);

        // Selection ring
        const ringGeo = new THREE.RingGeometry(0.8, 1.0, 24);
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

        const unit: Unit = {
            id: nextId++,
            team,
            mesh: group,
            body,
            healthBar: hb,
            healthBg: hbBg,
            selectionRing: ring,
            position: group.position,
            target: null,
            health: 100,
            maxHealth: 100,
            selected: false,
            hovered: false,
            name,
        };

        this.units.push(unit);
        return unit;
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

    update(delta: number): void {
        for (const unit of this.units) {
            this.updateUnit(unit, delta);
        }
    }

    private updateUnit(unit: Unit, delta: number): void {
        // Move toward target
        if (unit.target) {
            const dx = unit.target.x - unit.position.x;
            const dz = unit.target.z - unit.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 0.5) {
                unit.target = null;
            } else {
                const step = UNIT_SPEED * delta;
                const nx = unit.position.x + (dx / dist) * step;
                const nz = unit.position.z + (dz / dist) * step;

                if (this.terrain.isPassable(nx, nz)) {
                    unit.position.x = nx;
                    unit.position.z = nz;

                    // Face movement direction
                    unit.mesh.rotation.y = Math.atan2(dx, dz);
                }

                // Snap to terrain height
                unit.position.y = this.terrain.getHeightAt(
                    unit.position.x,
                    unit.position.z
                );
            }
        }

        // Update visuals
        unit.selectionRing.visible = unit.selected || unit.hovered;
        if (unit.hovered && !unit.selected) {
            (unit.selectionRing.material as THREE.MeshBasicMaterial).color.setHex(0xffff00);
        } else {
            (unit.selectionRing.material as THREE.MeshBasicMaterial).color.setHex(0x00ff00);
        }

        // Health bar faces camera (billboard)
        const healthPct = unit.health / unit.maxHealth;
        unit.healthBar.scale.x = healthPct;
        unit.healthBar.position.x = -(1 - healthPct) * 0.6;

        // Color health bar based on health
        const hbColor = (unit.healthBar.material as THREE.MeshBasicMaterial).color;
        if (healthPct > 0.6) hbColor.setHex(0x00cc00);
        else if (healthPct > 0.3) hbColor.setHex(0xcccc00);
        else hbColor.setHex(0xcc0000);

        // Body glow on hover
        const bodyMat = unit.body.material as THREE.MeshLambertMaterial;
        bodyMat.emissive.setHex(unit.hovered ? 0x222222 : 0x000000);
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

    moveSelectedTo(point: THREE.Vector3): void {
        const selected = this.getSelected();
        if (selected.length === 0) return;

        if (selected.length === 1) {
            selected[0].target = point.clone();
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
                selected[i].target = target;
            } else {
                selected[i].target = point.clone();
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
