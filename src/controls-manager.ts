import SatelliteSimulation from "./simulation";

export default class ControlsManager {
  simulation: SatelliteSimulation;

  constructor(simulation: SatelliteSimulation) {
    this.simulation = simulation;
    this.setupControls();
  }

  setupControls() {
    // Sync sliders with number inputs
    const controls = [
      { slider: "simSpeed", input: "simSpeedVal" },
      { slider: "satSpeed", input: "satSpeedVal" },
      { slider: "height", input: "heightVal" },
      { slider: "mass", input: "massVal" },
      { slider: "velocity", input: "velocityVal" },
      { slider: "direction", input: "directionVal" },
      // Air resistance
      { slider: "dragCoeff", input: "dragCoeffVal" },
      { slider: "area", input: "areaVal" },
      { slider: "rho0", input: "rho0Val" },
      { slider: "scaleH", input: "scaleHVal" },
    ];

    controls.forEach(({ slider, input }) => {
      const sliderEl = document.getElementById(slider) as HTMLInputElement;
      const inputEl = document.getElementById(input) as HTMLInputElement;

      if (sliderEl && inputEl) {
        sliderEl.addEventListener("input", () => {
          inputEl.value = sliderEl.value;
          this.updateSimulation();
        });

        inputEl.addEventListener("input", () => {
          sliderEl.value = inputEl.value;
          this.updateSimulation();
        });
      }
    });

    const airEnabled = document.getElementById("airEnabled") as HTMLInputElement;
    if (airEnabled) {
      airEnabled.addEventListener("change", () => {
        this.updateSimulation();
      });
    }

    const keepCircular = document.getElementById("keepCircular") as HTMLInputElement;
    if (keepCircular) {
      keepCircular.addEventListener("change", () => {
        this.updateSimulation();
      });
    }

    const cameraModes = [ "free", "orbit", "follow" ] as const;

    cameraModes.forEach(cameraMode => {
      const btn = document.getElementById(cameraMode + "Cam");
      if (btn) {
        console.log(`Setting up camera mode button: ${cameraMode}Cam`);
        btn.addEventListener("click", () => {
          console.log(`Camera mode button clicked: ${cameraMode}`);
          this.simulation.cameraController.setMode(cameraMode);
        });
      } else {
        console.warn(`Camera mode button not found: ${cameraMode}Cam`);
      }
    });

         const simScenarios = [ "crash", "orbit", "escape" ] as const;

    simScenarios.forEach(scenario => {
      const btn = document.getElementById(scenario + "Scenario");
      if (btn) {
        btn.addEventListener("click", () => {
          this.setScenario(scenario);
        });
      }
    });

    // Control buttons
    const playPauseBtn = document.getElementById("playPause");
    if (playPauseBtn) {
      playPauseBtn.addEventListener("click", () => {
        this.simulation.toggleSimulation();
      });
    }

    const resetBtn = document.getElementById("reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        this.simulation.resetSatellite();
      });
    }
  }

     setScenario(scenario: "crash" | "orbit" | "escape") {
    const heightSlider = document.getElementById("height") as HTMLInputElement;
    const heightInput = document.getElementById(
      "heightVal"
    ) as HTMLInputElement;
    const velocitySlider = document.getElementById(
      "velocity"
    ) as HTMLInputElement;
    const velocityInput = document.getElementById(
      "velocityVal"
    ) as HTMLInputElement;
    const directionSlider = document.getElementById(
      "direction"
    ) as HTMLInputElement;
    const directionInput = document.getElementById(
      "directionVal"
    ) as HTMLInputElement;
    const keepCircularEl = document.getElementById("keepCircular") as HTMLInputElement;

    if (!heightSlider || !heightInput || !velocitySlider || !velocityInput || !directionSlider || !directionInput) return;

    // Compute dynamic velocities based on current height
    const heightKm = parseFloat(heightSlider.value);
    const r = this.simulation.EARTH_RADIUS + heightKm * 1000;
    const vCirc = Math.sqrt((this.simulation.G * this.simulation.EARTH_MASS) / r);
    const vEsc = Math.sqrt(2) * vCirc;

    switch (scenario) {
      case "crash":
        // Set satellite to a very low height and downward trajectory for guaranteed crash
        heightSlider.value = heightInput.value = "50"; // 50km - guaranteed to crash
        velocitySlider.value = velocityInput.value = "200"; // very low speed
        directionSlider.value = directionInput.value = "270"; // downward direction (270° = straight down)
        if (keepCircularEl) keepCircularEl.checked = false;
        
        // Show user what will happen
        console.log("Crash scenario: Satellite set to 50km height, 200 m/s, straight down - guaranteed crash!");
        break;
      case "orbit":
        // Ensure minimum safe orbital height (above atmosphere)
        const safeHeight = Math.max(200, heightKm); // At least 200km
        heightSlider.value = heightInput.value = safeHeight.toString();
        
        // Recalculate circular velocity for the safe height
        const safeRadius = this.simulation.EARTH_RADIUS + safeHeight * 1000;
        const safeCircularVelocity = Math.sqrt((this.simulation.G * this.simulation.EARTH_MASS) / safeRadius);
        
        velocitySlider.value = velocityInput.value = `${Math.round(safeCircularVelocity)}`;
        directionSlider.value = directionInput.value = "90";
        if (keepCircularEl) keepCircularEl.checked = true;
        break;
      case "escape":
        // For escape, use a velocity slightly above escape velocity
        const escapeVelocity = Math.sqrt((2 * this.simulation.G * this.simulation.EARTH_MASS) / r);
                 velocitySlider.value = velocityInput.value = `${Math.round(escapeVelocity * 1.05)}`;
         directionSlider.value = directionInput.value = "90";
         if (keepCircularEl) keepCircularEl.checked = false;
         break;

     }

    this.simulation.resetSatellite();
  }

  updateSimulation() {
    const simSpeedInput = document.getElementById(
      "simSpeed"
    ) as HTMLInputElement;
    if (simSpeedInput) {
      this.simulation.timeScale = parseFloat(simSpeedInput.value);
    }

    // Apply current UI values to the currently followed satellite only (no trail reset)
    this.simulation.applyCurrentSatelliteFromUI();
  }
}
