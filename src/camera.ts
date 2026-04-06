import * as THREE from "three";
import { TerrainQuery } from "./terrain";

const PAN_SPEED = 40;
const EDGE_PAN_SPEED = 30;
const EDGE_MARGIN = 20;     // Pixels from screen edge to trigger panning
const DRAG_PAN_SCALE = 0.0015; // Mouse drag pan sensitivity (scaled by zoom)
const ZOOM_SPEED = 5;
const KEY_ZOOM_SPEED = 40;
const KEY_ROTATE_SPEED = 1.5;
const MIN_DISTANCE = 15;
const MAX_DISTANCE = 150;
const MIN_POLAR = 0.3;   // Don't go fully horizontal
const MAX_POLAR = 1.4;   // Don't go fully top-down

const SHAKE_DECAY = 6;        // magnitude lost per second
const SHAKE_FALLOFF_SQ = 40 * 40; // squared distance at which intensity halves

export class CameraController {
    private target: THREE.Vector3;
    private spherical: THREE.Spherical;
    private keys: Set<string>;
    private isPanning: boolean;
    private lastMouse: { x: number; y: number };
    private mouseScreenPos: { x: number; y: number };
    private windowFocused: boolean;
    private hasMouse: boolean;
    private terrain: TerrainQuery;
    private mapHalfSize: number;
    private shakeMagnitude = 0;

    constructor(
        private camera: THREE.PerspectiveCamera,
        private domElement: HTMLElement,
        terrain: TerrainQuery
    ) {
        this.terrain = terrain;
        this.target = new THREE.Vector3(0, 0, 0);
        this.spherical = new THREE.Spherical(80, Math.PI / 4, Math.PI / 4);
        this.keys = new Set();
        this.isPanning = false;
        this.lastMouse = { x: 0, y: 0 };
        this.mouseScreenPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.windowFocused = true;
        this.hasMouse = false;
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

        // Middle mouse - drag to pan camera
        this.domElement.addEventListener("mousedown", (e) => {
            if (e.button === 1) {
                this.isPanning = true;
                this.lastMouse = { x: e.clientX, y: e.clientY };
                e.preventDefault();
            }
        });

        window.addEventListener("mouseup", (e) => {
            if (e.button === 1) {
                this.isPanning = false;
            }
        });

        // Prevent middle-click autoscroll
        this.domElement.addEventListener("auxclick", (e) => {
            if (e.button === 1) e.preventDefault();
        });

        // Touch controls: two-finger pinch-zoom + pan (one-finger handled by InputManager for box select)
        let prevTouches: { x: number; y: number }[] = [];
        let lastPinchDist = 0;

        this.domElement.addEventListener("touchstart", (e) => {
            e.preventDefault();
            prevTouches = Array.from(e.touches).map((t) => ({ x: t.clientX, y: t.clientY }));
            if (e.touches.length === 2) {
                const dx = e.touches[1].clientX - e.touches[0].clientX;
                const dy = e.touches[1].clientY - e.touches[0].clientY;
                lastPinchDist = Math.sqrt(dx * dx + dy * dy);
            }
        }, { passive: false });

        this.domElement.addEventListener("touchmove", (e) => {
            e.preventDefault();
            const touches = Array.from(e.touches).map((t) => ({ x: t.clientX, y: t.clientY }));

            if (touches.length === 2 && prevTouches.length >= 2) {
                // Pinch-to-zoom
                const dx = touches[1].x - touches[0].x;
                const dy = touches[1].y - touches[0].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const zoomDelta = (lastPinchDist - dist) * 0.20;
                this.spherical.radius = THREE.MathUtils.clamp(
                    this.spherical.radius + zoomDelta,
                    MIN_DISTANCE,
                    MAX_DISTANCE
                );
                lastPinchDist = dist;

                // Two-finger pan using midpoint delta
                const midX = (touches[0].x + touches[1].x) / 2;
                const prevMidX = (prevTouches[0].x + prevTouches[1].x) / 2;
                const midY = (touches[0].y + touches[1].y) / 2;
                const prevMidY = (prevTouches[0].y + prevTouches[1].y) / 2;
                const panScale = this.spherical.radius * DRAG_PAN_SCALE;
                const forward = new THREE.Vector3(
                    -Math.sin(this.spherical.theta), 0, -Math.cos(this.spherical.theta)
                );
                const right = new THREE.Vector3(
                    Math.cos(this.spherical.theta), 0, -Math.sin(this.spherical.theta)
                );
                this.target.addScaledVector(right, -(midX - prevMidX) * panScale);
                this.target.addScaledVector(forward, (midY - prevMidY) * panScale);
            }

            prevTouches = touches;
        }, { passive: false });

        this.domElement.addEventListener("touchend", (e) => {
            prevTouches = Array.from(e.touches).map((t) => ({ x: t.clientX, y: t.clientY }));
        }, { passive: false });

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
        window.addEventListener("pointermove", (e) => {
            if (e.pointerType !== "mouse") return;
            this.hasMouse = true;
            this.mouseScreenPos = { x: e.clientX, y: e.clientY };
            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;
            this.lastMouse = { x: e.clientX, y: e.clientY };

            if (this.isPanning) {
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

        // Arrow key panning
        const panAmount = PAN_SPEED * delta;
        if (this.keys.has("arrowup")) {
            this.target.addScaledVector(forward, panAmount);
        }
        if (this.keys.has("arrowdown")) {
            this.target.addScaledVector(forward, -panAmount);
        }
        if (this.keys.has("arrowleft")) {
            this.target.addScaledVector(right, -panAmount);
        }
        if (this.keys.has("arrowright")) {
            this.target.addScaledVector(right, panAmount);
        }

        // Screen edge panning (only when window is focused and a mouse is present)
        if (this.windowFocused && this.hasMouse) {
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

        // Decay and apply camera shake on top of the computed position
        if (this.shakeMagnitude > 0.001) {
            this.camera.position.x += (Math.random() - 0.5) * 2 * this.shakeMagnitude;
            this.camera.position.y += (Math.random() - 0.5) * 0.5 * this.shakeMagnitude;
            this.camera.position.z += (Math.random() - 0.5) * 2 * this.shakeMagnitude;
            this.shakeMagnitude = Math.max(0, this.shakeMagnitude - SHAKE_DECAY * delta);
        }
    }

    // worldPosition: the event (shot/explosion) location in world space
    // baseIntensity: max shake magnitude at distance zero (~0.4 for shots, ~1.5 for explosions)
    applyShake(worldPosition: THREE.Vector3, baseIntensity: number): void {
        const dx = worldPosition.x - this.target.x;
        const dz = worldPosition.z - this.target.z;
        const distSq = dx * dx + dz * dz;
        // Squared falloff: full intensity at centre, halves at SHAKE_FALLOFF_SQ distance
        const intensity = baseIntensity / (1 + distSq / SHAKE_FALLOFF_SQ);
        this.shakeMagnitude = Math.max(this.shakeMagnitude, intensity);
    }

    private updateCameraPosition(): void {
        const offset = new THREE.Vector3().setFromSpherical(this.spherical);
        this.camera.position.copy(this.target).add(offset);
        this.camera.lookAt(this.target);
    }

    centerOn(position: THREE.Vector3): void {
        this.target.x = position.x;
        this.target.z = position.z;
    }

    getTarget(): THREE.Vector3 {
        return this.target.clone();
    }
}
