import { uniform } from "three/tsl";
import * as THREE from "three/webgpu";

import { useAppStore } from "../app/app-store";
import type { FeatureFlags } from "../app/feature-flags";
import {
  computeMoonPlacement,
  type MoonPlacement,
  rayToAltAzDeg,
} from "../astronomy/moon-placement";
import { computeMoonOrbitEqjM, moonGeoEqjM } from "../astronomy/moon-orbit";
import { eclipticDirectionEqj, eclipticNorthEqj } from "../astronomy/planet-orbits";
import { type BrightStar, chooseOpeningTarget } from "../astronomy/opening-target";
import {
  altAzToLocalThree,
  computeSkyState,
  computeSunHorizonEvents,
  MOON_RADIUS_M,
  type SkyState,
} from "../astronomy/sky-state";
import { stepCriticalSpring, type SpringState } from "../camera/camera-spring";
import { formatDistanceParts } from "../camera/distance-format";
import {
  earthMoonCompositionForAltitude,
  journeyCompositionForSlider,
  nadirBlendForAltitude,
  OBSERVER_SWING_RAD,
  REVEAL_NORTH_LIFT,
  revealBlendForAltitude,
  systemCompositionForAltitude,
  vantageSwingBlendForAltitude,
  wholeEarthFovDegForAspect,
} from "../camera/camera-compositions";
import {
  distanceToSlider,
  earthRenderRadiusForAltitude,
  JOURNEY_MIN_DISTANCE_M,
  nearPlaneRenderUnitsForAltitude,
  renderUnitsPerMeterForAltitude,
  scaleDomainForDistance,
  sliderToDistance,
} from "../camera/scale-domains";
import { EARTH_MEAN_RADIUS_M } from "../coordinates/units";
import {
  createContinentOutlines,
  observerToZenithQuaternion,
} from "../scene/earth/continent-outlines";
import { createEarthGlobeMaterial, loadEarthTextures } from "../scene/earth/earth-globe";
import { createAxisStubs, createEarthGuides } from "../scene/earth/earth-guides";
import { SatellitePatches } from "../scene/earth/satellite-patch";
import { buildGlowTexture, SkyLayer } from "../scene/sky/sky-layer";
import { SolarSystemLayer } from "../scene/sky/solar-system-layer";
import {
  STAR_COUNT,
  STAR_DEC_DEG,
  STAR_MAG,
  STAR_NAMES,
  STAR_RA_DEG,
} from "../scene/sky/star-catalog";
import { SimulationClock } from "../simulation/simulation-clock";
import { subtractVec3d, type Vec3d } from "../coordinates/vec3d";
import { type MoonMarkerOverride, type PlaneGuideAnchor, SkyOverlay } from "../ui/sky-overlay";
import { createRenderer } from "./renderer-factory";

/** Rotate an EQJ-frame vector into the local Three frame (row-major matrix). */
function rotateEqjToLocal(m: SkyState["eqjToLocalThree"], [x, y, z]: Vec3d): Vec3d {
  return [
    m[0] * x + m[1] * y + m[2] * z,
    m[3] * x + m[4] * y + m[5] * z,
    m[6] * x + m[7] * y + m[8] * z,
  ];
}

const NAMED_BRIGHT_STARS: readonly BrightStar[] = STAR_NAMES.map(([index, name]) => ({
  name,
  raDeg: STAR_RA_DEG[index]!,
  decDeg: STAR_DEC_DEG[index]!,
  magnitude: STAR_MAG[index]!,
}));

function wrapAngleRad(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

type SceneObjects = {
  earth: THREE.Mesh;
  atmosphereInside: THREE.Mesh;
  atmosphereOutside: THREE.Mesh;
  localCap: THREE.Mesh;
  observerMarker: THREE.Mesh;
  coordinateGrid: THREE.LineSegments;
  continentOutlines: THREE.LineSegments;
  keyLight: THREE.DirectionalLight;
  fillLight: THREE.HemisphereLight;
};

const TELEMETRY_INTERVAL_MS = 200;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function createCoordinateGrid(): THREE.LineSegments {
  const points: number[] = [];
  const segmentCount = 96;

  const addSegment = (a: THREE.Vector3, b: THREE.Vector3) => {
    points.push(a.x, a.y, a.z, b.x, b.y, b.z);
  };

  for (let latitudeDeg = -60; latitudeDeg <= 60; latitudeDeg += 30) {
    const latitude = THREE.MathUtils.degToRad(latitudeDeg);
    for (let segment = 0; segment < segmentCount; segment += 1) {
      const longitudeA = (segment / segmentCount) * Math.PI * 2;
      const longitudeB = ((segment + 1) / segmentCount) * Math.PI * 2;
      const radius = Math.cos(latitude);
      addSegment(
        new THREE.Vector3(
          radius * Math.cos(longitudeA),
          Math.sin(latitude),
          radius * Math.sin(longitudeA),
        ),
        new THREE.Vector3(
          radius * Math.cos(longitudeB),
          Math.sin(latitude),
          radius * Math.sin(longitudeB),
        ),
      );
    }
  }

  for (let longitudeDeg = 0; longitudeDeg < 180; longitudeDeg += 30) {
    const longitude = THREE.MathUtils.degToRad(longitudeDeg);
    for (let segment = 0; segment < segmentCount; segment += 1) {
      const angleA = (segment / segmentCount) * Math.PI * 2;
      const angleB = ((segment + 1) / segmentCount) * Math.PI * 2;
      addSegment(
        new THREE.Vector3(
          Math.sin(angleA) * Math.cos(longitude),
          Math.cos(angleA),
          Math.sin(angleA) * Math.sin(longitude),
        ),
        new THREE.Vector3(
          Math.sin(angleB) * Math.cos(longitude),
          Math.cos(angleB),
          Math.sin(angleB) * Math.sin(longitude),
        ),
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x8fd5d5,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
  });
  return new THREE.LineSegments(geometry, material);
}

function createSceneObjects(
  scene: THREE.Scene,
  observerLatitudeDeg: number,
  observerLongitudeDeg: number,
): SceneObjects {
  const earthMaterial = new THREE.MeshStandardMaterial({
    color: 0x123d48,
    roughness: 0.82,
    metalness: 0.02,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 256, 128), earthMaterial);

  const insideMaterial = new THREE.MeshBasicMaterial({
    color: 0x338a9c,
    transparent: true,
    opacity: 0.36,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const atmosphereInside = new THREE.Mesh(new THREE.SphereGeometry(1.025, 192, 96), insideMaterial);
  atmosphereInside.renderOrder = -2;

  const outsideMaterial = new THREE.MeshBasicMaterial({
    color: 0x56c6dc,
    transparent: true,
    opacity: 0.18,
    side: THREE.FrontSide,
    depthWrite: false,
  });
  const atmosphereOutside = new THREE.Mesh(
    new THREE.SphereGeometry(1.025, 192, 96),
    outsideMaterial,
  );
  atmosphereOutside.renderOrder = 2;

  const capMaterial = new THREE.MeshStandardMaterial({
    color: 0x0f3036,
    roughness: 0.9,
    transparent: true,
    opacity: 1,
    depthWrite: true,
  });
  const localCap = new THREE.Mesh(new THREE.CircleGeometry(1, 128), capMaterial);
  localCap.rotation.x = -Math.PI / 2;

  // Maps-style blue: a deep-blue "you are here" dot inside ONE soft
  // light-blue glow (radial-gradient sprite, no hard shell edges) — the
  // glow reads on bright imagery and dark night ground alike.
  const observerMarker = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0x1d5bd8, transparent: true, opacity: 0 }),
  );
  const glowSize = 128;
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowSize;
  glowCanvas.height = glowSize;
  const glowContext = glowCanvas.getContext("2d");
  if (glowContext) {
    const gradient = glowContext.createRadialGradient(
      glowSize / 2,
      glowSize / 2,
      0,
      glowSize / 2,
      glowSize / 2,
      glowSize / 2,
    );
    // Light BLUE throughout — a near-white core read as a white rim around
    // the dot on-device.
    gradient.addColorStop(0, "rgba(178, 208, 255, 0.9)");
    gradient.addColorStop(0.3, "rgba(148, 188, 255, 0.5)");
    gradient.addColorStop(0.65, "rgba(126, 172, 255, 0.14)");
    gradient.addColorStop(1, "rgba(126, 172, 255, 0)");
    glowContext.fillStyle = gradient;
    glowContext.fillRect(0, 0, glowSize, glowSize);
  }
  const observerGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowCanvas),
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 0,
    }),
  );
  observerGlow.name = "observer-glow";
  observerGlow.scale.setScalar(4.2);
  observerGlow.renderOrder = 2.4;
  observerMarker.add(observerGlow);

  const coordinateGrid = createCoordinateGrid();
  const continentOutlines = createContinentOutlines(observerLatitudeDeg, observerLongitudeDeg);

  const keyLight = new THREE.DirectionalLight(0xffeed2, 2.6);
  const fillLight = new THREE.HemisphereLight(0x88c9db, 0x031014, 0.85);
  scene.add(
    atmosphereInside,
    earth,
    coordinateGrid,
    continentOutlines,
    observerMarker,
    localCap,
    atmosphereOutside,
    keyLight,
    keyLight.target,
    fillLight,
  );

  return {
    earth,
    atmosphereInside,
    atmosphereOutside,
    localCap,
    observerMarker,
    coordinateGrid,
    continentOutlines,
    keyLight,
    fillLight,
  };
}

export class SpaceRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly flags: FeatureFlags;
  private readonly simulationClock: SimulationClock;
  private renderer: THREE.WebGPURenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private objects: SceneObjects | null = null;
  private skyLayer: SkyLayer | null = null;
  private solarLayer: SolarSystemLayer | null = null;
  private skyState: SkyState | null = null;
  /** Geocentric body positions in local-frame meters, cached per astronomy tick. */
  private readonly bodyGeoLocalM = new Map<string, Vec3d>();
  private readonly bodyRadiusM = new Map<string, number>();
  private overlay: SkyOverlay | null = null;
  private readonly overlayRoot: HTMLElement | null;
  private lookTarget: { azimuthDeg: number; altitudeDeg: number } | null = null;
  private lastAstronomyUtcMs = Number.NEGATIVE_INFINITY;
  private lastOrbitUtcMs = Number.NEGATIVE_INFINITY;
  private lastSunEventsUtcMs = Number.NEGATIVE_INFINITY;
  private moonPlacement: MoonPlacement | null = null;
  private readonly sunDirectionLocal = new THREE.Vector3(0, 1, 0);
  private readonly sunDirectionUniform = uniform(new THREE.Vector3(0, 1, 0));
  private readonly surfaceFlattenUniform = uniform(1);
  private readonly eclipticNorthLocal = new THREE.Vector3(0, 1, 0);
  /** Ecliptic-plane basis in the local frame (longitude 0° and 90°), for
   * reading a gaze direction's ecliptic longitude back out. */
  private readonly eclipticE1Local = new THREE.Vector3(1, 0, 0);
  private readonly eclipticE2Local = new THREE.Vector3(0, 0, -1);
  private planeGuideAnchors: PlaneGuideAnchor[] = [];
  /** Unit direction from Earth's center to the camera, local frame. */
  private readonly cameraDirLocal = new THREE.Vector3(0, 1, 0);
  private readonly arcQuaternion = new THREE.Quaternion();
  private compassSmoothed: THREE.Quaternion | null = null;
  private moonGeoLocalM: Vec3d | null = null;
  private readoutElement: HTMLElement | null = null;
  private earthGuides: THREE.LineSegments | null = null;
  private axisStubs: THREE.LineSegments | null = null;
  private satellitePatches: SatellitePatches | null = null;
  private imageryCreditElement: HTMLElement | null = null;
  private slowFrameStreak = 0;
  private adaptiveDprCap = Number.POSITIVE_INFINITY;
  private lastDprDropMs = 0;
  private sunAltitudeDeg = -90;
  private distanceSpring: SpringState = {
    value: Math.log(JOURNEY_MIN_DISTANCE_M),
    velocity: 0,
  };
  private yawOffset = 0;
  private pitchOffset = 0;
  private guidanceRequested = false;
  private previousTargetLogMeters = Math.log(JOURNEY_MIN_DISTANCE_M);
  private pointerId: number | null = null;
  private lastPointer = { x: 0, y: 0 };
  private pointerDownAt = { x: 0, y: 0, timeMs: 0 };
  private pointerTravelPx = 0;
  private previousFrameMs = 0;
  private telemetryAtMs = 0;
  private frameSamplesMs: number[] = [];
  private infoCallsAtLastSample = 0;
  private framesSinceTelemetry = 0;
  private disposed = false;
  private readonly cleanupCallbacks: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement, flags: FeatureFlags, overlayRoot?: HTMLElement | null) {
    this.canvas = canvas;
    this.flags = flags;
    this.overlayRoot = overlayRoot ?? null;
    this.simulationClock = new SimulationClock(flags.initialUtcMs);
  }

  async initialize(): Promise<void> {
    const bundle = await createRenderer(this.canvas, this.flags.renderer, this.flags.depth);
    // React StrictMode mounts, disposes, and remounts; if dispose ran while
    // the renderer was being created, do not boot a zombie instance. Do NOT
    // dispose the bundle either: it shares the canvas context with the live
    // remounted instance, and disposing it kills that context.
    if (this.disposed) return;
    this.renderer = bundle.renderer;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020711);
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.00001, 50_000);
    this.camera.position.set(0, 0, 0);
    this.objects = createSceneObjects(this.scene, this.flags.latitudeDeg, this.flags.longitudeDeg);
    this.skyLayer = new SkyLayer();
    this.scene.add(this.skyLayer.group);
    this.solarLayer = new SolarSystemLayer(buildGlowTexture());
    this.scene.add(this.solarLayer.group);
    this.earthGuides = createEarthGuides(this.flags.latitudeDeg, this.flags.longitudeDeg);
    this.scene.add(this.earthGuides);
    this.axisStubs = createAxisStubs(this.flags.latitudeDeg, this.flags.longitudeDeg);
    this.scene.add(this.axisStubs);
    // Close-up satellite imagery around the observer. Precached shortly
    // AFTER startup: 64 parallel tile fetches during renderer init starve
    // the first frames on phones, and the imagery only matters above 15 m.
    window.setTimeout(() => {
      // A location change may have created the patches already.
      if (this.disposed || !this.scene || this.satellitePatches) return;
      this.satellitePatches = new SatellitePatches(this.flags.latitudeDeg, this.flags.longitudeDeg);
      this.scene.add(this.satellitePatches.group);
    }, 2_500);

    // Real Earth imagery loads after the opening scene; the flat-shaded globe
    // stands in until then and remains the fallback if loading fails.
    void loadEarthTextures(import.meta.env.BASE_URL).then((textures) => {
      if (!textures || this.disposed || !this.objects) return;
      this.objects.earth.material = createEarthGlobeMaterial(
        textures.day,
        textures.night,
        this.sunDirectionUniform,
        this.surfaceFlattenUniform,
      );
      this.objects.earth.quaternion.copy(
        observerToZenithQuaternion(this.flags.latitudeDeg, this.flags.longitudeDeg),
      );
    });
    if (this.overlayRoot) {
      this.overlay = new SkyOverlay(this.overlayRoot, {
        onLook: (azimuthDeg, altitudeDeg) => this.lookToward(azimuthDeg, altitudeDeg),
        onSelect: (bodyId) => useAppStore.getState().setSelectedBodyId(bodyId),
      });
    }
    this.updateAstronomy(this.simulationClock.read().utcMs);
    this.applyOpeningTarget();

    this.bindInput();
    this.resize();
    const initialTelemetry = useAppStore.getState().telemetry;
    useAppStore.getState().setTelemetry({
      ...initialTelemetry,
      backend: bundle.backend,
    });
    this.renderer.setAnimationLoop((timeMs) => this.renderFrame(timeMs));
  }

  /** Latest astronomy snapshot; consumed by the marker overlay and opening target. */
  get currentSkyState(): SkyState | null {
    return this.skyState;
  }

  dispose(): void {
    this.disposed = true;
    this.renderer?.setAnimationLoop(null);
    for (const cleanup of this.cleanupCallbacks) cleanup();
    this.overlay?.dispose();
    this.satellitePatches?.dispose();
    this.renderer?.dispose();
  }

  /** Smoothly steer the free-look offsets toward an alt-az direction. */
  lookToward(azimuthDeg: number, altitudeDeg: number): void {
    this.lookTarget = { azimuthDeg, altitudeDeg };
    this.guidanceRequested = false;
  }

  /**
   * Re-aim the LIVE scene at a new observer — no reload. Everything baked to
   * the old zenith re-derives: the globe/guide quaternions, the imagery
   * patches (recreated around the new point), and the next frame's astronomy.
   */
  setObserverLocation(latitudeDeg: number, longitudeDeg: number): void {
    if (
      this.flags.latitudeDeg === latitudeDeg &&
      this.flags.longitudeDeg === longitudeDeg &&
      this.satellitePatches !== null
    ) {
      return;
    }
    this.flags.latitudeDeg = latitudeDeg;
    this.flags.longitudeDeg = longitudeDeg;
    const zenith = observerToZenithQuaternion(latitudeDeg, longitudeDeg);
    if (this.objects) {
      this.objects.earth.quaternion.copy(zenith);
      this.objects.continentOutlines.quaternion.copy(zenith);
    }
    this.earthGuides?.quaternion.copy(zenith);
    this.axisStubs?.quaternion.copy(zenith);
    // Recreate the imagery around the new point. When the initial delayed
    // creation is still pending it will pick up the new coordinates itself;
    // otherwise dispose and recreate after a beat (never mid-frame-burst).
    if (this.satellitePatches) {
      this.scene?.remove(this.satellitePatches.group);
      this.satellitePatches.dispose();
      this.satellitePatches = null;
      window.setTimeout(() => {
        if (this.disposed || !this.scene || this.satellitePatches) return;
        this.satellitePatches = new SatellitePatches(
          this.flags.latitudeDeg,
          this.flags.longitudeDeg,
        );
        this.scene.add(this.satellitePatches.group);
      }, 300);
    }
    this.lastAstronomyUtcMs = Number.NEGATIVE_INFINITY;
    this.lastOrbitUtcMs = Number.NEGATIVE_INFINITY;
    this.lastSunEventsUtcMs = Number.NEGATIVE_INFINITY;
  }

  /**
   * Camera-relative unit ray toward a geocentric local-frame position. The
   * camera sits at earth-center + (R + altitude) along `cameraDirLocal`
   * (the observer zenith near the ground, the reveal arc beyond).
   */
  private rayFromGeoLocal(geoLocalM: Vec3d, altitudeM: number): { ray: Vec3d; distanceM: number } {
    const cameraRadiusM = altitudeM + EARTH_MEAN_RADIUS_M;
    const x = geoLocalM[0] - this.cameraDirLocal.x * cameraRadiusM;
    const y = geoLocalM[1] - this.cameraDirLocal.y * cameraRadiusM;
    const z = geoLocalM[2] - this.cameraDirLocal.z * cameraRadiusM;
    const lengthM = Math.hypot(x, y, z) || 1;
    return { ray: [x / lengthM, y / lengthM, z / lengthM], distanceM: lengthM };
  }

  /** Aim the opening view at the spec-scored target (Moon, Sun, planet, star, or south). */
  private applyOpeningTarget(): void {
    if (!this.skyState) return;
    const target = chooseOpeningTarget(this.skyState, NAMED_BRIGHT_STARS);
    this.yawOffset = wrapAngleRad(-THREE.MathUtils.degToRad(target.azimuthDeg));
    this.pitchOffset = THREE.MathUtils.degToRad(target.aimAltitudeDeg);
    useAppStore.getState().setOpeningTargetLabel(target.label);
  }

  private bindInput(): void {
    const onResize = () => this.resize();
    // Two live pointers = a pinch: their separation travels the journey
    // (spread descends toward the ground, pinch pulls out), and look-drag
    // pauses so the view doesn't wander while zooming.
    const activePointers = new Map<number, { x: number; y: number }>();
    let pinchDistancePx: number | null = null;
    const onPointerDown = (event: PointerEvent) => {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.canvas.setPointerCapture(event.pointerId);
      if (activePointers.size === 2) {
        const [a, b] = [...activePointers.values()];
        pinchDistancePx = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        this.pointerId = null;
        this.canvas.classList.remove("is-dragging");
        return;
      }
      if (activePointers.size > 2) return;
      this.pointerId = event.pointerId;
      this.guidanceRequested = false;
      this.lookTarget = null;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.pointerDownAt = { x: event.clientX, y: event.clientY, timeMs: performance.now() };
      this.pointerTravelPx = 0;
      this.canvas.classList.add("is-dragging");
    };
    const onPointerMove = (event: PointerEvent) => {
      const tracked = activePointers.get(event.pointerId);
      if (tracked) {
        tracked.x = event.clientX;
        tracked.y = event.clientY;
      }
      if (activePointers.size >= 2 && pinchDistancePx !== null) {
        const [a, b] = [...activePointers.values()];
        const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (distance > 20) {
          // Log-scale travel: a full spread across the screen moves roughly
          // one landmark leg.
          const currentT = distanceToSlider(useAppStore.getState().targetDistanceM);
          const nextT = THREE.MathUtils.clamp(
            currentT + Math.log(pinchDistancePx / distance) * 0.25,
            0,
            1,
          );
          useAppStore.getState().setTargetDistanceM(sliderToDistance(nextT));
          pinchDistancePx = distance;
        }
        return;
      }
      if (event.pointerId !== this.pointerId) return;
      // While tilt navigation drives the camera, a stray finger must not
      // fight it — dragging pauses (pinch travel above still works). Tilt
      // only drives ON THE GROUND: off it, the finger owns the view again.
      if (useAppStore.getState().phoneLookActive && Math.exp(this.distanceSpring.value) <= 60) {
        return;
      }
      const sensitivity = 0.004;
      this.yawOffset -= (event.clientX - this.lastPointer.x) * sensitivity;
      this.pitchOffset -= (event.clientY - this.lastPointer.y) * sensitivity;
      // Allow looking from just below the horizon all the way to the zenith.
      this.pitchOffset = THREE.MathUtils.clamp(this.pitchOffset, -0.65, 1.52);
      this.pointerTravelPx += Math.hypot(
        event.clientX - this.lastPointer.x,
        event.clientY - this.lastPointer.y,
      );
      this.lastPointer = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: PointerEvent) => {
      activePointers.delete(event.pointerId);
      if (activePointers.size < 2) pinchDistancePx = null;
      if (event.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.canvas.classList.remove("is-dragging");
      // Markers are pointer-transparent; a short, still press is a tap that
      // may select one (drags never are).
      const pressMs = performance.now() - this.pointerDownAt.timeMs;
      if (this.pointerTravelPx < 7 && pressMs < 600) {
        this.overlay?.handleTap(event.clientX, event.clientY);
      }
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const currentTarget = useAppStore.getState().targetDistanceM;
      const currentT = distanceToSlider(currentTarget);
      const nextT = THREE.MathUtils.clamp(currentT + event.deltaY * 0.0005, 0, 1);
      useAppStore.getState().setTargetDistanceM(sliderToDistance(nextT));
    };

    window.addEventListener("resize", onResize);
    this.canvas.addEventListener("pointerdown", onPointerDown);
    this.canvas.addEventListener("pointermove", onPointerMove);
    this.canvas.addEventListener("pointerup", onPointerUp);
    this.canvas.addEventListener("pointercancel", onPointerUp);
    this.canvas.addEventListener("wheel", onWheel, { passive: false });

    this.cleanupCallbacks.push(
      () => window.removeEventListener("resize", onResize),
      () => this.canvas.removeEventListener("pointerdown", onPointerDown),
      () => this.canvas.removeEventListener("pointermove", onPointerMove),
      () => this.canvas.removeEventListener("pointerup", onPointerUp),
      () => this.canvas.removeEventListener("pointercancel", onPointerUp),
      () => this.canvas.removeEventListener("wheel", onWheel),
    );
  }

  private resize(): void {
    if (!this.renderer || !this.camera) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const mobile = width < 760;
    // Hairline orbit lines get visibly pixelated when the frame renders
    // under-resolution and upscales; the adaptive DPR governor still steps
    // in under sustained slow frames, so the static caps can sit higher.
    const qualityCap =
      this.flags.quality === "low" ? 1 : mobile ? 2.25 : this.flags.quality === "high" ? 2.5 : 2;
    const pixelRatio = Math.min(window.devicePixelRatio, qualityCap, this.adaptiveDprCap);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.skyLayer?.setSizeScale(pixelRatio);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /** Recompute the astronomy snapshot (~1 Hz) and publish the sky readout. */
  private updateAstronomy(utcMs: number): void {
    this.lastAstronomyUtcMs = utcMs;
    const sky = computeSkyState(utcMs, this.flags.latitudeDeg, this.flags.longitudeDeg);
    this.skyState = sky;
    this.skyLayer?.updateAstronomy(sky);
    this.solarLayer?.updateAstronomy(sky);
    this.overlay?.setSky(sky);

    // Geocentric positions in local-frame meters for system-scale markers.
    this.bodyGeoLocalM.clear();
    for (const planet of sky.planets) {
      this.bodyGeoLocalM.set(
        planet.id,
        rotateEqjToLocal(sky.eqjToLocalThree, subtractVec3d(planet.helioEqjM, sky.earthHelioEqjM)),
      );
      this.bodyRadiusM.set(planet.id, planet.radiusM);
    }
    this.bodyRadiusM.set("sun", sky.sun.radiusM);
    // Topocentric → earth-centered: the observer sits R above the center.
    // The AIRLESS direction — refraction belongs to the ground view only,
    // and this geometry serves cameras in space.
    this.bodyGeoLocalM.set("sun", [
      sky.sun.directionLocalThreeAirless[0] * sky.sun.distanceM,
      sky.sun.directionLocalThreeAirless[1] * sky.sun.distanceM + EARTH_MEAN_RADIUS_M,
      sky.sun.directionLocalThreeAirless[2] * sky.sun.distanceM,
    ]);
    // Geometric geocentric Moon from the same EQJ source as its orbit guide.
    this.moonGeoLocalM = rotateEqjToLocal(sky.eqjToLocalThree, moonGeoEqjM(utcMs) as Vec3d);

    // The orbit guide is stable in EQJ; refresh only when hours stale.
    if (Math.abs(utcMs - this.lastOrbitUtcMs) > 6 * 3_600_000) {
      this.lastOrbitUtcMs = utcMs;
      this.skyLayer?.setMoonOrbitGeometry(computeMoonOrbitEqjM(utcMs));
    }
    // Sunset/sunrise horizon glows drift slowly; refresh every ten minutes.
    if (Math.abs(utcMs - this.lastSunEventsUtcMs) > 600_000) {
      this.lastSunEventsUtcMs = utcMs;
      this.skyLayer?.setSunHorizonEvents(
        computeSunHorizonEvents(utcMs, this.flags.latitudeDeg, this.flags.longitudeDeg),
      );
    }
    const [sunX, sunY, sunZ] = sky.sun.directionLocalThree;
    this.sunDirectionLocal.set(sunX, sunY, sunZ);
    this.sunDirectionUniform.value.set(sunX, sunY, sunZ);
    this.sunAltitudeDeg = sky.sun.altitudeDeg;
    const eclipticNorthLocal = rotateEqjToLocal(sky.eqjToLocalThree, eclipticNorthEqj() as Vec3d);
    this.eclipticNorthLocal.set(...eclipticNorthLocal);
    this.eclipticE1Local.set(
      ...rotateEqjToLocal(sky.eqjToLocalThree, eclipticDirectionEqj(0) as Vec3d),
    );
    this.eclipticE2Local.set(
      ...rotateEqjToLocal(sky.eqjToLocalThree, eclipticDirectionEqj(90) as Vec3d),
    );
    // Six "Plane of the solar system" captions spread around the ecliptic —
    // dense enough that the below-horizon stretch always carries one too; the
    // overlay projects them each frame and shows whichever face the view.
    this.planeGuideAnchors = [10, 70, 130, 190, 250, 310].map((longitudeDeg) => ({
      direction: rotateEqjToLocal(sky.eqjToLocalThree, eclipticDirectionEqj(longitudeDeg) as Vec3d),
      directionAhead: rotateEqjToLocal(
        sky.eqjToLocalThree,
        eclipticDirectionEqj(longitudeDeg + 8) as Vec3d,
      ),
    }));

    // The band's highest point over the horizon (real diurnal astronomy:
    // ~30° on July evenings at 40°N, ~74° at midday) — published so the UI
    // can SAY it rather than leave a low band looking like a location bug.
    let eclipticPeakAltitudeDeg = -90;
    for (let longitudeDeg = 0; longitudeDeg < 360; longitudeDeg += 5) {
      const direction = rotateEqjToLocal(
        sky.eqjToLocalThree,
        eclipticDirectionEqj(longitudeDeg) as Vec3d,
      );
      const altitudeDeg = (Math.asin(Math.min(1, Math.max(-1, direction[1]))) * 180) / Math.PI;
      if (altitudeDeg > eclipticPeakAltitudeDeg) eclipticPeakAltitudeDeg = altitudeDeg;
    }

    useAppStore.getState().setSkyReadout({
      sunAltitudeDeg: sky.sun.altitudeDeg,
      sunAzimuthDeg: sky.sun.azimuthDeg,
      eclipticPeakAltitudeDeg,
      moonAltitudeDeg: sky.moon.altitudeDeg,
      moonAzimuthDeg: sky.moon.azimuthDeg,
      moonIlluminatedFraction: sky.moon.illuminatedFraction,
      moonPhaseDeg: sky.moonPhaseDeg,
      moonDistanceM: sky.moon.distanceM,
      visibleStarCount: sky.sun.altitudeDeg < -3 ? STAR_COUNT : 0,
      bodies: [sky.sun, sky.moon, ...sky.planets].map((body) => ({
        id: body.id,
        label: body.label,
        magnitude: body.magnitude,
        distanceFromObserverM: body.distanceM,
        distanceFromSunM:
          body.id === "sun"
            ? 0
            : body.id === "moon"
              ? sky.sun.distanceM
              : Math.hypot(body.helioEqjM[0], body.helioEqjM[1], body.helioEqjM[2]),
        illuminatedFraction: body.illuminatedFraction,
        // The lit limb faces the Sun's side of the sky.
        litOnRight: ((sky.sun.azimuthDeg - body.azimuthDeg + 540) % 360) - 180 > 0,
      })),
    });
  }

  private renderFrame(timeMs: number): void {
    if (!this.renderer || !this.scene || !this.camera || !this.objects) return;

    const rawDeltaSeconds = this.previousFrameMs ? (timeMs - this.previousFrameMs) / 1000 : 1 / 60;
    this.previousFrameMs = timeMs;
    const deltaSeconds = Math.min(0.05, rawDeltaSeconds);
    const simulationUtcMs = this.simulationClock.read().utcMs;
    if (Math.abs(simulationUtcMs - this.lastAstronomyUtcMs) >= 1000) {
      this.updateAstronomy(simulationUtcMs);
    }
    const appState = useAppStore.getState();
    const targetLogMeters = Math.log(appState.targetDistanceM);
    if (Math.abs(targetLogMeters - this.previousTargetLogMeters) > 0.0001) {
      this.guidanceRequested = true;
      // Scale travel supersedes a pending marker look-at.
      this.lookTarget = null;
      this.previousTargetLogMeters = targetLogMeters;
    }
    if (this.pointerId === null && this.guidanceRequested) {
      const recenterDeltaSeconds = Math.min(0.25, Math.max(0, rawDeltaSeconds));
      const recenter = Math.exp(-3.2 * recenterDeltaSeconds);
      this.yawOffset *= recenter;
      this.pitchOffset *= recenter;
      if (Math.abs(this.yawOffset) < 0.0001 && Math.abs(this.pitchOffset) < 0.0001) {
        this.yawOffset = 0;
        this.pitchOffset = 0;
        this.guidanceRequested = false;
      }
    }
    // In the map view the camera is glued straight down over the dot: any
    // leftover free-look (the opening target, an old drag) unwinds here so
    // the pull-out never swivels off toward the horizon it used to face.
    // The MAP LEG ONLY: past the reveal bank the same offsets are the orbit
    // drag, and decaying them slid every space view back to the guided frame.
    const springAltitudeM = Math.exp(this.distanceSpring.value);
    if (
      this.pointerId === null &&
      nadirBlendForAltitude(springAltitudeM) > 0.5 &&
      revealBlendForAltitude(springAltitudeM) < 0.5
    ) {
      const mapDecay = Math.exp(-2.4 * Math.min(0.25, Math.max(0, rawDeltaSeconds)));
      this.yawOffset *= mapDecay;
      this.pitchOffset *= mapDecay;
    }
    const springFrequency = appState.reducedMotion ? 3.2 : 1.9;
    this.distanceSpring = stepCriticalSpring(
      this.distanceSpring,
      targetLogMeters,
      deltaSeconds,
      springFrequency,
    );
    const altitudeM = Math.exp(this.distanceSpring.value);
    const normalizedScale = distanceToSlider(altitudeM);
    const earthRadiusRender = earthRenderRadiusForAltitude(altitudeM);
    const renderUnitsPerMeter = renderUnitsPerMeterForAltitude(altitudeM);

    // The reveal is ONE motion (see revealBlendForAltitude): the camera
    // leaves the zenith ray for a near-side-on anti-sunward vantage barely
    // above the ecliptic, while the frame eases toward "plane flat across
    // the background, Earth off to the right with the observer's dot on it".
    const revealBlend = revealBlendForAltitude(altitudeM);
    // The reveal now has a pure-zoom BALL beat: revealBlend drives the
    // opacities/gates while the vantage swing itself waits — the camera
    // backs straight out along the zenith until the ground is a complete
    // ball dead-center (dot facing you), THEN swings onto the plane framing.
    const vantageSwing = vantageSwingBlendForAltitude(altitudeM);
    // The physical heliocentric layer takes over from the sky proxies as the
    // journey approaches interplanetary scale (this also fades Earth's
    // screen offset back to center for the final frames).
    const systemReveal = smoothstep(1e9, 8e9, altitudeM);
    this.cameraDirLocal.set(0, 1, 0);
    this.arcQuaternion.identity();
    if (revealBlend > 0.001) {
      // The vantage is anchored on the OBSERVER, not the Sun: project the
      // zenith onto the ecliptic plane, swing ~70° around the planet, and
      // lift barely above the plane — Earth arrives centered and tilted with
      // the observer's dot riding its side, whatever the hour.
      const zenithInPlane = new THREE.Vector3(0, 1, 0)
        .addScaledVector(this.eclipticNorthLocal, -this.eclipticNorthLocal.y)
        .normalize();
      const revealDir = zenithInPlane
        .applyAxisAngle(this.eclipticNorthLocal, OBSERVER_SWING_RAD)
        .addScaledVector(this.eclipticNorthLocal, REVEAL_NORTH_LIFT)
        .normalize();
      const fullArc = new THREE.Quaternion().setFromUnitVectors(this.cameraDirLocal, revealDir);
      this.arcQuaternion.slerp(fullArc, vantageSwing);
      this.cameraDirLocal.applyQuaternion(this.arcQuaternion);
    }

    // Beyond the reveal a drag orbits the vantage around Earth instead of
    // panning the gaze: the same yaw/pitch offsets rotate the whole base
    // frame about Earth's center. Blended with the reveal, the on-screen drag
    // feel stays continuous — pure look at the ground, pure orbit out here.
    const orbitBlend = revealBlend;
    if (orbitBlend > 0.001 && (this.yawOffset !== 0 || this.pitchOffset !== 0)) {
      const gaze = this.cameraDirLocal.clone().multiplyScalar(-1);
      // Yaw orbits about the zenith through the ball beat (the globe spins
      // under you), then about ecliptic north once the frame has rolled.
      const upAxis = new THREE.Vector3(0, 1 - vantageSwing, 0).addScaledVector(
        this.eclipticNorthLocal,
        vantageSwing,
      );
      upAxis.addScaledVector(gaze, -upAxis.dot(gaze));
      if (upAxis.lengthSq() > 1e-8) {
        upAxis.normalize();
        const rightAxis = new THREE.Vector3().crossVectors(gaze, upAxis).normalize();
        const orbitQuaternion = new THREE.Quaternion()
          .setFromAxisAngle(upAxis, this.yawOffset * orbitBlend)
          .multiply(
            new THREE.Quaternion().setFromAxisAngle(rightAxis, this.pitchOffset * orbitBlend),
          );
        this.cameraDirLocal.applyQuaternion(orbitQuaternion);
        this.arcQuaternion.premultiply(orbitQuaternion);
      }
    }
    // Earth's center in camera-relative render space; the camera itself
    // always sits at the origin.
    const earthCenterRender = new THREE.Vector3()
      .copy(this.cameraDirLocal)
      .multiplyScalar(-(EARTH_MEAN_RADIUS_M + altitudeM) * renderUnitsPerMeter);
    // The ground observer's surface point — no longer straight below once
    // the arc is underway.
    const observerSurfaceRender = new THREE.Vector3(
      0,
      EARTH_MEAN_RADIUS_M * renderUnitsPerMeter,
      0,
    ).add(earthCenterRender);

    const globalObjects: THREE.Object3D[] = [
      this.objects.earth,
      this.objects.atmosphereInside,
      this.objects.atmosphereOutside,
      this.objects.continentOutlines,
    ];
    if (this.earthGuides) globalObjects.push(this.earthGuides);
    if (this.axisStubs) globalObjects.push(this.axisStubs);
    for (const object of globalObjects) {
      object.position.copy(earthCenterRender);
      object.scale.setScalar(earthRadiusRender);
    }
    // Earth scale collapses to sub-pixel at system scale; drop the guides too.
    const layers = appState.layers;
    if (this.earthGuides) {
      this.earthGuides.visible = layers["earth-axis"] && earthRadiusRender > 0.02;
      // Keep the axis/equator on the textured globe's exact orientation.
      this.earthGuides.quaternion.copy(this.objects.continentOutlines.quaternion);
    }
    if (this.axisStubs) {
      // Default-on tilt cue: rides in with the reveal, leaves with the system.
      const stubOpacity = layers["axis-stubs"] ? revealBlend * (1 - systemReveal) * 0.55 : 0;
      this.axisStubs.visible = stubOpacity > 0.02 && earthRadiusRender > 0.02;
      (this.axisStubs.material as THREE.LineBasicMaterial).opacity = stubOpacity;
      this.axisStubs.quaternion.copy(this.objects.continentOutlines.quaternion);
    }

    // The old fixed coordinate grid becomes the alt-az sky grid layer.
    this.objects.coordinateGrid.position.set(0, 0, 0);
    this.objects.coordinateGrid.scale.setScalar(1_400);

    // Twilight state drives sky, atmosphere, star visibility — and how
    // brightly the satellite imagery reads (night dims the map too).
    const daylight = smoothstep(-6, 8, this.sunAltitudeDeg);

    // Satellite imagery under the map view; the credit line shows with it.
    this.satellitePatches?.update(observerSurfaceRender, renderUnitsPerMeter, altitudeM, daylight);
    this.imageryCreditElement ??= document.getElementById("imagery-credit");
    if (this.imageryCreditElement) {
      const imageryVisible = altitudeM > 25 && altitudeM < 1_200_000;
      this.imageryCreditElement.style.visibility = imageryVisible ? "visible" : "hidden";
    }

    const localFade = 1 - smoothstep(8_000, 90_000, altitudeM);
    const capRadiusM = Math.max(220_000, Math.sqrt(2 * EARTH_MEAN_RADIUS_M * altitudeM) * 1.5);
    this.objects.localCap.position.copy(observerSurfaceRender);
    this.objects.localCap.scale.setScalar(capRadiusM * renderUnitsPerMeter);
    this.objects.localCap.visible = localFade > 0.001;
    (this.objects.localCap.material as THREE.MeshStandardMaterial).opacity = localFade;

    // The observer's dot appears almost immediately on pull-out (with the
    // reveal, from a few hundred meters) — "that is where I am standing"
    // anchors the journey — and retires on the way to the Earth–Moon
    // landmark, where "where exactly on the ball" stops mattering.
    const markerReveal = smoothstep(120, 500, altitudeM) * (1 - smoothstep(1.2e8, 4e8, altitudeM));
    const markerDistanceRender = observerSurfaceRender.length();
    // Fixed floor capped ANGULARLY: at map altitudes an absolute floor made
    // the dot (and its dark rim) a huge disc over the imagery.
    // Absolute cap 0.0035 (not 0.002): the old cap pinched the dot's
    // apparent size through the ~10–20 mi band, where its outline vanished.
    const markerSize = Math.max(
      Math.min(0.0035, markerDistanceRender * 0.02),
      markerDistanceRender * 0.009,
    );
    // Sit clearly ABOVE the imagery quads (they float up to ~10 m over the
    // ground): with the sphere half-buried, transparent sort order against
    // the quads flipped frame to frame and the dot flashed while zooming.
    this.objects.observerMarker.position.copy(observerSurfaceRender);
    this.objects.observerMarker.position.y += 15 * renderUnitsPerMeter;
    this.objects.observerMarker.renderOrder = 2.5;
    this.objects.observerMarker.scale.setScalar(markerSize);
    this.objects.observerMarker.visible = markerReveal > 0.001;
    for (const mesh of [this.objects.observerMarker, ...this.objects.observerMarker.children]) {
      const markerMaterial = (mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
      markerMaterial.transparent = true;
      // The outer halo stays translucent — a glow, not a bigger dot — and
      // follows reveal² so the big soft haze never precedes the dot itself.
      markerMaterial.opacity =
        mesh.name === "observer-glow" ? 0.9 * markerReveal * markerReveal : markerReveal;
    }

    const atmosphereExit = smoothstep(45_000, 450_000, altitudeM);
    (this.objects.atmosphereInside.material as THREE.MeshBasicMaterial).opacity =
      THREE.MathUtils.lerp(0.36, 0.15, atmosphereExit) * (0.18 + 0.82 * daylight);
    this.objects.atmosphereInside.visible = true;
    this.objects.atmosphereOutside.visible = false;
    this.objects.coordinateGrid.visible = layers["sky-grid"];

    this.skyLayer?.updateAltitude(
      altitudeM,
      this.sunAltitudeDeg,
      simulationUtcMs,
      systemReveal,
      layers["ecliptic-rings"],
    );
    if (systemReveal > 0 && this.solarLayer) {
      this.solarLayer.buildOrbits(simulationUtcMs);
    }
    this.solarLayer?.updateFrame(earthCenterRender, renderUnitsPerMeter, systemReveal, {
      orbitLines: layers["orbit-lines"],
    });
    // Satellite imagery is below its native resolution close up — hold the
    // stylized surface, then release it ACROSS the imagery fade-out so the
    // globe's textures (city lights included) arrive exactly as the patches
    // leave. A sequential handoff left a near-invisible dark ball at night
    // around 700–1,000 mi; overlapping is safe now that the patches live in
    // mercator meters and register with the globe at the observer.
    this.surfaceFlattenUniform.value = 1 - smoothstep(400_000, 1_200_000, altitudeM);

    const continentReveal = smoothstep(0.3, 0.82, normalizedScale);
    this.objects.continentOutlines.visible = continentReveal > 0.001;
    (this.objects.continentOutlines.material as THREE.LineBasicMaterial).opacity =
      0.04 + continentReveal * 0.28;

    // Sunlight arrives from the true Sun direction; rays run parallel from
    // position toward the earth-center target, so the terminator is physical.
    const sunOffsetRender = earthRadiusRender * 4;
    this.objects.keyLight.position
      .copy(earthCenterRender)
      .addScaledVector(this.sunDirectionLocal, sunOffsetRender);
    this.objects.keyLight.target.position.copy(earthCenterRender);
    this.objects.fillLight.intensity = 0.22 + 0.63 * daylight;

    // Physical Moon: same ray as the sky proxy, true scaled distance once it
    // fits inside the far plane — the hand-off is continuous by construction.
    // The camera's true arc position feeds the parallax, and the placement
    // blends from the refracted ground ray onto the geometric EQJ chain so
    // the Moon sits exactly on its geocentric orbit line at system scales.
    if (this.skyState) {
      const cameraFromGroundM: Vec3d = [
        this.cameraDirLocal.x * (EARTH_MEAN_RADIUS_M + altitudeM),
        this.cameraDirLocal.y * (EARTH_MEAN_RADIUS_M + altitudeM) - EARTH_MEAN_RADIUS_M,
        this.cameraDirLocal.z * (EARTH_MEAN_RADIUS_M + altitudeM),
      ];
      const refracted = this.skyState.moon.directionLocalThree;
      const refractedFromGroundM: Vec3d = [
        refracted[0] * this.skyState.moon.distanceM,
        refracted[1] * this.skyState.moon.distanceM,
        refracted[2] * this.skyState.moon.distanceM,
      ];
      let moonFromGroundM = refractedFromGroundM;
      if (this.moonGeoLocalM) {
        const geometricFromGroundM: Vec3d = [
          this.moonGeoLocalM[0],
          this.moonGeoLocalM[1] - EARTH_MEAN_RADIUS_M,
          this.moonGeoLocalM[2],
        ];
        const geometricBlend = smoothstep(1_000_000, 10_000_000, altitudeM);
        moonFromGroundM = [
          THREE.MathUtils.lerp(refractedFromGroundM[0], geometricFromGroundM[0], geometricBlend),
          THREE.MathUtils.lerp(refractedFromGroundM[1], geometricFromGroundM[1], geometricBlend),
          THREE.MathUtils.lerp(refractedFromGroundM[2], geometricFromGroundM[2], geometricBlend),
        ];
      }
      this.moonPlacement = computeMoonPlacement(
        moonFromGroundM,
        cameraFromGroundM,
        renderUnitsPerMeter,
      );
      this.skyLayer?.updateMoonPlacement(this.moonPlacement, earthCenterRender);
    }
    this.skyLayer?.updateEarthAnchored(earthCenterRender, renderUnitsPerMeter, altitudeM, {
      moonOrbit: layers["moon-orbit"],
      sunGuide: layers["sun-guide"],
    });

    const composition = journeyCompositionForSlider(normalizedScale);

    // The gaze never detours to the nadir: the frame eases straight from the
    // ground's free look into the reveal frame (built below), and the Moon
    // and then the whole system enter purely by the FOV widening.
    const basePitchRad = 0;
    const baseYawRad = 0;
    let baseFovDeg = THREE.MathUtils.lerp(
      58,
      wholeEarthFovDegForAspect(this.camera.aspect),
      composition,
    );
    {
      const framing = earthMoonCompositionForAltitude(altitudeM);
      if (framing.blend > 0) {
        baseFovDeg = THREE.MathUtils.lerp(baseFovDeg, framing.fovDeg, framing.blend);
      }
    }
    {
      const framing = systemCompositionForAltitude(altitudeM, baseFovDeg);
      if (framing.blend > 0) {
        baseFovDeg = THREE.MathUtils.lerp(baseFovDeg, framing.fovDeg, framing.blend);
      }
    }

    // Phone look fallback (no full attitude available): ease the view onto
    // the reported heading/pitch. The quaternion path below supersedes this.
    const compassHeadingDeg = appState.compassHeadingDeg;
    if (
      compassHeadingDeg !== null &&
      appState.compassQuaternion === null &&
      this.pointerId === null &&
      altitudeM < 200_000
    ) {
      const targetYaw = wrapAngleRad(-THREE.MathUtils.degToRad(compassHeadingDeg) - baseYawRad);
      const ease = 1 - Math.exp(-4 * deltaSeconds);
      this.yawOffset += wrapAngleRad(targetYaw - this.yawOffset) * ease;
      const compassPitchDeg = appState.compassPitchDeg;
      if (compassPitchDeg !== null) {
        const targetPitch = THREE.MathUtils.clamp(
          THREE.MathUtils.degToRad(compassPitchDeg) - basePitchRad,
          -0.65,
          1.52,
        );
        this.pitchOffset += (targetPitch - this.pitchOffset) * ease;
      }
    }

    const baseQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      baseYawRad,
    );

    // First beat: the map view. Almost immediately off the ground the gaze
    // drops straight down onto where you stand, screen-up to the north —
    // the aerial frame everyone knows.
    const nadirBlend = nadirBlendForAltitude(altitudeM);
    if (nadirBlend > 0.001) {
      const nadirMatrix = new THREE.Matrix4().lookAt(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, 0, -1),
      );
      const nadirQuaternion = new THREE.Quaternion().setFromRotationMatrix(nadirMatrix);
      baseQuaternion.slerp(nadirQuaternion, nadirBlend);
    }

    // Second beat, the reveal: the map slowly banks into the tilted ball —
    // screen-up rolls onto ecliptic north (the plane lies flat across the
    // background), Earth dead center with the observer's dot on its front
    // face and the axis stubs reading the tilt. The gaze never returns to
    // the horizon, so there is no mid-journey spin.
    if (revealBlend > 0.001) {
      const gazeTarget = this.cameraDirLocal.clone().multiplyScalar(-1);
      // During the ball beat screen-up stays NORTH (the map frame simply
      // recedes — pure zoom, no roll); the roll onto ecliptic north happens
      // with the vantage swing, so the plane lies flat exactly as the frame
      // banks around the planet.
      const revealUp = new THREE.Vector3(0, 0, -1)
        .lerp(this.eclipticNorthLocal, vantageSwing)
        .normalize();
      const lookMatrix = new THREE.Matrix4().lookAt(
        new THREE.Vector3(0, 0, 0),
        gazeTarget,
        revealUp,
      );
      const revealQuaternion = new THREE.Quaternion().setFromRotationMatrix(lookMatrix);
      baseQuaternion.slerp(revealQuaternion, revealBlend);
    }

    // Marker-click look-at: ease the free-look offsets toward the body. The
    // target ray is transformed into the (arced, rolled) base frame, so the
    // math holds at every scale, not just the ground's yaw/pitch frame.
    if (this.lookTarget && this.pointerId === null) {
      const clampedAltitudeDeg = Math.min(60, Math.max(4, this.lookTarget.altitudeDeg));
      const rayLocal = altAzToLocalThree(clampedAltitudeDeg, this.lookTarget.azimuthDeg);
      const rayBase = new THREE.Vector3(...rayLocal).applyQuaternion(
        baseQuaternion.clone().invert(),
      );
      const targetYaw = Math.atan2(-rayBase.x, -rayBase.z);
      const targetPitch = THREE.MathUtils.clamp(
        Math.asin(THREE.MathUtils.clamp(rayBase.y, -1, 1)),
        -0.65,
        1.52,
      );
      const ease = 1 - Math.exp(-5 * deltaSeconds);
      const yawDelta = wrapAngleRad(targetYaw - this.yawOffset);
      const pitchDelta = targetPitch - this.pitchOffset;
      this.yawOffset += yawDelta * ease;
      this.pitchOffset += pitchDelta * ease;
      if (Math.abs(yawDelta) < 0.004 && Math.abs(pitchDelta) < 0.004) {
        this.lookTarget = null;
      }
    }

    // The share of the offsets not consumed by the orbit applies as free
    // look, so the drag's total gaze change is the same at every blend.
    const lookFraction = 1 - orbitBlend;
    const userQuaternion = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yawOffset * lookFraction)
      .multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          this.pitchOffset * lookFraction,
        ),
      );
    this.camera.quaternion.copy(baseQuaternion).multiply(userQuaternion);

    // Compass mode with a full attitude: drive the camera by the device
    // quaternion (smoothed), which sails through the zenith with no flip —
    // heading+pitch decomposition is gimbal-locked straight up. The free-look
    // offsets are kept in sync so leaving compass mode never jumps the view.
    // NOT gated on the pointer: a stray touch used to freeze the view in
    // place (drag-look is already suppressed while tilt drives; taps still
    // select markers). And tilt belongs to the GROUND: it hands off entirely
    // as the map view takes over, so the journey up never fights the phone.
    const compassQuaternion = appState.compassQuaternion;
    const tiltWeight = 1 - smoothstep(15, 60, altitudeM);
    if (compassQuaternion !== null && tiltWeight > 0.001) {
      const target = new THREE.Quaternion(...compassQuaternion);
      this.compassSmoothed ??= this.camera.quaternion.clone();
      this.compassSmoothed.slerp(target, 1 - Math.exp(-7 * deltaSeconds));
      this.camera.quaternion.slerp(this.compassSmoothed, tiltWeight);
      const gaze = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      this.yawOffset = Math.atan2(-gaze.x, -gaze.z) - baseYawRad;
      this.pitchOffset = Math.asin(THREE.MathUtils.clamp(gaze.y, -1, 1));
    } else {
      this.compassSmoothed = null;
    }

    this.camera.fov = baseFovDeg;
    // Once the heliocentric layer is visible the far plane stretches to hold
    // the WHOLE system (Pluto's aphelion) so orbit lines never get clipped
    // into a "drawing themselves" sweep; the near plane scales with it, so
    // depth precision is unchanged. Everything beyond the default far is
    // transparent while systemReveal is 0, so the gate itself is invisible.
    const plutoAphelionM = 7.38e12;
    // Altitude joins the stretch: at 100 AU out, the orbit's far side lies
    // ~150 AU from the camera — an Earth-anchored constant alone clips it.
    const orbitFarUnits = (plutoAphelionM + altitudeM) * renderUnitsPerMeter * 1.15;
    // Altitude-riding near plane: the standard depth buffer cannot carry a
    // fixed tiny near up the journey (see nearPlaneRenderUnitsForAltitude).
    const nearFloorUnits = nearPlaneRenderUnitsForAltitude(altitudeM);
    if (systemReveal > 0.001 && orbitFarUnits > 50_000) {
      this.camera.far = orbitFarUnits;
      this.camera.near = Math.max(0.00001 * (orbitFarUnits / 50_000), nearFloorUnits);
    } else {
      this.camera.far = 50_000;
      this.camera.near = nearFloorUnits;
    }
    this.camera.updateProjectionMatrix();

    // Sky brightness falls with altitude and with the Sun below the horizon.
    const skyBrightness = (1 - smoothstep(1_000, 180_000, altitudeM)) * daylight;
    const sceneBackground = this.scene.background;
    if (sceneBackground instanceof THREE.Color) {
      sceneBackground.setRGB(
        0.005 + 0.017 * skyBrightness,
        0.012 + 0.079 * skyBrightness,
        0.028 + 0.137 * skyBrightness,
        THREE.SRGBColorSpace,
      );
    }

    this.renderer.render(this.scene, this.camera);

    // The big distance readout tracks the spring every frame (direct DOM —
    // React stays out of the frame loop; telemetry keeps the slow fallback).
    this.readoutElement ??= document.getElementById("scale-readout-value");
    if (this.readoutElement) {
      const parts = formatDistanceParts(altitudeM);
      if (this.readoutElement.textContent !== parts.value) {
        this.readoutElement.textContent = parts.value;
      }
    }

    const headingDeg = ((-THREE.MathUtils.radToDeg(baseYawRad + this.yawOffset) % 360) + 360) % 360;
    // Sky proxies track the camera's true position every frame so the
    // physical heliocentric bodies fade in exactly on top of them. Near the
    // ground they keep the refracted directions your eye actually sees; the
    // refraction blends out on the same band as the Moon's placement.
    if (this.skyState) {
      const proxyRays = new Map<string, Vec3d>();
      for (const [bodyId, geoLocalM] of this.bodyGeoLocalM) {
        proxyRays.set(bodyId, this.rayFromGeoLocal(geoLocalM, altitudeM).ray);
      }
      const geometricBlend = smoothstep(1_000_000, 10_000_000, altitudeM);
      this.skyLayer?.updateProxyDirections(proxyRays, this.skyState, geometricBlend);
    }

    const overrides = new Map<string, MoonMarkerOverride>();
    const apparentRadiusDeg = (radiusM: number, distanceM: number) =>
      (Math.asin(Math.min(1, radiusM / Math.max(radiusM, distanceM))) * 180) / Math.PI;
    if (this.moonPlacement) {
      overrides.set("moon", {
        directionLocalThree: this.moonPlacement.rayLocal,
        ...rayToAltAzDeg(this.moonPlacement.rayLocal),
        physical: this.moonPlacement.physical,
        apparentRadiusDeg: apparentRadiusDeg(MOON_RADIUS_M, this.moonPlacement.cameraDistanceM),
      });
    }
    // The Sun's marker never retires: like the Moon it is a physical anchor
    // ("which way is the Sun from here") at every scale. From past the sky
    // proxies' fade the override carries it at the true geocentric direction.
    if (systemReveal <= 0 && altitudeM > 200_000) {
      const sunGeoLocalM = this.bodyGeoLocalM.get("sun");
      if (sunGeoLocalM) {
        const { ray, distanceM } = this.rayFromGeoLocal(sunGeoLocalM, altitudeM);
        overrides.set("sun", {
          directionLocalThree: ray,
          ...rayToAltAzDeg(ray),
          physical: true,
          apparentRadiusDeg: apparentRadiusDeg(this.bodyRadiusM.get("sun") ?? 0, distanceM),
        });
      }
    }
    if (systemReveal > 0) {
      for (const [bodyId, geoLocalM] of this.bodyGeoLocalM) {
        if (bodyId === "moon") continue;
        const { ray, distanceM } = this.rayFromGeoLocal(geoLocalM, altitudeM);
        overrides.set(bodyId, {
          directionLocalThree: ray,
          ...rayToAltAzDeg(ray),
          physical: true,
          apparentRadiusDeg: apparentRadiusDeg(this.bodyRadiusM.get(bodyId) ?? 0, distanceM),
        });
      }
      // Earth itself, straight along the gaze at Earth's render center.
      const earthLength = earthCenterRender.length() || 1;
      const earthRay: Vec3d = [
        earthCenterRender.x / earthLength,
        earthCenterRender.y / earthLength,
        earthCenterRender.z / earthLength,
      ];
      overrides.set("earth", {
        directionLocalThree: earthRay,
        ...rayToAltAzDeg(earthRay),
        physical: true,
        apparentRadiusDeg: apparentRadiusDeg(EARTH_MEAN_RADIUS_M, altitudeM + EARTH_MEAN_RADIUS_M),
      });
    }
    // Out in space the captions follow the FRAME, not fixed ecliptic
    // longitudes: ONE caption sits at the gaze's own ecliptic longitude —
    // dead-center over the globe on the band (the ~8.5° north lift holds it
    // clear of the planet from ~30,000 mi out; nearer in, the occluder
    // simply hides it until there is room). The rest space out at 60° as
    // the repeats around the ring. The ground sky keeps astronomy-tick
    // anchors.
    if (revealBlend > 0.01 && this.skyState) {
      const gazeLongitudeDeg =
        (Math.atan2(
          -this.cameraDirLocal.dot(this.eclipticE2Local),
          -this.cameraDirLocal.dot(this.eclipticE1Local),
        ) *
          180) /
        Math.PI;
      // While the globe still fills the center, the lead caption SLIDES
      // along the band just far enough to clear the occluder (the band's
      // ~8.5° lift is part of the separation), easing to dead-center as the
      // planet shrinks — it never blinks out mid-journey.
      const occluderRadiusDeg =
        (Math.asin(EARTH_MEAN_RADIUS_M / (EARTH_MEAN_RADIUS_M + altitudeM)) * 180) / Math.PI;
      const slideDeg = Math.sqrt(Math.max(0, (occluderRadiusDeg + 3) ** 2 - 8.5 ** 2));
      this.planeGuideAnchors = [slideDeg, 60, -60, 120, -120, 180].map((offsetDeg) => ({
        direction: rotateEqjToLocal(
          this.skyState!.eqjToLocalThree,
          eclipticDirectionEqj(gazeLongitudeDeg + offsetDeg) as Vec3d,
        ),
        directionAhead: rotateEqjToLocal(
          this.skyState!.eqjToLocalThree,
          eclipticDirectionEqj(gazeLongitudeDeg + offsetDeg + 8) as Vec3d,
        ),
      }));
    }
    // In space the band passes behind the globe; captions on the Earth's
    // apparent disc hide with it instead of floating over the planet.
    const earthDistanceRender = earthCenterRender.length() || 1;
    const captionOccluder =
      revealBlend > 0.01
        ? {
            direction: [
              earthCenterRender.x / earthDistanceRender,
              earthCenterRender.y / earthDistanceRender,
              earthCenterRender.z / earthDistanceRender,
            ] as const,
            apparentRadiusDeg:
              (Math.asin(EARTH_MEAN_RADIUS_M / (EARTH_MEAN_RADIUS_M + altitudeM)) * 180) / Math.PI,
          }
        : undefined;
    this.overlay?.update(
      this.camera,
      headingDeg,
      altitudeM,
      overrides,
      systemReveal,
      {
        labels: layers["marker-labels"],
        belowHorizon: layers["below-horizon-markers"],
      },
      {
        anchors: this.planeGuideAnchors,
        // The caption rides the band: on the ground view, gone with the band
        // over the map/satellite leg, back with the reveal in outer space,
        // and it retires when the orbit geometry takes over the story.
        opacity: layers["ecliptic-rings"]
          ? 0.55 * (1 - smoothstep(10, 30, altitudeM)) + 0.7 * revealBlend * (1 - systemReveal)
          : 0,
        occluder: captionOccluder,
      },
    );
    this.framesSinceTelemetry += 1;
    this.collectTelemetry(
      timeMs,
      rawDeltaSeconds * 1000,
      altitudeM,
      renderUnitsPerMeter,
      capRadiusM,
      simulationUtcMs,
      headingDeg,
    );
  }

  private collectTelemetry(
    timeMs: number,
    frameMs: number,
    altitudeM: number,
    renderUnitsPerMeter: number,
    capRadiusM: number,
    simulationUtcMs: number,
    headingDeg: number,
  ): void {
    if (!this.renderer) return;
    if (frameMs < 100) this.frameSamplesMs.push(frameMs);
    if (this.frameSamplesMs.length > 180) this.frameSamplesMs.shift();
    if (timeMs - this.telemetryAtMs < TELEMETRY_INTERVAL_MS) return;
    this.telemetryAtMs = timeMs;

    const total = this.frameSamplesMs.reduce((sum, sample) => sum + sample, 0);
    const averageFrameMs = this.frameSamplesMs.length ? total / this.frameSamplesMs.length : 0;

    // Adaptive quality: sustained slow frames step the pixel ratio down one
    // notch (floor 1); astronomical accuracy is never reduced.
    if (averageFrameMs > 26 && this.frameSamplesMs.length > 60) {
      this.slowFrameStreak += 1;
    } else {
      this.slowFrameStreak = 0;
    }
    const currentPixelRatio = this.renderer.getPixelRatio();
    if (
      this.slowFrameStreak >= 15 &&
      currentPixelRatio > 1 &&
      timeMs - this.lastDprDropMs > 5_000
    ) {
      this.adaptiveDprCap = Math.max(1, currentPixelRatio - 0.25);
      this.lastDprDropMs = timeMs;
      this.slowFrameStreak = 0;
      this.resize();
    }
    const localRepresentationActive = altitudeM < 90_000;
    const largestLocalRenderMagnitude = localRepresentationActive
      ? capRadiusM * renderUnitsPerMeter
      : earthRenderRadiusForAltitude(altitudeM);
    const estimatedJitterM = (largestLocalRenderMagnitude * 2 ** -23) / renderUnitsPerMeter;
    const totalDrawCalls = this.renderer.info.render.calls;
    const callsSinceLastSample = Math.max(0, totalDrawCalls - this.infoCallsAtLastSample);
    const drawCalls = Math.round(callsSinceLastSample / Math.max(1, this.framesSinceTelemetry));
    this.infoCallsAtLastSample = totalDrawCalls;
    this.framesSinceTelemetry = 0;

    useAppStore.getState().setTelemetry({
      ...useAppStore.getState().telemetry,
      currentDistanceM: altitudeM,
      scaleDomain: scaleDomainForDistance(altitudeM),
      fps: averageFrameMs ? 1000 / averageFrameMs : 0,
      averageFrameMs,
      worstFrameMs: this.frameSamplesMs.length ? Math.max(...this.frameSamplesMs) : 0,
      drawCalls,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      renderScale: renderUnitsPerMeter,
      estimatedJitterM,
      orientationOffsetDeg: THREE.MathUtils.radToDeg(Math.hypot(this.yawOffset, this.pitchOffset)),
      headingDeg,
      simulationUtcMs,
    });
  }
}
