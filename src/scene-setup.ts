import * as THREE from "three";
import SatelliteSimulation from "./simulation";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default class SceneSetup {
  simulation: SatelliteSimulation;

  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;

  // earth: THREE.Mesh;
  // satellite: THREE.Mesh;
  trailLine: THREE.Line;

  earth: THREE.Group;
  textureLoader: THREE.TextureLoader;

  satellite: THREE.Group;

  trailGeometry: THREE.BufferGeometry;
  trail: THREE.Vector3[] = [];
  maxTrailLength: number = 1000;
  sunLight!: THREE.DirectionalLight;
  nightLight!: THREE.AmbientLight;

  constructor(simulation: SatelliteSimulation) {
    this.simulation = simulation;

    // Scene setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000000
    );
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000011, 1);
    document.getElementById("container")?.appendChild(this.renderer.domElement);

    // Create Earth
    // this.earth = this.createEarth();
    // this.scene.add(this.earth);
    this.earth = new THREE.Group();
    this.loadEarthModel();
    this.textureLoader = new THREE.TextureLoader();

    // Create satellite
    // this.satellite = this.createSatellite();
    // this.scene.add(this.satellite);
    this.satellite = new THREE.Group();
    this.loadSatelliteModel();

    // Create trail
    this.trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({
      color: 0xff6b35,
      transparent: true,
      opacity: 0.8,
    });
    this.trailLine = new THREE.Line(this.trailGeometry, trailMaterial);
    this.scene.add(this.trailLine);

    // Add stars in the background
    this.addStars(2000);

    // Add lighting
    this.addLighting();

    // Camera position
    this.camera.position.set(0, 0, 800);
    this.camera.lookAt(0, 0, 0);
  }
  async loadEarthModel() {
    const loader = new GLTFLoader();
    try {
      // Set resource path for textures
      loader.setResourcePath("../assets/models/earth/textures");

      const earthData = await loader.loadAsync(
        "../assets/models/earth/earth 2.gltf"
      );
      const earthModel = earthData.scene;

      // Calculate proper scale based on Earth radius
      const earthRadius =
        this.simulation.EARTH_RADIUS * this.simulation.SCALE_FACTOR;
      const boundingBox = new THREE.Box3().setFromObject(earthModel);
      const size = boundingBox.getSize(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z);
      const scaleFactor = earthRadius / (maxDimension / 2);

      earthModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
      earthModel.rotation.x = Math.PI / 2;

      this.earth.add(earthModel);
      this.scene.add(this.earth);
    } catch (error) {
      console.error("Failed to load Earth model:", error);
      // Fallback to primitive sphere
      this.earth = this.createEarth();
      this.scene.add(this.earth);
    }
  }

  async loadSatelliteModel() {
    const loader = new GLTFLoader();
    try {
      const satData = await loader.loadAsync(
        "../assets/models/Satellite/Satellite.gltf"
      );
      const satModel = satData.scene;

      // Scale satellite model appropriately
      satModel.scale.set(0.01, 0.01, 0.01);

      this.satellite.add(satModel);
      this.scene.add(this.satellite);
    } catch (error) {
      console.error("Failed to load satellite model:", error);
      // Fallback to primitive sphere
      this.satellite = this.createSatellite();
    }
  }

  createEarth(): THREE.Group {
    const group = new THREE.Group();
    const earthGeometry = new THREE.SphereGeometry(
      this.simulation.EARTH_RADIUS * this.simulation.SCALE_FACTOR,
      64,
      64
    );

    // Load Earth textures
    const textureLoader = new THREE.TextureLoader();

    // Load all Earth textures
    const albedoTexture = textureLoader.load(
      "../assets/models/earth/textures/earth/earth_albedo.jpg"
    );
    const bumpTexture = textureLoader.load(
      "../assets/models/earth/textures/earth/earth_bump.jpg"
    );
    const specularTexture = textureLoader.load(
      "../assets/models/earth/textures/earth/earth_specular.jpg"
    );
    const oceanMaskTexture = textureLoader.load(
      "../assets/models/earth/textures/earth/earth_land_ocean_mask.png"
    );
    const nightLightsTexture = textureLoader.load(
      "../assets/models/earth/textures/earth/earth_night_lights_modified.png"
    );

    // Create complex Earth material
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: albedoTexture, // Main color texture
      bumpMap: bumpTexture, // Elevation/bump map
      specularMap: specularTexture, // Specular highlights
      bumpScale: 0.05, // Adjust bump intensity
      shininess: 30, // Adjust shininess
      specular: 0x222222, // Specular color
      emissive: 0x000000, // Base emissive color
      emissiveMap: nightLightsTexture, // Night lights texture
      alphaMap: oceanMaskTexture, // Land/ocean mask
    });

    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    group.add(earthMesh);
    return group;
  }

  createSatellite(): THREE.Group {
    const group = new THREE.Group();
    const satGeometry = new THREE.SphereGeometry(5, 16, 16);
    const satMaterial = new THREE.MeshPhongMaterial({
      color: 0xff6b35,
      emissive: 0x222222,
      shininess: 50,
    });

    const body = new THREE.Mesh(satGeometry, satMaterial);
    group.add(body);

    // Solar panels
    const panelGeometry = new THREE.BoxGeometry(20, 5, 1);
    const panelMaterial = new THREE.MeshPhongMaterial({
      color: 0x333333,
      emissive: 0x111111,
    });

    const panel1 = new THREE.Mesh(panelGeometry, panelMaterial);
    panel1.position.set(15, 0, 0);
    group.add(panel1);

    const panel2 = new THREE.Mesh(panelGeometry, panelMaterial);
    panel2.position.set(-15, 0, 0);
    group.add(panel2);

    return group;
  }

  addStars(count: number) {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.5,
      transparent: true,
    });

    const vertices = [];
    for (let i = 0; i < count; i++) {
      const x = THREE.MathUtils.randFloatSpread(2000);
      const y = THREE.MathUtils.randFloatSpread(2000);
      const z = THREE.MathUtils.randFloatSpread(2000);
      vertices.push(x, y, z);
    }

    starsGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    this.scene.add(starField);
  }

  addLighting() {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);

    // Create directional light for the sun
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.sunLight.position.set(100, 100, 50);
    this.scene.add(this.sunLight);

    // Add a second light for night side illumination
    this.nightLight = new THREE.AmbientLight(0x111133, 0.2);
    this.scene.add(this.nightLight);
  }

  updateTrail() {
    if (this.trail.length > 1) {
      const points = this.trail.map((pos) =>
        pos.clone().multiplyScalar(this.simulation.SCALE_FACTOR)
      );
      this.trailGeometry = new THREE.BufferGeometry();
      this.trailGeometry.setFromPoints(points);
      this.trailLine.geometry = this.trailGeometry;
    }
  }

  updateInfo() {
    const distance = this.simulation.physicsEngine.position.length();
    const altitude = (distance - this.simulation.EARTH_RADIUS) / 1000; // km
    const speed = this.simulation.physicsEngine.velocity.length(); // m/s
    const distanceFromEarth = distance / 1000; // km

    const altitudeElement = document.getElementById("currentAltitude");
    if (altitudeElement) {
      altitudeElement.textContent = `${altitude.toFixed(1)} km`;
    }

    const speedElement = document.getElementById("currentSpeed");
    if (speedElement) {
      speedElement.textContent = `${speed.toFixed(0)} m/s`;
    }

    const distanceElement = document.getElementById("currentDistance");
    if (distanceElement) {
      distanceElement.textContent = `${distanceFromEarth.toFixed(1)} km`;
    }
  }
}
