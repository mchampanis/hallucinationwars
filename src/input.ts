import * as THREE from "three";
import { UnitManager, Unit } from "./units";
import { TerrainQuery } from "./terrain";
import { CameraController } from "./camera";

export class InputManager {
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private rightDragging: boolean;
    private rightDragStart: THREE.Vector2;
    private rightDragEnd: THREE.Vector2;
    private dragBox: HTMLDivElement;
    private hoveredUnit: Unit | null;
    private terrain: TerrainQuery;
    private cameraController: CameraController;

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
        this.rightDragging = false;
        this.rightDragStart = new THREE.Vector2();
        this.rightDragEnd = new THREE.Vector2();
        this.hoveredUnit = null;
        this.terrain = terrain;
        this.cameraController = cameraController;

        this.dragBox = document.createElement("div");
        this.dragBox.style.cssText =
            "position:absolute;border:1px solid #0f0;background:rgba(0,255,0,0.1);" +
            "pointer-events:none;display:none;";
        domElement.parentElement!.appendChild(this.dragBox);

        this.bindEvents();
    }

    private bindEvents(): void {
        // Left click - select (only fires if camera didn't drag)
        this.domElement.addEventListener("mousedown", (e) => {
            if (e.button === 2) { // Right mouse - box select
                this.rightDragging = true;
                this.rightDragStart.set(e.clientX, e.clientY);
                this.rightDragEnd.set(e.clientX, e.clientY);
            }
        });

        window.addEventListener("mousemove", (e) => {
            this.mouse.set(
                (e.clientX / window.innerWidth) * 2 - 1,
                -(e.clientY / window.innerHeight) * 2 + 1
            );

            if (this.rightDragging) {
                this.rightDragEnd.set(e.clientX, e.clientY);
                this.updateDragBox();
            }
        });

        window.addEventListener("mouseup", (e) => {
            if (e.button === 0) { // Left click release
                if (!this.cameraController.leftDragOccurred) {
                    this.handleLeftClick(e);
                }
            } else if (e.button === 2 && this.rightDragging) { // Right release
                this.rightDragging = false;
                this.dragBox.style.display = "none";

                const dragDist = this.rightDragStart.distanceTo(this.rightDragEnd);
                if (dragDist < 5) {
                    this.handleRightClick(e);
                } else {
                    this.handleBoxSelect();
                }
            }
        });

        this.domElement.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });
    }

    private updateDragBox(): void {
        const left = Math.min(this.rightDragStart.x, this.rightDragEnd.x);
        const top = Math.min(this.rightDragStart.y, this.rightDragEnd.y);
        const width = Math.abs(this.rightDragEnd.x - this.rightDragStart.x);
        const height = Math.abs(this.rightDragEnd.y - this.rightDragStart.y);

        if (width > 5 || height > 5) {
            this.dragBox.style.display = "block";
            this.dragBox.style.left = left + "px";
            this.dragBox.style.top = top + "px";
            this.dragBox.style.width = width + "px";
            this.dragBox.style.height = height + "px";
        }
    }

    private handleLeftClick(e: MouseEvent): void {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const unit = this.units.raycastUnit(this.raycaster);

        if (unit) {
            if (e.shiftKey) {
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
            this.rightDragStart,
            this.rightDragEnd,
            this.camera
        );
        this.units.selectMultiple(selected);
    }

    private handleRightClick(e: MouseEvent): void {
        const ndc = new THREE.Vector2(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
        );
        this.raycaster.setFromCamera(ndc, this.camera);

        // Raycast against terrain mesh
        const terrainMesh = this.scene.children.find(
            (c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.PlaneGeometry
                && c !== this.scene.children.find(
                    (w) => w instanceof THREE.Mesh
                        && (w as THREE.Mesh).material instanceof THREE.MeshLambertMaterial
                        && ((w as THREE.Mesh).material as THREE.MeshLambertMaterial).transparent
                )
        ) as THREE.Mesh | undefined;

        if (!terrainMesh) return;

        const hits = this.raycaster.intersectObject(terrainMesh);
        if (hits.length > 0) {
            const point = hits[0].point;
            if (this.terrain.isPassable(point.x, point.z)) {
                this.units.moveSelectedTo(point);
            }
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

    getSelectedCount(): number {
        return this.units.getSelected().length;
    }
}
