import * as THREE from "three";
import { Terrain } from "./terrain";
import { CameraController } from "./camera";
import { UnitManager } from "./units";
import { InputManager } from "./input";
import { UIOverlay } from "./ui";

export class Game {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private cameraController: CameraController;
    private terrain: Terrain;
    private units: UnitManager;
    private input: InputManager;
    private ui: UIOverlay;
    private clock: THREE.Timer;

    constructor(container: HTMLElement) {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        container.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0x87ceeb, 150, 300);

        this.camera = new THREE.PerspectiveCamera(
            45,
            window.innerWidth / window.innerHeight,
            0.1,
            500
        );

        this.setupLighting();

        this.terrain = new Terrain(this.scene);
        this.cameraController = new CameraController(
            this.camera,
            this.renderer.domElement,
            this.terrain
        );
        this.units = new UnitManager(this.scene, this.terrain);
        this.input = new InputManager(
            this.renderer.domElement,
            this.camera,
            this.scene,
            this.units,
            this.terrain,
            this.cameraController
        );
        this.ui = new UIOverlay(container, this.units, this.input);
        this.clock = new THREE.Timer();

        window.addEventListener("resize", () => this.onResize());
    }

    private setupLighting(): void {
        const ambient = new THREE.AmbientLight(0x6688cc, 0.5);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
        sun.position.set(60, 80, 40);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -100;
        sun.shadow.camera.right = 100;
        sun.shadow.camera.top = 100;
        sun.shadow.camera.bottom = -100;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 200;
        this.scene.add(sun);

        const hemisphere = new THREE.HemisphereLight(0x88bbff, 0x445522, 0.3);
        this.scene.add(hemisphere);
    }

    async start(): Promise<void> {
        await this.units.preload();
        this.units.spawnTestUnits();
        this.animate();
    }

    private animate = (): void => {
        requestAnimationFrame(this.animate);
        this.clock.update();
        const delta = this.clock.getDelta();

        this.cameraController.update(delta);
        this.units.update(delta);
        this.input.update();
        this.ui.update();
        this.renderer.render(this.scene, this.camera);
    };

    private onResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
