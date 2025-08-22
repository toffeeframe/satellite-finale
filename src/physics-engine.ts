import * as THREE from "three";
import SatelliteSimulation from "./simulation";

export default class PhysicsEngine {
  simulation: SatelliteSimulation;

  // Store state for each satellite (TODO better create class for it?)
  satellites: {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    mass: number;
    
    /* TODO implement usage */
    height?: number;
    targetHeight?: number; // For gradual height adjustments when keepCircular is disabled
    initialVelocity?: THREE.Vector3;
    velocityDirection?: number;

    /* TODO implement usage */
    dragCoefficient?: number;
    area?: number;
    initialDensity?: number;
    densityScaleHeight?: number;
    airEnabled?: boolean;
    timeScale?: number;
  }[] = [];

  constructor(simulation: SatelliteSimulation) {
    this.simulation = simulation;
    this.satellites = [];
    this.reset();
  }

  addSatelliteState(options?: { position?: THREE.Vector3; velocity?: THREE.Vector3; mass?: number; dragCoefficient?: number; area?: number; initialDensity?: number; densityScaleHeight?: number; airEnabled?: boolean; timeScale?: number }) {
    // Default values
    const height = options?.position?.length() || this.simulation.EARTH_RADIUS + 400000;
    const position = options?.position || new THREE.Vector3(height, 0, 0);
    
    // Calculate proper circular velocity for the given height
    const radius = height;
    const circularVelocity = Math.sqrt((this.simulation.G * this.simulation.EARTH_MASS) / radius);
    
    // Calculate tangential velocity for circular orbit (perpendicular to radius vector)
    let velocity: THREE.Vector3;
    if (options?.velocity) {
      // Use provided velocity if specified
      velocity = options.velocity;
      console.log(`Using provided velocity: ${velocity.length()} m/s at direction (${velocity.x.toFixed(0)}, ${velocity.y.toFixed(0)}, ${velocity.z.toFixed(0)})`);
    } else {
      // Create tangential velocity for circular orbit
      // For position at (radius, 0, 0), tangential velocity should be (0, circularVelocity, 0)
      // This creates a counterclockwise orbit in the XY plane
      velocity = new THREE.Vector3(0, circularVelocity, 0);
      console.log(`Created default circular velocity: ${circularVelocity.toFixed(0)} m/s for radius ${(radius/1000).toFixed(0)} km`);
    }
    
    const mass = options?.mass || 1000;
    const dragCoefficient = options?.dragCoefficient ?? 2.2;
    const area = options?.area ?? 4;
    const initialDensity = options?.initialDensity ?? 1.225;
    const densityScaleHeight = options?.densityScaleHeight ?? 8500;
    const airEnabled = options?.airEnabled ?? true;
    const timeScale = options?.timeScale ?? 1;
    
    console.log(`Adding satellite at position (${(position.x/1000).toFixed(0)}, ${(position.y/1000).toFixed(0)}, ${(position.z/1000).toFixed(0)}) km with velocity ${velocity.length().toFixed(0)} m/s`);
    
    /* TODO add more properties */
    this.satellites.push({ position: position.clone(), velocity: velocity.clone(), mass, dragCoefficient, area, initialDensity, densityScaleHeight, airEnabled, timeScale });
  }

  reset() {
    this.satellites = [];
    // Reset all satellites (should be called before re-adding them)
    // The SceneSetup will re-add satellites and trails
    this.simulation.sceneSetup.satellites = [];
    this.simulation.sceneSetup.trails = [];
    this.simulation.sceneSetup.trailLines = [];
  }

  updatePhysics(deltaTime: number) {
    for (let i = 0; i < this.satellites.length; i++) {
      const sat = this.satellites[i];
      // Per-satellite scaled dt
      let dt = deltaTime * this.simulation.timeScale * (sat.timeScale ?? 1);
      
      // Safety check: Limit time scale to prevent orbital instability and performance issues
      // For orbital mechanics, we need small time steps to maintain accuracy
      const maxSafeTimeScale = 20; // Reduced from 50 to prevent sluggishness
      const maxSatelliteTimeScale = 10; // Limit individual satellite time scale
      
      if (this.simulation.timeScale > maxSafeTimeScale) {
        console.warn(`Time scale ${this.simulation.timeScale} is too high for stable orbital mechanics. Limiting to ${maxSafeTimeScale}.`);
        dt = deltaTime * maxSafeTimeScale * (sat.timeScale ?? 1);
      }
      
      if ((sat.timeScale ?? 1) > maxSatelliteTimeScale) {
        console.warn(`Satellite time scale ${sat.timeScale} is too high. Limiting to ${maxSatelliteTimeScale}.`);
        dt = deltaTime * this.simulation.timeScale * maxSatelliteTimeScale;
      }
      
      // Ensure associated arrays exist to avoid runtime errors
      if (!this.simulation.sceneSetup.trails[i]) this.simulation.sceneSetup.trails[i] = [];

      // Debug: Log satellite state every 60 frames (about once per second at 60fps)
      if (this.simulation.sceneSetup.trails[i].length % 60 === 0) {
        const distance = sat.position.length();
        const altitude = (distance - this.simulation.EARTH_RADIUS) / 1000;
        const speed = sat.velocity.length();
        
        // Calculate orbital energy for stability monitoring
        const kineticEnergy = 0.5 * sat.mass * speed * speed;
        const potentialEnergy = -(this.simulation.G * this.simulation.EARTH_MASS * sat.mass) / distance;
        const totalEnergy = kineticEnergy + potentialEnergy;
        
        // Add crash warning when getting close to crash threshold
        const crashThresholdKm = 80;
        if (altitude <= crashThresholdKm + 10) { // Warning when within 10km of crash threshold
          console.warn(`⚠️ Satellite ${i + 1} getting close to crash! Altitude: ${altitude.toFixed(1)} km (crash at ${crashThresholdKm} km)`);
        }
        
        console.log(`Satellite ${i}: Altitude ${altitude.toFixed(1)} km, Speed ${speed.toFixed(0)} m/s, Energy ${(totalEnergy/1e9).toFixed(2)} GJ, Position (${(sat.position.x/1000).toFixed(0)}, ${(sat.position.y/1000).toFixed(0)}, ${(sat.position.z/1000).toFixed(0)}) km`);
      }

      // Skip physics for crashed satellites
      if ((sat as any).crashed) {
        continue;
      }
      
      // Auto-disable air resistance for escape scenarios (very high velocities)
      const velocityMagnitude = sat.velocity.length();
      const escapeVelocity = Math.sqrt((2 * this.simulation.G * this.simulation.EARTH_MASS) / sat.position.length());
      if (velocityMagnitude > escapeVelocity * 0.95) {
        // Near escape velocity - disable air resistance to prevent unrealistic effects
        sat.airEnabled = false;
      }
      
      // Auto-disable air resistance for very low altitudes (crash scenarios)
      const altitude = sat.position.length() - this.simulation.EARTH_RADIUS;
      if (altitude < 100000) { // Below 100km
        sat.airEnabled = false;
      }
      
      // Integrate with substeps for stability
      // For orbital mechanics, we need very small time steps to maintain accuracy
      const maxStep = 0.01; // seconds - reduced from 0.05 for better orbital stability
      const maxSubsteps = 50; // Prevent excessive substeps that cause sluggishness
      let substepCount = 0;
      
      while (dt > 0 && substepCount < maxSubsteps) {
        const step = Math.min(maxStep, dt);
        substepCount++;

        // Calculate distance from Earth center
        const distance = sat.position.length();
        const altitude = distance - this.simulation.EARTH_RADIUS;
        
        // Check if satellite crashed into Earth
        // Use a more realistic threshold - satellites can't survive below ~80km due to atmospheric heating
        const crashThreshold = 80000; // 80km above surface (more realistic)
        if (altitude <= crashThreshold) {
          console.log(`Satellite ${i + 1} altitude ${(altitude/1000).toFixed(1)}km <= crash threshold ${(crashThreshold/1000).toFixed(1)}km - CRASHING!`);
          this.handleSatelliteCrash(i);
          break;
        }

        // Calculate gravitational force
        const gravityMagnitude =
          (this.simulation.G * this.simulation.EARTH_MASS * sat.mass) /
          (distance * distance);
        const gravityDirection = sat.position.clone().normalize().multiplyScalar(-1);
        const gravityForce = gravityDirection.multiplyScalar(gravityMagnitude);

                 // Atmospheric drag - improved calculation with more noticeable effects
         let dragForce = new THREE.Vector3(0, 0, 0);
         if (sat.airEnabled) {
           const h = Math.max(0, distance - this.simulation.EARTH_RADIUS);
           
           // Enhanced atmospheric density model with more realistic values for orbital altitudes
           let rho;
           if (h < 11000) { // Troposphere (0-11km)
             rho = 1.225 * Math.pow(1 - 0.0065 * h / 288.15, 4.256);
           } else if (h < 20000) { // Lower stratosphere (11-20km)
             rho = 0.3639 * Math.exp(-(h - 11000) / 6341.6);
           } else if (h < 32000) { // Upper stratosphere (20-32km)
             rho = 0.0880 * Math.exp(-(h - 20000) / 7360.0);
           } else if (h < 47000) { // Lower mesosphere (32-47km)
             rho = 0.0132 * Math.exp(-(h - 32000) / 8000.0);
           } else if (h < 51000) { // Upper mesosphere (47-51km)
             rho = 0.00143 * Math.exp(-(h - 47000) / 7500.0);
           } else if (h < 71000) { // Lower thermosphere (51-71km)
             rho = 0.000086 * Math.exp(-(h - 51000) / 10000.0);
           } else if (h < 100000) { // Upper thermosphere (71-100km)
             rho = 0.0000032 * Math.exp(-(h - 71000) / 15000.0);
           } else if (h < 200000) { // Low Earth Orbit (100-200km) - enhanced density
             rho = 0.0000001 * Math.exp(-(h - 100000) / 25000.0);
           } else if (h < 500000) { // Medium Earth Orbit (200-500km) - enhanced density
             rho = 0.00000001 * Math.exp(-(h - 200000) / 100000.0);
           } else { // High Earth Orbit (500km+) - minimal but non-zero density
             rho = 0.000000001 * Math.exp(-(h - 500000) / 500000.0);
           }
           
           const v = sat.velocity.length();
           if (v > 1) { // Only apply drag if velocity is significant
             const Cd = sat.dragCoefficient ?? 2.2;
             const A = sat.area ?? 4;
             const dragMagnitude = 0.5 * rho * v * v * Cd * A;
             
             // Debug drag force at orbital altitudes
             if (h > 100000 && h < 500000) { // LEO altitudes
               console.log(`Drag at ${(h/1000).toFixed(1)}km: ρ=${rho.toExponential(3)} kg/m³, v=${v.toFixed(0)} m/s, F=${(dragMagnitude/1000).toFixed(2)} kN`);
             }
             
             const vhat = sat.velocity.clone().normalize();
             dragForce = vhat.multiplyScalar(-dragMagnitude);
           }
         }

        // Sum forces and integrate
        const totalForce = gravityForce.add(dragForce);
        const acceleration = totalForce.divideScalar(sat.mass);
        
        // Velocity Verlet integration for orbital stability
        // This method preserves energy much better than RK4 for orbital mechanics
        const velocityHalf = sat.velocity.clone().add(acceleration.clone().multiplyScalar(step * 0.5));
        sat.position.add(velocityHalf.clone().multiplyScalar(step));
        
        // Recalculate acceleration at new position for better accuracy
        const newDistance = sat.position.length();
        const newAltitude = newDistance - this.simulation.EARTH_RADIUS;
        
        // Check for crash after position update (catches fast-moving satellites)
        if (newAltitude <= crashThreshold) {
          console.log(`Satellite ${i + 1} new altitude ${(newAltitude/1000).toFixed(1)}km <= crash threshold ${(crashThreshold/1000).toFixed(1)}km - CRASHING after position update!`);
          this.handleSatelliteCrash(i);
          break;
        }
        
        const newGravityMagnitude = (this.simulation.G * this.simulation.EARTH_MASS * sat.mass) / (newDistance * newDistance);
        const newGravityDirection = sat.position.clone().normalize().multiplyScalar(-1);
        const newGravityForce = newGravityDirection.multiplyScalar(newGravityMagnitude);
        
        // Recalculate drag at new position
        let newDragForce = new THREE.Vector3(0, 0, 0);
        if (sat.airEnabled) {
          const h = Math.max(0, newDistance - this.simulation.EARTH_RADIUS);
          
          // Use the same enhanced atmospheric density model
          let rho;
          if (h < 11000) { // Troposphere (0-11km)
            rho = 1.225 * Math.pow(1 - 0.0065 * h / 288.15, 4.256);
          } else if (h < 20000) { // Lower stratosphere (11-20km)
            rho = 0.3639 * Math.exp(-(h - 11000) / 6341.6);
          } else if (h < 32000) { // Upper stratosphere (20-32km)
            rho = 0.0880 * Math.exp(-(h - 20000) / 7360.0);
          } else if (h < 47000) { // Lower mesosphere (32-47km)
            rho = 0.0132 * Math.exp(-(h - 32000) / 8000.0);
          } else if (h < 51000) { // Upper mesosphere (47-51km)
            rho = 0.00143 * Math.exp(-(h - 47000) / 7500.0);
          } else if (h < 71000) { // Lower thermosphere (51-71km)
            rho = 0.000086 * Math.exp(-(h - 51000) / 10000.0);
          } else if (h < 100000) { // Upper thermosphere (71-100km)
            rho = 0.0000032 * Math.exp(-(h - 71000) / 15000.0);
          } else if (h < 200000) { // Low Earth Orbit (100-200km) - enhanced density
            rho = 0.0000001 * Math.exp(-(h - 100000) / 25000.0);
          } else if (h < 500000) { // Medium Earth Orbit (200-500km) - enhanced density
            rho = 0.00000001 * Math.exp(-(h - 200000) / 100000.0);
          } else { // High Earth Orbit (500km+) - minimal but non-zero density
            rho = 0.000000001 * Math.exp(-(h - 500000) / 500000.0);
          }
          
          const v = velocityHalf.length();
          if (v > 1) { // Only apply drag if velocity is significant
            const Cd = sat.dragCoefficient ?? 2.2;
            const A = sat.area ?? 4;
            const dragMagnitude = 0.5 * rho * v * v * Cd * A;
            const vhat = velocityHalf.clone().normalize();
            newDragForce = vhat.multiplyScalar(-dragMagnitude);
          }
        }
        
        const newTotalForce = newGravityForce.add(newDragForce);
        const newAcceleration = newTotalForce.divideScalar(sat.mass);
        
        // Update velocity using the new acceleration
        sat.velocity.add(newAcceleration.clone().multiplyScalar(step));

        // Handle gradual height adjustments when targetHeight is set
        if (sat.targetHeight !== undefined) {
          const currentHeight = sat.position.length() - this.simulation.EARTH_RADIUS;
          const heightDiff = sat.targetHeight - currentHeight;
          
          if (Math.abs(heightDiff) > 100) { // Only adjust if difference is more than 100m
            const maxAdjustment = 500; // Max 500m adjustment per physics step
            const adjustment = Math.sign(heightDiff) * Math.min(Math.abs(heightDiff), maxAdjustment);
            
            // Adjust position radially while maintaining velocity
            const radialDir = sat.position.clone().normalize();
            sat.position.add(radialDir.multiplyScalar(adjustment));
          } else {
            // Clear target height when close enough
            sat.targetHeight = undefined;
          }
        }

        dt -= step;
      }

      // Trail update (decimated)
      if (
        this.simulation.sceneSetup.trails[i].length === 0 ||
        sat.position.distanceTo(
          this.simulation.sceneSetup.trails[i][
            this.simulation.sceneSetup.trails[i].length - 1
          ]
        ) > 1000
      ) {
        this.simulation.sceneSetup.trails[i].push(sat.position.clone());
        if (
          this.simulation.sceneSetup.trails[i].length >
          this.simulation.sceneSetup.maxTrailLength
        ) {
          this.simulation.sceneSetup.trails[i].shift();
        }
      }

      // Update satellite visual position (guard against missing mesh)
      const mesh = this.simulation.sceneSetup.satellites[i];
      if (mesh) {
        mesh.position.copy(
          sat.position.clone().multiplyScalar(this.simulation.SCALE_FACTOR)
        );
      }

      // Update status only for followed satellite
      const followed = this.simulation.cameraController.followSatelliteIndex;
      if (i === followed) {
        const currentDistance = sat.position.length();
        const escapeVelocity = Math.sqrt(
          (2 * this.simulation.G * this.simulation.EARTH_MASS) / currentDistance
        );
        const currentSpeed = sat.velocity.length();
        const statusElement = document.getElementById("status");
        if (statusElement) {
          if (currentSpeed > escapeVelocity * 1.1) { // Add 10% buffer
            statusElement.textContent = "Escaping!";
          } else if (currentSpeed > escapeVelocity * 0.9) {
            statusElement.textContent = "Near escape velocity";
          } else {
            statusElement.textContent = "Orbiting";
          }
        }
      }
    }
    this.simulation.sceneSetup.updateTrails();
    this.updateInfo();
  }

  updateInfo() {
    this.simulation.sceneSetup.updateInfo();
  }

  private handleSatelliteCrash(satelliteIndex: number) {
    console.log(`Handling crash for satellite ${satelliteIndex + 1}`);
    
    // Update status for all satellites (not just followed one)
    const statusElement = document.getElementById("status");
    if (statusElement) {
      statusElement.textContent = `Satellite ${satelliteIndex + 1}: Crashed!`;
      // Add visual emphasis to crashed status
      statusElement.style.color = "#ff4444";
      statusElement.style.fontWeight = "bold";
      statusElement.style.textShadow = "0 0 5px #ff0000";
    }
    
    // Hide the crashed satellite
    const mesh = this.simulation.sceneSetup.satellites[satelliteIndex];
    if (mesh) {
      mesh.visible = false;
      console.log(`Satellite ${satelliteIndex + 1} mesh hidden`);
    }
    
    // Clear the trail for the crashed satellite
    if (this.simulation.sceneSetup.trails[satelliteIndex]) {
      this.simulation.sceneSetup.trails[satelliteIndex] = [];
      console.log(`Satellite ${satelliteIndex + 1} trail cleared`);
    }
    
    // Mark satellite as crashed in physics state
    const sat = this.satellites[satelliteIndex];
    if (sat) {
      (sat as any).crashed = true;
      console.log(`Satellite ${satelliteIndex + 1} marked as crashed in physics state`);
    }
    
    // Add a crash effect - create a small explosion or flash
    this.createCrashEffect(satelliteIndex);
    
    // Show crash notification
    this.showCrashNotification(satelliteIndex);
    
    console.log(`Satellite ${satelliteIndex + 1} has crashed!`);
  }

  private createCrashEffect(satelliteIndex: number) {
    // Create a simple crash effect by adding a red flash to the scene
    const sat = this.satellites[satelliteIndex];
    if (!sat) return;
    
    // Create a red flash at the crash location
    const flashGeometry = new THREE.SphereGeometry(100, 8, 6);
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0.8
    });
    
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(sat.position.clone().multiplyScalar(this.simulation.SCALE_FACTOR));
    
    // Add flash to scene
    this.simulation.scene.add(flash);
    
    // Animate the flash (fade out and expand)
    let opacity = 0.8;
    let scale = 1;
    const animateFlash = () => {
      opacity -= 0.05;
      scale += 0.1;
      
      flash.material.opacity = opacity;
      flash.scale.setScalar(scale);
      
      if (opacity > 0) {
        requestAnimationFrame(animateFlash);
      } else {
        // Remove flash when animation is complete
        this.simulation.scene.remove(flash);
        flash.geometry.dispose();
        flash.material.dispose();
      }
    };
    
    animateFlash();
  }

  private showCrashNotification(satelliteIndex: number) {
    // Create a crash notification that appears on screen
    let notification = document.getElementById("crash-notification");
    
    if (!notification) {
      notification = document.createElement("div");
      notification.id = "crash-notification";
      notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #ff4444, #cc0000);
        color: white;
        padding: 20px 40px;
        border-radius: 10px;
        font-size: 24px;
        font-weight: bold;
        text-align: center;
        box-shadow: 0 0 20px rgba(255, 0, 0, 0.8);
        z-index: 1000;
        animation: crashPulse 2s ease-out;
      `;
      
      // Add CSS animation
      const style = document.createElement("style");
      style.textContent = `
        @keyframes crashPulse {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
        }
      `;
      document.head.appendChild(style);
      
      document.body.appendChild(notification);
    }
    
    notification.textContent = `🚀 Satellite ${satelliteIndex + 1} CRASHED! 💥`;
    
    // Remove notification after 3 seconds
    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
}
