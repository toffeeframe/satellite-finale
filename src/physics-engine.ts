import * as THREE from "three";
import SatelliteSimulation from "./simulation";

export default class PhysicsEngine {
  simulation: SatelliteSimulation;

  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mass: number = 1000;

  constructor(simulation: SatelliteSimulation) {
    this.simulation = simulation;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.reset();
  }

  reset() {
    const heightInput = document.getElementById("height") as HTMLInputElement;
    const massInput = document.getElementById("mass") as HTMLInputElement;
    const velocityInput = document.getElementById(
      "velocity"
    ) as HTMLInputElement;
    const directionInput = document.getElementById(
      "direction"
    ) as HTMLInputElement;

    const height = parseFloat(heightInput?.value || "400") * 1000; // Convert to meters
    this.mass = parseFloat(massInput?.value || "1000");
    const velocity = parseFloat(velocityInput?.value || "7800");
    const direction =
      (parseFloat(directionInput?.value || "90") * Math.PI) / 180; // Convert to radians

    // Initial position (height above Earth surface)
    const totalRadius = this.simulation.EARTH_RADIUS + height;
    this.position = new THREE.Vector3(totalRadius, 0, 0);

    // Initial velocity
    this.velocity = new THREE.Vector3(
      velocity * Math.cos(direction),
      velocity * Math.sin(direction),
      0
    );

    // Clear trail
    this.simulation.sceneSetup.trail = [];
    this.simulation.sceneSetup.updateTrail();

    // Update satellite position for rendering
    this.simulation.sceneSetup.satellite.position.copy(
      this.position.clone().multiplyScalar(this.simulation.SCALE_FACTOR)
    );
  }

  updatePhysics(deltaTime: number) {
    const dt = deltaTime * this.simulation.timeScale;

    // Calculate distance from Earth center
    const distance = this.position.length();

    // Check if satellite crashed into Earth
    if (distance <= this.simulation.EARTH_RADIUS) {
      const statusElement = document.getElementById("status");
      if (statusElement) {
        statusElement.textContent = "Crashed!";
      }
      return;
    }

    // Calculate gravitational force
    const forceMagnitude =
      (this.simulation.G * this.simulation.EARTH_MASS * this.mass) /
      (distance * distance);
    const forceDirection = this.position.clone().normalize().multiplyScalar(-1);
    const force = forceDirection.multiplyScalar(forceMagnitude);

    // Calculate acceleration (F = ma, so a = F/m)
    const acceleration = force.divideScalar(this.mass);

    // Update velocity and position
    this.velocity.add(acceleration.multiplyScalar(dt));
    this.position.add(this.velocity.clone().multiplyScalar(dt));

    // Add to trail
    if (
      this.simulation.sceneSetup.trail.length === 0 ||
      this.position.distanceTo(
        this.simulation.sceneSetup.trail[
          this.simulation.sceneSetup.trail.length - 1
        ]
      ) > 1000
    ) {
      this.simulation.sceneSetup.trail.push(this.position.clone());
      if (
        this.simulation.sceneSetup.trail.length >
        this.simulation.sceneSetup.maxTrailLength
      ) {
        this.simulation.sceneSetup.trail.shift();
      }
      this.simulation.sceneSetup.updateTrail();
    }

    // Update satellite visual position
    this.simulation.sceneSetup.satellite.position.copy(
      this.position.clone().multiplyScalar(this.simulation.SCALE_FACTOR)
    );

    // Update status
    const currentDistance = distance;
    const escapeVelocity = Math.sqrt(
      (2 * this.simulation.G * this.simulation.EARTH_MASS) / currentDistance
    );
    const currentSpeed = this.velocity.length();

    const statusElement = document.getElementById("status");
    if (statusElement) {
      if (currentSpeed > escapeVelocity) {
        statusElement.textContent = "Escaping!";
      } else {
        statusElement.textContent = "Orbiting";
      }
    }

    this.updateInfo();
  }

  updateInfo() {
    this.simulation.sceneSetup.updateInfo();
  }
}
