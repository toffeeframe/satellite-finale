import * as THREE from "three";
import CameraController from "./camera-controller";
import ControlsManager from "./controls-manager";
import SceneSetup from "./scene-setup";
import PhysicsEngine from "./physics-engine";

export default class SatelliteSimulation {
  // Constants
  readonly EARTH_RADIUS: number = 6371000; // meters
  readonly EARTH_MASS: number = 5.972e24; // kg
  readonly G: number = 6.6743e-11; // gravitational constant
  readonly SCALE_FACTOR: number = 1e-5; // Scale for visualization

  // Three.js components
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;

  // Simulation components
  sceneSetup: SceneSetup;
  physicsEngine: PhysicsEngine;
  cameraController: CameraController;
  controlsManager: ControlsManager;

  // Clock
  clock: THREE.Clock;

  // Simulation state
  isRunning: boolean = true;
  timeScale: number = 1;

  constructor() {
    this.sceneSetup = new SceneSetup(this);
    this.scene = this.sceneSetup.scene;
    this.camera = this.sceneSetup.camera;
    this.renderer = this.sceneSetup.renderer;

    this.physicsEngine = new PhysicsEngine(this);
    this.cameraController = new CameraController(this);
    this.controlsManager = new ControlsManager(this);

    this.clock = new THREE.Clock();

    this.physicsEngine.reset();
    this.sceneSetup.updateInfo();

    this.animate();
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();

    if (this.isRunning) {
      this.physicsEngine.updatePhysics(delta);
    }

    // Ensure camera modes (free/orbit/follow) update every frame
    this.cameraController.updateCameraPosition();

    this.renderer.render(this.scene, this.camera);
  }

  /* TODO once implementing air resistance, update to comply with reset for all changes over codebase */
  resetSatellite() {
    // Hard reset: set state from UI and clear trail for the followed satellite
    const idx = this.cameraController.followSatelliteIndex;
    const satellites = this.sceneSetup.satellites;
    const states = this.physicsEngine.satellites;
    if (satellites[idx] && states[idx]) {
      const heightInput = document.getElementById("height") as HTMLInputElement;
      const velocityInput = document.getElementById("velocity") as HTMLInputElement;
      const directionInput = document.getElementById("direction") as HTMLInputElement;
      const massInput = document.getElementById("mass") as HTMLInputElement;
      const keepCircularEl = document.getElementById("keepCircular") as HTMLInputElement;
      const earthRadius = this.EARTH_RADIUS;
      const height = parseFloat(heightInput.value) * 1000; // km to m
      const r = earthRadius + height;
      const x = r;
      const y = 0;
      const z = 0;
      let velocityMag = parseFloat(velocityInput.value);
      const directionDeg = parseFloat(directionInput.value);
      const mass = parseFloat(massInput.value);

      if (keepCircularEl?.checked) {
        velocityMag = Math.sqrt((this.G * this.EARTH_MASS) / r);
      }

      const directionRad = (directionDeg * Math.PI) / 180;
      // Update physics state
      states[idx].position.set(x, y, z);
      states[idx].velocity.set(
        velocityMag * Math.cos(directionRad),
        velocityMag * Math.sin(directionRad),
        0
      );
      states[idx].mass = mass;
      // Update mesh position
      satellites[idx].position.copy(states[idx].position.clone().multiplyScalar(this.SCALE_FACTOR));
      // Make satellite visible again (in case it was crashed)
      satellites[idx].visible = true;
      // Reset trail
      this.sceneSetup.trails[idx] = [];
      this.sceneSetup.updateTrails();
      
      // Clear crash status and reset styling
      const statusElement = document.getElementById("status");
      if (statusElement) {
        statusElement.textContent = "Orbiting";
        // Reset crash styling
        statusElement.style.color = "";
        statusElement.style.fontWeight = "";
        statusElement.style.textShadow = "";
      }
      
      // Clear crashed flag in physics state
      if (states[idx]) {
        (states[idx] as any).crashed = false;
      }
    }
  }

  applyCurrentSatelliteFromUI() {
    // Live apply: update selected satellite WITHOUT teleporting position
    const idx = this.cameraController.followSatelliteIndex;
    const satellites = this.sceneSetup.satellites;
    const states = this.physicsEngine.satellites;
    if (satellites[idx] && states[idx]) {
      const heightInput = document.getElementById("height") as HTMLInputElement;
      const velocityInput = document.getElementById("velocity") as HTMLInputElement;
      const directionInput = document.getElementById("direction") as HTMLInputElement;
      const massInput = document.getElementById("mass") as HTMLInputElement;
      const satSpeedInput = document.getElementById("satSpeed") as HTMLInputElement;
      const keepCircularEl = document.getElementById("keepCircular") as HTMLInputElement;

      const height = parseFloat(heightInput.value) * 1000; // km to m
      let velocityMag = parseFloat(velocityInput.value);
      const directionDeg = parseFloat(directionInput.value);
      const mass = parseFloat(massInput.value);
      const perSatScale = satSpeedInput ? parseFloat(satSpeedInput.value) : 1;

      // Store desired height for later hard reset/add, but DO NOT move now
      states[idx].height = height;

      // Update velocity
      if (keepCircularEl?.checked) {
        // Set velocity tangential with circular speed based on current radius
        const r = states[idx].position.length();
        const vCirc = Math.sqrt((this.G * this.EARTH_MASS) / Math.max(r, this.EARTH_RADIUS + 1));
        velocityMag = vCirc;
        // Tangential direction: perpendicular to radius vector in XY plane
        const radial = states[idx].position.clone().setZ(0);
        const tangential = new THREE.Vector3(-radial.y, radial.x, 0).normalize();
        states[idx].velocity.copy(tangential.multiplyScalar(velocityMag));
      } else {
        // When keepCircular is disabled, allow free movement
        // Only update velocity if the user explicitly changed it
        const currentSpeed = states[idx].velocity.length();
        const currentDirection = Math.atan2(states[idx].velocity.y, states[idx].velocity.x) * 180 / Math.PI;
        
        // Only update if there's a significant change to avoid constant updates
        if (Math.abs(velocityMag - currentSpeed) > 1 || Math.abs(directionDeg - currentDirection) > 1) {
          const directionRad = (directionDeg * Math.PI) / 180;
          states[idx].velocity.set(
            velocityMag * Math.cos(directionRad),
            velocityMag * Math.sin(directionRad),
            0
          );
        }
        
        // Height changes are now handled by the physics engine for smooth transitions
        // The targetHeight will be set by the UI event handlers
      }

      // Update mass
      states[idx].mass = mass;
      // Update per-satellite time scale
      (states[idx] as any).timeScale = perSatScale;

      // Also apply air resistance parameters
      const airEnabledEl = document.getElementById("airEnabled") as HTMLInputElement;
      const dragCoeffEl = document.getElementById("dragCoeff") as HTMLInputElement;
      const areaEl = document.getElementById("area") as HTMLInputElement;
      const rho0El = document.getElementById("rho0") as HTMLInputElement;
      const scaleHEl = document.getElementById("scaleH") as HTMLInputElement;
      if (airEnabledEl) states[idx].airEnabled = airEnabledEl.checked;
      if (dragCoeffEl) states[idx].dragCoefficient = parseFloat(dragCoeffEl.value);
      if (areaEl) states[idx].area = parseFloat(areaEl.value);
      if (rho0El) states[idx].initialDensity = parseFloat(rho0El.value);
      if (scaleHEl) states[idx].densityScaleHeight = parseFloat(scaleHEl.value);
    }
  }

  toggleSimulation() {
    this.isRunning = !this.isRunning;
    const playPauseBtn = document.getElementById("playPause");
    if (playPauseBtn) {
      playPauseBtn.textContent = this.isRunning ? "Pause" : "Play";
    }
  }
}
