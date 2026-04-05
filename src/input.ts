import * as THREE from "three";
import { UnitManager, Unit } from "./units";
import { TerrainQuery } from "./terrain";
import { CameraController } from "./camera";

type CommandMode = "none" | "attack-move";

const DRAG_THRESHOLD = 5; // Pixels before a click becomes a drag
const DOUBLE_TAP_MS = 300; // Max time between taps for double-tap

export class InputManager {
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private leftDragging: boolean;
    private leftDragStart: THREE.Vector2;
    private leftDragEnd: THREE.Vector2;
    private dragBox: HTMLDivElement;
    private hoveredUnit: Unit | null;
    private terrain: TerrainQuery;
    private cameraController: CameraController;
    private commandMode: CommandMode;
    private controlGroups: Map<number, number[]>;
    private lastGroupTap: { group: number; time: number };
    private onEditScript: ((unit: Unit) => void) | null = null;

    constructor(
        private domElement: HTMLElement,
        private camera: THREE.Camera,
        private scene: THREE.Scene,
        private units: UnitManager,
        terrain: TerrainQuery,
        cameraController: CameraController
    ) {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.leftDragging = false;
        this.leftDragStart = new THREE.Vector2();
        this.leftDragEnd = new THREE.Vector2();
        this.hoveredUnit = null;
        this.terrain = terrain;
        this.cameraController = cameraController;
        this.commandMode = "none";
        this.controlGroups = new Map();
        this.lastGroupTap = { group: -1, time: 0 };

        this.dragBox = document.createElement("div");
        this.dragBox.style.cssText =
            "position:absolute;border:1px solid #0f0;background:rgba(0,255,0,0.1);" +
            "pointer-events:none;display:none;";
        domElement.parentElement!.appendChild(this.dragBox);

        this.bindEvents();
    }

    private bindEvents(): void {
        // Left mouse down - start potential box select or click
        this.domElement.addEventListener("mousedown", (e) => {
            if (e.button === 0) {
                this.leftDragging = true;
                this.leftDragStart.set(e.clientX, e.clientY);
                this.leftDragEnd.set(e.clientX, e.clientY);
            }
        });

        window.addEventListener("mousemove", (e) => {
            this.mouse.set(
                (e.clientX / window.innerWidth) * 2 - 1,
                -(e.clientY / window.innerHeight) * 2 + 1
            );

            if (this.leftDragging) {
                this.leftDragEnd.set(e.clientX, e.clientY);
                this.updateDragBox();
            }
        });

        window.addEventListener("mouseup", (e) => {
            if (e.button === 0 && this.leftDragging) {
                this.leftDragging = false;
                this.dragBox.style.display = "none";

                const dragDist = this.leftDragStart.distanceTo(this.leftDragEnd);
                if (dragDist < DRAG_THRESHOLD) {
                    this.handleLeftClick(e);
                } else {
                    this.handleBoxSelect();
                }
            } else if (e.button === 2) {
                this.handleRightClick(e);
            }
        });

        // Keyboard commands
        window.addEventListener("keydown", (e) => {
            const key = e.key.toLowerCase();

            // A - enter attack-move mode
            if (key === "a" && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                if (this.units.getSelected().length > 0) {
                    this.commandMode = "attack-move";
                    this.domElement.style.cursor = "crosshair";
                }
                return;
            }

            // S - stop
            if (key === "s" && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                this.units.stopSelected();
                return;
            }

            // H - hold position (same as stop for now, no combat yet)
            if (key === "h" && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                this.units.stopSelected();
                return;
            }

            // Escape - cancel command mode or deselect
            if (e.key === "Escape") {
                if (this.commandMode !== "none") {
                    this.cancelCommandMode();
                } else {
                    this.units.deselectAll();
                }
                return;
            }

            if (key === "e" && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                const selected = this.units.getSelected();
                if (selected.length === 1 && this.onEditScript) {
                    this.onEditScript(selected[0]);
                }
                return;
            }

            // Number keys 0-9 - control groups
            const num = parseInt(e.key);
            if (!isNaN(num) && num >= 0 && num <= 9) {
                if (e.ctrlKey) {
                    this.assignControlGroup(num);
                    e.preventDefault();
                } else if (e.shiftKey) {
                    this.addToControlGroup(num);
                } else {
                    this.selectControlGroup(num);
                }
                return;
            }
        });

        // Prevent right-click context menu
        this.domElement.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });
    }

    private updateDragBox(): void {
        const left = Math.min(this.leftDragStart.x, this.leftDragEnd.x);
        const top = Math.min(this.leftDragStart.y, this.leftDragEnd.y);
        const width = Math.abs(this.leftDragEnd.x - this.leftDragStart.x);
        const height = Math.abs(this.leftDragEnd.y - this.leftDragStart.y);

        if (width > DRAG_THRESHOLD || height > DRAG_THRESHOLD) {
            this.dragBox.style.display = "block";
            this.dragBox.style.left = left + "px";
            this.dragBox.style.top = top + "px";
            this.dragBox.style.width = width + "px";
            this.dragBox.style.height = height + "px";
        }
    }

    private handleLeftClick(e: MouseEvent): void {
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // In attack-move mode, left-click issues the command
        if (this.commandMode === "attack-move") {
            this.issueCommandAtClick(e);
            this.cancelCommandMode();
            return;
        }

        const unit = this.units.raycastUnit(this.raycaster);

        if (unit) {
            if (e.ctrlKey) {
                // Ctrl+click: select all visible units of the same team
                const sameTeam = this.units.getVisibleUnitsOfTeam(unit.team, this.camera);
                this.units.selectMultiple(sameTeam);
            } else if (e.shiftKey) {
                this.units.toggleSelection(unit);
            } else {
                this.units.selectOnly(unit);
            }
        } else if (!e.shiftKey) {
            this.units.deselectAll();
        }
    }

    private handleBoxSelect(): void {
        const selected = this.units.getUnitsInScreenBox(
            this.leftDragStart,
            this.leftDragEnd,
            this.camera
        );
        this.units.selectMultiple(selected);
    }

    private handleRightClick(e: MouseEvent): void {
        // Cancel any active command mode on right-click
        if (this.commandMode !== "none") {
            this.cancelCommandMode();
            return;
        }

        const ndc = new THREE.Vector2(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
        );
        this.raycaster.setFromCamera(ndc, this.camera);

        const terrainMesh = this.findTerrainMesh();
        if (!terrainMesh) return;

        const hits = this.raycaster.intersectObject(terrainMesh);
        if (hits.length > 0) {
            const point = hits[0].point;
            if (this.terrain.isPassable(point.x, point.z)) {
                this.units.moveSelectedTo(point);
            }
        }
    }

    private issueCommandAtClick(e: MouseEvent): void {
        const ndc = new THREE.Vector2(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
        );
        this.raycaster.setFromCamera(ndc, this.camera);

        const terrainMesh = this.findTerrainMesh();
        if (!terrainMesh) return;

        const hits = this.raycaster.intersectObject(terrainMesh);
        if (hits.length > 0) {
            const point = hits[0].point;
            if (this.terrain.isPassable(point.x, point.z)) {
                // Attack-move: move to point, engaging enemies along the way.
                // No combat system yet, so this just moves for now.
                this.units.moveSelectedTo(point);
            }
        }
    }

    private findTerrainMesh(): THREE.Mesh | undefined {
        return this.scene.children.find(
            (c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.PlaneGeometry
                && c !== this.scene.children.find(
                    (w) => w instanceof THREE.Mesh
                        && (w as THREE.Mesh).material instanceof THREE.MeshLambertMaterial
                        && ((w as THREE.Mesh).material as THREE.MeshLambertMaterial).transparent
                )
        ) as THREE.Mesh | undefined;
    }

    private cancelCommandMode(): void {
        this.commandMode = "none";
        this.domElement.style.cursor = "default";
    }

    // Control groups

    private assignControlGroup(group: number): void {
        const ids = this.units.getSelected().map((u) => u.id);
        if (ids.length > 0) {
            this.controlGroups.set(group, ids);
        }
    }

    private addToControlGroup(group: number): void {
        const existing = this.controlGroups.get(group) || [];
        const newIds = this.units.getSelected().map((u) => u.id);
        const merged = [...new Set([...existing, ...newIds])];
        if (merged.length > 0) {
            this.controlGroups.set(group, merged);
        }
    }

    private selectControlGroup(group: number): void {
        const ids = this.controlGroups.get(group);
        if (!ids || ids.length === 0) return;

        const units = this.units.getUnitsById(ids);
        if (units.length === 0) return;

        this.units.selectMultiple(units);

        // Double-tap: also center camera on the group
        const now = performance.now();
        if (this.lastGroupTap.group === group && now - this.lastGroupTap.time < DOUBLE_TAP_MS) {
            const center = new THREE.Vector3();
            for (const u of units) {
                center.add(u.position);
            }
            center.divideScalar(units.length);
            this.cameraController.centerOn(center);
            this.lastGroupTap = { group: -1, time: 0 };
        } else {
            this.lastGroupTap = { group, time: now };
        }
    }

    update(): void {
        // Hover detection
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hovered = this.units.raycastUnit(this.raycaster);

        if (this.hoveredUnit !== hovered) {
            if (this.hoveredUnit) this.units.setHover(this.hoveredUnit, false);
            if (hovered) this.units.setHover(hovered, true);
            this.hoveredUnit = hovered;
        }
    }

    setEditScriptCallback(cb: (unit: Unit) => void): void {
        this.onEditScript = cb;
    }

    getSelectedCount(): number {
        return this.units.getSelected().length;
    }
}
