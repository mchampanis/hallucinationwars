import * as THREE from "three";
import { TerrainQuery } from "./terrain";

const PAN_SPEED = 40;
const EDGE_PAN_SPEED = 30;
const EDGE_MARGIN = 20;     // Pixels from screen edge to trigger panning
const DRAG_PAN_SCALE = 0.0015; // Mouse drag pan sensitivity (scaled by zoom)
const DRAG_DEAD_ZONE = 8;   // Pixels before drag kicks in
const ZOOM_SPEED = 5;
const KEY_ZOOM_SPEED = 40;
const ROTATE_SPEED = 0.005;
const KEY_ROTATE_SPEED = 1.5;
const MIN_DISTANCE = 15;
const MAX_DISTANCE = 150;
const MIN_POLAR = 0.3;   // Don't go fully horizontal
const MAX_POLAR = 1.4;   // Don't go fully top-down

export class CameraController {
    private target: THREE.Vector3;
    private spherical: THREE.Spherical;
    private keys: Set<string>;
    private isRotating: boolean;
    private isPanning: boolean;
    private lastMouse: { x: number; y: number };
    private dragStart: { x: number; y: number };
    private mouseScreenPos: { x: number; y: number };
    private windowFocused: boolean;
    public leftDragOccurred: boolean;
    private terrain: TerrainQuery;
    private mapHalfSize: number;

    constructor(
        private camera: THREE.PerspectiveCamera,
        private domElement: HTMLElement,
        terrain: TerrainQuery
    ) {
        this.terrain = terrain;
        this.target = new THREE.Vector3(0, 0, 0);
        this.spherical = new THREE.Spherical(80, Math.PI / 4, Math.PI / 4);
        this.keys = new Set();
        this.isRotating = false;
        this.isPanning = false;
        this.lastMouse = { x: 0, y: 0 };
        this.dragStart = { x: 0, y: 0 };
        this.mouseScreenPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.windowFocused = true;
        this.leftDragOccurred = false;
        this.mapHalfSize = terrain.getMapSize() / 2;

        this.bindEvents();
        this.updateCameraPosition();
    }

    private bindEvents(): void {
        window.addEventListener("keydown", (e) => {
            this.keys.add(e.key.toLowerCase());
        });
        window.addEventListener("keyup", (e) => {
            this.keys.delete(e.key.toLowerCase());
        });

        this.domElement.addEventListener("wheel", (e) => {
            e.preventDefault();
            const zoomDelta = e.deltaY * 0.01 * ZOOM_SPEED;
            this.spherical.radius = THREE.MathUtils.clamp(
                this.spherical.radius + zoomDelta,
                MIN_DISTANCE,
                MAX_DISTANCE
            );
        }, { passive: false });

        this.domElement.addEventListener("mousedown", (e) => {
            if (e.button === 0) { // Left mouse - pan
                this.isPanning = true;
                this.leftDragOccurred = false;
                this.dragStart = { x: e.clientX, y: e.clientY };
                this.lastMouse = { x: e.clientX, y: e.clientY };
            } else if (e.button === 1) { // Middle mouse - rotate
                this.isRotating = true;
                this.lastMouse = { x: e.clientX, y: e.clientY };
                e.preventDefault();
            }
        });

        window.addEventListener("mouseup", (e) => {
            if (e.button === 0) {
                this.isPanning = false;
            } else if (e.button === 1) {
                this.isRotating = false;
            }
        });

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                this.windowFocused = false;
                this.keys.clear();
            }
        });
        window.addEventListener("blur", () => {
            this.windowFocused = false;
            this.keys.clear();
        });
        window.addEventListener("focus", () => {
            this.windowFocused = true;
        });
        this.domElement.addEventListener("mouseleave", () => {
            this.mouseScreenPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        });

        window.addEventListener("mousemove", (e) => {
            this.mouseScreenPos = { x: e.clientX, y: e.clientY };
            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;
            this.lastMouse = { x: e.clientX, y: e.clientY };

            if (this.isRotating) {
                this.spherical.theta -= dx * ROTATE_SPEED;
                this.spherical.phi = THREE.MathUtils.clamp(
                    this.spherical.phi - dy * ROTATE_SPEED,
                    MIN_POLAR,
                    MAX_POLAR
                );
            }

            if (this.isPanning) {
                const totalDx = e.clientX - this.dragStart.x;
                const totalDy = e.clientY - this.dragStart.y;
                if (Math.abs(totalDx) > DRAG_DEAD_ZONE || Math.abs(totalDy) > DRAG_DEAD_ZONE) {
                    this.leftDragOccurred = true;
                }

                if (this.leftDragOccurred) {
                    const panScale = this.spherical.radius * DRAG_PAN_SCALE;
                    const forward = new THREE.Vector3(
                        -Math.sin(this.spherical.theta),
                        0,
                        -Math.cos(this.spherical.theta)
                    );
                    const right = new THREE.Vector3(
                        Math.cos(this.spherical.theta),
                        0,
                        -Math.sin(this.spherical.theta)
                    );
                    this.target.addScaledVector(right, -dx * panScale);
                    this.target.addScaledVector(forward, dy * panScale);
                }
            }
        });
    }

    update(delta: number): void {
        const forward = new THREE.Vector3(
            -Math.sin(this.spherical.theta),
            0,
            -Math.cos(this.spherical.theta)
        );
        const right = new THREE.Vector3(
            Math.cos(this.spherical.theta),
            0,
            -Math.sin(this.spherical.theta)
        );

        // Keyboard panning (WASD / arrows)
        const panAmount = PAN_SPEED * delta;
        if (this.keys.has("w") || this.keys.has("arrowup")) {
            this.target.addScaledVector(forward, panAmount);
        }
        if (this.keys.has("s") || this.keys.has("arrowdown")) {
            this.target.addScaledVector(forward, -panAmount);
        }
        if (this.keys.has("a") || this.keys.has("arrowleft")) {
            this.target.addScaledVector(right, -panAmount);
        }
        if (this.keys.has("d") || this.keys.has("arrowright")) {
            this.target.addScaledVector(right, panAmount);
        }

        // Screen edge panning (only when window is focused)
        if (this.windowFocused) {
            const edgePan = EDGE_PAN_SPEED * delta;
            const mx = this.mouseScreenPos.x;
            const my = this.mouseScreenPos.y;
            const w = window.innerWidth;
            const h = window.innerHeight;

            if (mx < EDGE_MARGIN) {
                this.target.addScaledVector(right, -edgePan);
            } else if (mx > w - EDGE_MARGIN) {
                this.target.addScaledVector(right, edgePan);
            }
            if (my < EDGE_MARGIN) {
                this.target.addScaledVector(forward, edgePan);
            } else if (my > h - EDGE_MARGIN) {
                this.target.addScaledVector(forward, -edgePan);
            }
        }

        // Q/E to rotate
        if (this.keys.has("q")) {
            this.spherical.theta += KEY_ROTATE_SPEED * delta;
        }
        if (this.keys.has("e")) {
            this.spherical.theta -= KEY_ROTATE_SPEED * delta;
        }

        // R/F to zoom
        if (this.keys.has("r")) {
            this.spherical.radius = THREE.MathUtils.clamp(
                this.spherical.radius - KEY_ZOOM_SPEED * delta,
                MIN_DISTANCE,
                MAX_DISTANCE
            );
        }
        if (this.keys.has("f")) {
            this.spherical.radius = THREE.MathUtils.clamp(
                this.spherical.radius + KEY_ZOOM_SPEED * delta,
                MIN_DISTANCE,
                MAX_DISTANCE
            );
        }

        // Z/X to tilt (polar angle)
        if (this.keys.has("z")) {
            this.spherical.phi = THREE.MathUtils.clamp(
                this.spherical.phi + KEY_ROTATE_SPEED * delta,
                MIN_POLAR,
                MAX_POLAR
            );
        }
        if (this.keys.has("x")) {
            this.spherical.phi = THREE.MathUtils.clamp(
                this.spherical.phi - KEY_ROTATE_SPEED * delta,
                MIN_POLAR,
                MAX_POLAR
            );
        }

        // Clamp to map bounds
        const bound = this.mapHalfSize * 0.9;
        this.target.x = THREE.MathUtils.clamp(this.target.x, -bound, bound);
        this.target.z = THREE.MathUtils.clamp(this.target.z, -bound, bound);

        // Keep target on terrain surface
        const terrainH = this.terrain.getHeightAt(this.target.x, this.target.z);
        this.target.y = terrainH;

        this.updateCameraPosition();
    }

    private updateCameraPosition(): void {
        const offset = new THREE.Vector3().setFromSpherical(this.spherical);
        this.camera.position.copy(this.target).add(offset);
        this.camera.lookAt(this.target);
    }

    getTarget(): THREE.Vector3 {
        return this.target.clone();
    }
}
