/**
 * TODO
 * 
 * [ ] implement ability to show state separately for each satellite in UI
 * [o] remove unnecessary assets...
 * [x] implement air resistance and update codebase to comply
 * [x] optimize performance for high simulation speeds
 * [x] remove low orbit button and set default height to 2000km
 * [x] auto-disable air resistance for escape/crash scenarios
 * [ ] is it possible to create objects by cloning without loading data each time?
 * [ ] write report
 */
import SatelliteSimulation from "./simulation";
import * as THREE from "three";
// main.ts
window.addEventListener("DOMContentLoaded", () => {
  // Handle window resize
  window.addEventListener("resize", () => {
    if (window.simulation) {
      window.simulation.camera.aspect = window.innerWidth / window.innerHeight;
      window.simulation.camera.updateProjectionMatrix();
      window.simulation.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  });

  // Start simulation
  window.simulation = new SatelliteSimulation();

  // Test orbital calculations
  const testHeight = 2000; // km - updated to match new default
  const testRadius = window.simulation.EARTH_RADIUS + testHeight * 1000;
  const testCircularVelocity = Math.sqrt((window.simulation.G * window.simulation.EARTH_MASS) / testRadius);
  const testOrbitalPeriod = (2 * Math.PI * testRadius) / testCircularVelocity;
  
  console.log(`=== ORBITAL MECHANICS TEST ===`);
  console.log(`Earth radius: ${(window.simulation.EARTH_RADIUS/1000).toFixed(0)} km`);
  console.log(`Test height: ${testHeight} km`);
  console.log(`Orbital radius: ${(testRadius/1000).toFixed(0)} km`);
  console.log(`Circular velocity: ${testCircularVelocity.toFixed(0)} m/s`);
  console.log(`Orbital period: ${(testOrbitalPeriod/60).toFixed(1)} minutes`);
  console.log(`Expected orbit: Counterclockwise in XY plane`);
  console.log(`=====================================`);

  // Set initial UI state
  const keepCircularEl = document.getElementById("keepCircular") as HTMLInputElement;
  if (keepCircularEl) keepCircularEl.checked = true;

  // --- Satellite UI logic ---
  
  // Function to handle height changes more gracefully
  function handleHeightChange(newHeightKm: number, satelliteIndex: number) {
    const sim = window.simulation;
    const state = sim.physicsEngine.satellites[satelliteIndex];
    if (!state) return;
    
    const keepCircularEl = document.getElementById("keepCircular") as HTMLInputElement;
    const isKeepCircular = keepCircularEl?.checked ?? false;
    
    if (isKeepCircular) {
      // When keeping circular, recalculate velocity for new height
      const newHeight = newHeightKm * 1000;
      const newRadius = sim.EARTH_RADIUS + newHeight;
      const newCircularVelocity = Math.sqrt((sim.G * sim.EARTH_MASS) / newRadius);
      
      // Update velocity to maintain circular orbit at new height
      const radial = state.position.clone().normalize();
      const tangential = new THREE.Vector3(-radial.y, radial.x, 0).normalize();
      state.velocity.copy(tangential.multiplyScalar(newCircularVelocity));
      
      // Update position to new height
      state.position.copy(radial.multiplyScalar(newRadius));
      
      // Update visual position
      const mesh = sim.sceneSetup.satellites[satelliteIndex];
      if (mesh) {
        mesh.position.copy(state.position.clone().multiplyScalar(sim.SCALE_FACTOR));
      }
      
      // Update velocity UI to show the correct circular velocity
      const velocitySlider = document.getElementById("velocity") as HTMLInputElement;
      const velocityInput = document.getElementById("velocityVal") as HTMLInputElement;
      if (velocitySlider && velocityInput) {
        const velocityValue = Math.round(newCircularVelocity);
        velocitySlider.value = velocityValue.toString();
        velocityInput.value = velocityValue.toString();
      }
      
      // Calculate and display orbital period for reference
      const orbitalPeriod = (2 * Math.PI * newRadius) / newCircularVelocity;
      const orbitalPeriodMinutes = Math.round(orbitalPeriod / 60);
      
      // Try to find or create an orbital info display
      let orbitalInfoEl = document.getElementById("orbital-info");
      if (!orbitalInfoEl) {
        orbitalInfoEl = document.createElement("div");
        orbitalInfoEl.id = "orbital-info";
        orbitalInfoEl.style.cssText = "margin-top: 10px; padding: 8px; background: rgba(0,0,0,0.1); border-radius: 4px; font-size: 12px;";
        const controlsDiv = document.getElementById("satellite-controls");
        if (controlsDiv) {
          controlsDiv.appendChild(orbitalInfoEl);
        }
      }
      orbitalInfoEl.textContent = `Circular orbit at ${newHeightKm}km: ${orbitalPeriodMinutes} minutes period`;
    } else {
      // When not keeping circular, store the desired height for gradual adjustment
      state.targetHeight = newHeightKm * 1000;
      
      // Still update the velocity UI to show what the circular velocity would be
      const newHeight = newHeightKm * 1000;
      const newRadius = sim.EARTH_RADIUS + newHeight;
      const newCircularVelocity = Math.sqrt((sim.G * sim.EARTH_MASS) / newRadius);
      
      const velocitySlider = document.getElementById("velocity") as HTMLInputElement;
      const velocityInput = document.getElementById("velocityVal") as HTMLInputElement;
      if (velocitySlider && velocityInput) {
        const velocityValue = Math.round(newCircularVelocity);
        velocitySlider.value = velocityValue.toString();
        velocityInput.value = velocityValue.toString();
      }
      
      // Calculate and display orbital period for reference
      const orbitalPeriod = (2 * Math.PI * newRadius) / newCircularVelocity;
      const orbitalPeriodMinutes = Math.round(orbitalPeriod / 60);
      
      // Try to find or create an orbital info display
      let orbitalInfoEl = document.getElementById("orbital-info");
      if (!orbitalInfoEl) {
        orbitalInfoEl = document.createElement("div");
        orbitalInfoEl.id = "orbital-info";
        orbitalInfoEl.style.cssText = "margin-top: 10px; padding: 8px; background: rgba(0,0,0,0.1); border-radius: 4px; font-size: 12px;";
        const controlsDiv = document.getElementById("satellite-controls");
        if (controlsDiv) {
          controlsDiv.appendChild(orbitalInfoEl);
        }
      }
      orbitalInfoEl.textContent = `Circular orbit at ${newHeightKm}km: ${orbitalPeriodMinutes} minutes period`;
    }
  }
  
  function updateSatelliteUI() {
    const sim = window.simulation;
    const list = document.getElementById("satellite-list");
    const followSelect = document.getElementById("followSelect") as HTMLSelectElement;
    if (!list || !followSelect) return;
    // Clear
    list.innerHTML = "";
    followSelect.innerHTML = "";
    // List satellites
    sim.sceneSetup.satellites.forEach((sat, i) => {
      const div = document.createElement("div");
      div.textContent = `Satellite ${i + 1}`;
      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.onclick = () => {
        // Remove satellite and its state
        if (sat) {
          sim.scene.remove(sat);
        }
        if (sim.sceneSetup.satellites[i]) sim.sceneSetup.satellites.splice(i, 1);
        if (sim.sceneSetup.trails[i]) sim.sceneSetup.trails.splice(i, 1);
        if (sim.sceneSetup.trailLines[i]) {
          const tl = sim.sceneSetup.trailLines[i];
          if (tl.geometry) tl.geometry.dispose();
          sim.scene.remove(tl);
          sim.sceneSetup.trailLines.splice(i, 1);
        }
        if (sim.physicsEngine.satellites[i]) sim.physicsEngine.satellites.splice(i, 1);
        // Clamp follow index
        const count = sim.sceneSetup.satellites.length;
        if (count === 0) {
          sim.cameraController.followSatelliteIndex = 0;
        } else if (sim.cameraController.followSatelliteIndex >= count) {
          sim.cameraController.followSatelliteIndex = count - 1;
        }
        updateSatelliteUI();
        // Populate UI from newly followed satellite if any
        const idx = sim.cameraController.followSatelliteIndex;
        if (count > 0 && idx >= 0) {
          loadSelectedSatelliteIntoUI(idx);
        }
      };
      div.appendChild(delBtn);
      list.appendChild(div);
      // Add to follow dropdown
      const opt = document.createElement("option");
      opt.value = i.toString();
      opt.textContent = `Satellite ${i + 1}`;
      followSelect.appendChild(opt);
    });
    // Set dropdown to current follow index
    followSelect.value = sim.cameraController.followSatelliteIndex.toString();
  }

  function loadSelectedSatelliteIntoUI(idx: number) {
    const sim = window.simulation;
    const state = sim.physicsEngine.satellites[idx];
    if (!state) return;
    // Compute UI values from state
    const distance = state.position.length();
    const altitudeKm = Math.max(0, (distance - sim.EARTH_RADIUS) * 0.001);
    const speed = state.velocity.length();
    const dirRad = Math.atan2(state.velocity.y, state.velocity.x);
    let dirDeg = (dirRad * 180) / Math.PI;
    if (dirDeg < 0) dirDeg += 360;

    const pairs: { slider: string; input: string; value: number }[] = [
      { slider: "height", input: "heightVal", value: altitudeKm },
      { slider: "mass", input: "massVal", value: state.mass },
      { slider: "velocity", input: "velocityVal", value: speed },
      { slider: "direction", input: "directionVal", value: dirDeg },
      // Air parameters
      { slider: "dragCoeff", input: "dragCoeffVal", value: state.dragCoefficient ?? 2.2 },
      { slider: "area", input: "areaVal", value: state.area ?? 4 },
      { slider: "rho0", input: "rho0Val", value: state.initialDensity ?? 1.225 },
      { slider: "scaleH", input: "scaleHVal", value: state.densityScaleHeight ?? 8500 },
      // Per-satellite speed
      { slider: "satSpeed", input: "satSpeedVal", value: (state as any).timeScale ?? 1 },
    ];

    pairs.forEach(({ slider, input, value }) => {
      const sliderEl = document.getElementById(slider) as HTMLInputElement;
      const inputEl = document.getElementById(input) as HTMLInputElement;
      if (sliderEl && inputEl) {
        const valStr = `${value}`;
        sliderEl.value = valStr;
        inputEl.value = valStr;
      }
    });

    const airEnabledEl = document.getElementById("airEnabled") as HTMLInputElement;
    if (airEnabledEl) {
      airEnabledEl.checked = state.airEnabled ?? true;
      
      // Add visual indicator for auto-disabled air resistance
      const airResistanceGroup = airEnabledEl.closest('.control-group');
      if (airResistanceGroup) {
        // Remove existing indicator
        const existingIndicator = airResistanceGroup.querySelector('.auto-disable-indicator');
        if (existingIndicator) existingIndicator.remove();
        
        // Add indicator if air resistance is disabled
        if (!state.airEnabled) {
          const indicator = document.createElement('div');
          indicator.className = 'auto-disable-indicator';
          indicator.style.cssText = 'color: #ff6b6b; font-size: 12px; margin-top: 5px; font-style: italic;';
          indicator.textContent = 'Auto-disabled for current scenario';
          airResistanceGroup.appendChild(indicator);
        }
      }
    }
    const keepCircularEl = document.getElementById("keepCircular") as HTMLInputElement;
    if (keepCircularEl) keepCircularEl.checked = true;
  }

  document.getElementById("addSatelliteBtn")?.addEventListener("click", async () => {
    const resetAfterAdd = (document.getElementById("resetAfterAdd") as HTMLInputElement)?.checked ?? false;

    // Safe default values
    const defaults = {
      heightKm: 2000, // Increased to 2000km for higher orbit
      mass: 1000,
      velocity: 7800,
      directionDeg: 90,
      airEnabled: true,
      dragCoefficient: 2.2,
      area: 4,
      rho0: 1.225,
      scaleH: 8500,
      timeScale: 1,
    };

    // Always use defaults for new satellites
    const heightKm = defaults.heightKm;
    const mass = defaults.mass;
    const velocityMagInitial = defaults.velocity;
    const directionDeg = defaults.directionDeg;
    const airEnabled = defaults.airEnabled;
    const dragCoefficient = defaults.dragCoefficient;
    const area = defaults.area;
    const initialDensity = defaults.rho0;
    const densityScaleHeight = defaults.scaleH;
    const timeScale = defaults.timeScale;

    const earthRadius = window.simulation.EARTH_RADIUS;
    const height = heightKm * 1000;
    const r = earthRadius + height;
    const x = r;
    const y = 0;
    const z = 0;

    // Calculate proper circular velocity for the given height
    const vCirc = Math.sqrt((window.simulation.G * window.simulation.EARTH_MASS) / r);
    
    // Always use tangential velocity for circular orbit
    // For position at (r, 0, 0), tangential velocity should be (0, vCirc, 0)
    // This creates a perfect counterclockwise orbit in the XY plane
    const velocity = new THREE.Vector3(0, vCirc, 0);
    
    // Verify that velocity is perpendicular to position (dot product should be 0)
    const dotProduct = x * velocity.x + y * velocity.y + z * velocity.z;
    if (Math.abs(dotProduct) > 1e-10) {
      console.warn(`Warning: Velocity not perfectly perpendicular to position. Dot product: ${dotProduct}`);
    }
    
    console.log(`Creating satellite with:`);
    console.log(`  Position: (${(x/1000).toFixed(0)}, ${(y/1000).toFixed(0)}, ${(z/1000).toFixed(0)}) km`);
    console.log(`  Velocity: (${velocity.x.toFixed(0)}, ${velocity.y.toFixed(0)}, ${velocity.z.toFixed(0)}) m/s`);
    console.log(`  Circular velocity: ${vCirc.toFixed(0)} m/s`);
    console.log(`  Orbital radius: ${(r/1000).toFixed(0)} km`);
    console.log(`  Expected orbital period: ${((2 * Math.PI * r) / vCirc / 60).toFixed(0)} minutes`);

    await window.simulation.sceneSetup.addSatellite({
      position: new THREE.Vector3(x, y, z),
      velocity,
      mass,
      dragCoefficient,
      area,
      initialDensity,
      densityScaleHeight,
      airEnabled,
      timeScale
    } as any);

    // Follow new satellite and optionally reset fields
    const sim = window.simulation;
    sim.cameraController.followSatelliteIndex = sim.sceneSetup.satellites.length - 1;
    updateSatelliteUI();
    if (resetAfterAdd) {
      const setPair = (sliderId: string, inputId: string, val: number) => {
        const s = document.getElementById(sliderId) as HTMLInputElement;
        const i = document.getElementById(inputId) as HTMLInputElement;
        if (s) s.value = `${val}`;
        if (i) i.value = `${val}`;
      };
      setPair("height", "heightVal", defaults.heightKm);
      setPair("mass", "massVal", defaults.mass);
      
      // Calculate and set the correct circular velocity for the default height
      const earthRadius = sim.EARTH_RADIUS;
      const defaultHeight = defaults.heightKm * 1000;
      const defaultRadius = earthRadius + defaultHeight;
      const defaultCircularVelocity = Math.sqrt((sim.G * sim.EARTH_MASS) / defaultRadius);
      
      setPair("velocity", "velocityVal", Math.round(defaultCircularVelocity));
      setPair("direction", "directionVal", defaults.directionDeg);
      
      setPair("dragCoeff", "dragCoeffVal", defaults.dragCoefficient);
      setPair("area", "areaVal", defaults.area);
      setPair("rho0", "rho0Val", defaults.rho0);
      setPair("scaleH", "scaleHVal", defaults.scaleH);
      setPair("satSpeed", "satSpeedVal", defaults.timeScale);
      const air = document.getElementById("airEnabled") as HTMLInputElement;
      if (air) air.checked = defaults.airEnabled;
      const keep = document.getElementById("keepCircular") as HTMLInputElement;
      if (keep) keep.checked = true;
      // Apply to currently followed (new) satellite only
      sim.applyCurrentSatelliteFromUI();
    }
  });

  document.getElementById("followSelect")?.addEventListener("change", (e) => {
    const idx = parseInt((e.target as HTMLSelectElement).value, 10);
    window.simulation.cameraController.followSatelliteIndex = idx;
    // Update UI to reflect the newly selected satellite's state without applying changes
    loadSelectedSatelliteIntoUI(idx);
    
    /* TODO update UI based on selection */
  });

  // Initial UI update after satellites are created
  setTimeout(() => {
    updateSatelliteUI();
    const sim = window.simulation;
    if (sim.physicsEngine.satellites.length > 0) {
      loadSelectedSatelliteIntoUI(sim.cameraController.followSatelliteIndex);
    }
    
    // Synchronize UI with correct orbital parameters
    const heightSlider = document.getElementById("height") as HTMLInputElement;
    const heightInput = document.getElementById("heightVal") as HTMLInputElement;
    const velocitySlider = document.getElementById("velocity") as HTMLInputElement;
    const velocityInput = document.getElementById("velocityVal") as HTMLInputElement;
    
    if (heightSlider && heightInput && velocitySlider && velocityInput) {
      const defaultHeight = 2000; // km - updated to match new default
      const earthRadius = sim.EARTH_RADIUS;
      const defaultRadius = earthRadius + defaultHeight * 1000;
      const defaultCircularVelocity = Math.sqrt((sim.G * sim.EARTH_MASS) / defaultRadius);
      
      // Update UI to show correct values
      heightSlider.value = heightInput.value = defaultHeight.toString();
      velocitySlider.value = velocityInput.value = Math.round(defaultCircularVelocity).toString();
      
      console.log(`UI synchronized: Height ${defaultHeight} km, Velocity ${Math.round(defaultCircularVelocity)} m/s`);
    }
    
    // Add event listeners for height changes
    if (heightSlider && heightInput) {
      const handleHeightUpdate = () => {
        const currentFollowIndex = sim.cameraController.followSatelliteIndex;
        if (currentFollowIndex >= 0 && currentFollowIndex < sim.physicsEngine.satellites.length) {
          const newHeight = parseFloat(heightSlider.value);
          handleHeightChange(newHeight, currentFollowIndex);
        }
      };
      
      heightSlider.addEventListener("input", handleHeightUpdate);
      heightInput.addEventListener("input", handleHeightUpdate);
    }
  }, 500);
});
