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
import { altAzToLocalThree, computeSkyState, type SkyState } from "../astronomy/sky-state";
import { stepCriticalSpring, type SpringState } from "../camera/camera-spring";
import {
  cameraArcBlendForAltitude,
  earthMoonCompositionForAltitude,
  eclipticRollBlendForAltitude,
  journeyCompositionForSlider,
  systemCompositionForAltitude,
  wholeEarthFovDegForAspect,
} from "../camera/camera-compositions";
import {
  distanceToSlider,
  earthRenderRadiusForAltitude,
  JOURNEY_MIN_DISTANCE_M,
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
import { createEarthGuides } from "../scene/earth/earth-guides";
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

  const observerMarker = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0xf5c977 }),
  );

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
  private overlay: SkyOverlay | null = null;
  private readonly overlayRoot: HTMLElement | null;
  private lookTarget: { azimuthDeg: number; altitudeDeg: number } | null = null;
  private lastAstronomyUtcMs = Number.NEGATIVE_INFINITY;
  private lastOrbitUtcMs = Number.NEGATIVE_INFINITY;
  private moonPlacement: MoonPlacement | null = null;
  private readonly sunDirectionLocal = new THREE.Vector3(0, 1, 0);
  private readonly sunDirectionUniform = uniform(new THREE.Vector3(0, 1, 0));
  private readonly eclipticNorthLocal = new THREE.Vector3(0, 1, 0);
  private planeGuideAnchors: PlaneGuideAnchor[] = [];
  /** Unit direction from Earth's center to the camera, local frame. */
  private readonly cameraDirLocal = new THREE.Vector3(0, 1, 0);
  private readonly arcQuaternion = new THREE.Quaternion();
  private moonGeoLocalM: Vec3d | null = null;
  private earthGuides: THREE.LineSegments | null = null;
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

    // Real Earth imagery loads after the opening scene; the flat-shaded globe
    // stands in until then and remains the fallback if loading fails.
    void loadEarthTextures(import.meta.env.BASE_URL).then((textures) => {
      if (!textures || this.disposed || !this.objects) return;
      this.objects.earth.material = createEarthGlobeMaterial(
        textures.day,
        textures.night,
        this.sunDirectionUniform,
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
    this.renderer?.dispose();
  }

  /** Smoothly steer the free-look offsets toward an alt-az direction. */
  lookToward(azimuthDeg: number, altitudeDeg: number): void {
    this.lookTarget = { azimuthDeg, altitudeDeg };
    this.guidanceRequested = false;
  }

  /**
   * Camera-relative unit ray toward a geocentric local-frame position. The
   * camera sits at earth-center + (R + altitude) along `cameraDirLocal`
   * (the observer zenith near the ground, the reveal arc beyond).
   */
  private rayFromGeoLocal(geoLocalM: Vec3d, altitudeM: number): Vec3d {
    const cameraRadiusM = altitudeM + EARTH_MEAN_RADIUS_M;
    const x = geoLocalM[0] - this.cameraDirLocal.x * cameraRadiusM;
    const y = geoLocalM[1] - this.cameraDirLocal.y * cameraRadiusM;
    const z = geoLocalM[2] - this.cameraDirLocal.z * cameraRadiusM;
    const lengthM = Math.hypot(x, y, z) || 1;
    return [x / lengthM, y / lengthM, z / lengthM];
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
    const onPointerDown = (event: PointerEvent) => {
      this.pointerId = event.pointerId;
      this.guidanceRequested = false;
      this.lookTarget = null;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.pointerDownAt = { x: event.clientX, y: event.clientY, timeMs: performance.now() };
      this.pointerTravelPx = 0;
      this.canvas.setPointerCapture(event.pointerId);
      this.canvas.classList.add("is-dragging");
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== this.pointerId) return;
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
    const qualityCap =
      this.flags.quality === "low" ? 1 : mobile ? 1.5 : this.flags.quality === "high" ? 2 : 1.75;
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
    }
    // Topocentric → earth-centered: the observer sits R above the center.
    this.bodyGeoLocalM.set("sun", [
      sky.sun.directionLocalThree[0] * sky.sun.distanceM,
      sky.sun.directionLocalThree[1] * sky.sun.distanceM + EARTH_MEAN_RADIUS_M,
      sky.sun.directionLocalThree[2] * sky.sun.distanceM,
    ]);
    // Geometric geocentric Moon from the same EQJ source as its orbit guide.
    this.moonGeoLocalM = rotateEqjToLocal(sky.eqjToLocalThree, moonGeoEqjM(utcMs) as Vec3d);

    // The orbit guide is stable in EQJ; refresh only when hours stale.
    if (Math.abs(utcMs - this.lastOrbitUtcMs) > 6 * 3_600_000) {
      this.lastOrbitUtcMs = utcMs;
      this.skyLayer?.setMoonOrbitGeometry(computeMoonOrbitEqjM(utcMs));
    }
    const [sunX, sunY, sunZ] = sky.sun.directionLocalThree;
    this.sunDirectionLocal.set(sunX, sunY, sunZ);
    this.sunDirectionUniform.value.set(sunX, sunY, sunZ);
    this.sunAltitudeDeg = sky.sun.altitudeDeg;
    const eclipticNorthLocal = rotateEqjToLocal(sky.eqjToLocalThree, eclipticNorthEqj() as Vec3d);
    this.eclipticNorthLocal.set(...eclipticNorthLocal);
    // Three "Plane of the solar system" captions spread around the ecliptic;
    // the overlay projects them each frame and shows whichever face the view.
    this.planeGuideAnchors = [15, 135, 255].map((longitudeDeg) => ({
      direction: rotateEqjToLocal(sky.eqjToLocalThree, eclipticDirectionEqj(longitudeDeg) as Vec3d),
      directionAhead: rotateEqjToLocal(
        sky.eqjToLocalThree,
        eclipticDirectionEqj(longitudeDeg + 8) as Vec3d,
      ),
    }));

    useAppStore.getState().setSkyReadout({
      sunAltitudeDeg: sky.sun.altitudeDeg,
      sunAzimuthDeg: sky.sun.azimuthDeg,
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

    // The reveal arc: past the atmosphere the camera leaves the zenith ray
    // and swings around the planet to an anti-sunward vantage raised above
    // the ecliptic — Earth stands alone in frame with the observer's dot on
    // its side and the Sun and inner system in the background, day or night.
    const arcBlend = cameraArcBlendForAltitude(altitudeM);
    this.cameraDirLocal.set(0, 1, 0);
    this.arcQuaternion.identity();
    if (arcBlend > 0.001) {
      const revealDir = new THREE.Vector3()
        .copy(this.sunDirectionLocal)
        .multiplyScalar(-1)
        .addScaledVector(this.eclipticNorthLocal, 0.45)
        .normalize();
      const fullArc = new THREE.Quaternion().setFromUnitVectors(this.cameraDirLocal, revealDir);
      this.arcQuaternion.slerp(fullArc, arcBlend);
      this.cameraDirLocal.applyQuaternion(this.arcQuaternion);
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

    // The old fixed coordinate grid becomes the alt-az sky grid layer.
    this.objects.coordinateGrid.position.set(0, 0, 0);
    this.objects.coordinateGrid.scale.setScalar(1_400);

    const localFade = 1 - smoothstep(8_000, 90_000, altitudeM);
    const capRadiusM = Math.max(220_000, Math.sqrt(2 * EARTH_MEAN_RADIUS_M * altitudeM) * 1.5);
    this.objects.localCap.position.copy(observerSurfaceRender);
    this.objects.localCap.scale.setScalar(capRadiusM * renderUnitsPerMeter);
    this.objects.localCap.visible = localFade > 0.001;
    (this.objects.localCap.material as THREE.MeshStandardMaterial).opacity = localFade;

    // The observer's dot appears as soon as the gaze starts sweeping down —
    // "that is where I am standing" anchors the rest of the pull-out.
    const markerReveal = smoothstep(1_500, 30_000, altitudeM);
    const markerDistanceRender = observerSurfaceRender.length();
    const markerSize = Math.max(0.002, markerDistanceRender * 0.006);
    this.objects.observerMarker.position.copy(observerSurfaceRender);
    this.objects.observerMarker.scale.setScalar(markerSize);
    this.objects.observerMarker.visible = markerReveal > 0.001;
    const markerMaterial = this.objects.observerMarker.material as THREE.MeshBasicMaterial;
    markerMaterial.transparent = true;
    markerMaterial.opacity = markerReveal;

    // Twilight state drives sky, atmosphere, and star visibility.
    const daylight = smoothstep(-6, 8, this.sunAltitudeDeg);

    const atmosphereExit = smoothstep(45_000, 450_000, altitudeM);
    (this.objects.atmosphereInside.material as THREE.MeshBasicMaterial).opacity =
      THREE.MathUtils.lerp(0.36, 0.15, atmosphereExit) * (0.18 + 0.82 * daylight);
    this.objects.atmosphereInside.visible = true;
    this.objects.atmosphereOutside.visible = false;
    this.objects.coordinateGrid.visible = layers["sky-grid"];

    // The physical heliocentric layer takes over from the sky proxies as the
    // journey approaches interplanetary scale.
    const systemReveal = smoothstep(1e9, 8e9, altitudeM);
    this.skyLayer?.updateAltitude(
      altitudeM,
      this.sunAltitudeDeg,
      systemReveal,
      layers["ecliptic-rings"],
    );
    if (systemReveal > 0 && this.solarLayer) {
      this.solarLayer.buildOrbits(simulationUtcMs);
    }
    this.solarLayer?.updateFrame(earthCenterRender, renderUnitsPerMeter, systemReveal, {
      orbitLines: layers["orbit-lines"],
      eclipticRings: layers["ecliptic-rings"],
    });
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
      this.skyLayer?.updateMoonPlacement(this.moonPlacement);
    }
    this.skyLayer?.updateEarthAnchored(earthCenterRender, renderUnitsPerMeter, altitudeM, {
      moonOrbit: layers["moon-orbit"],
      sunGuide: layers["sun-guide"],
    });

    const composition = journeyCompositionForSlider(normalizedScale);

    // Base gaze: sweep to nadir by the atmosphere landmark and stay pinned on
    // Earth for the rest of the journey — the Moon and then the whole system
    // enter the frame purely by the FOV widening, so the pull-out never spins.
    const basePitchRad = (-Math.PI / 2) * composition;
    const baseYawRad = 0;
    let baseFovDeg = THREE.MathUtils.lerp(
      58,
      wholeEarthFovDegForAspect(this.camera.aspect),
      composition,
    );
    if (this.moonPlacement) {
      const framing = earthMoonCompositionForAltitude(
        altitudeM,
        this.moonPlacement.rayLocal,
        [-this.cameraDirLocal.x, -this.cameraDirLocal.y, -this.cameraDirLocal.z],
        baseFovDeg,
      );
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

    // Phone look: near the ground, ease the view onto where the device
    // physically points — heading always, pitch when the platform reports it.
    const compassHeadingDeg = appState.compassHeadingDeg;
    if (compassHeadingDeg !== null && this.pointerId === null && altitudeM < 200_000) {
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

    const baseQuaternion = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), baseYawRad)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), basePitchRad))
      // The reveal arc carries the whole base frame around the planet, so the
      // gaze stays pinned on Earth's center for free.
      .premultiply(this.arcQuaternion);

    // The reveal: screen-up rolls from the observer's zenith to ecliptic
    // north on the way out, so the solar system's plane settles flat while
    // your ground visibly tilts — you were standing on the side of a planet.
    const rollBlend = eclipticRollBlendForAltitude(altitudeM);
    if (rollBlend > 0.001) {
      const gaze = new THREE.Vector3(0, 0, -1).applyQuaternion(baseQuaternion);
      const currentUp = new THREE.Vector3(0, 1, 0).applyQuaternion(baseQuaternion);
      const desiredUp = this.eclipticNorthLocal
        .clone()
        .addScaledVector(gaze, -this.eclipticNorthLocal.dot(gaze));
      if (desiredUp.lengthSq() > 1e-8) {
        desiredUp.normalize();
        const rollAngle = Math.atan2(
          new THREE.Vector3().crossVectors(currentUp, desiredUp).dot(gaze),
          currentUp.dot(desiredUp),
        );
        baseQuaternion.premultiply(
          new THREE.Quaternion().setFromAxisAngle(gaze, rollAngle * rollBlend),
        );
      }
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

    const userQuaternion = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yawOffset)
      .multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitchOffset),
      );
    this.camera.quaternion.copy(baseQuaternion).multiply(userQuaternion);
    this.camera.fov = baseFovDeg;
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
    const headingDeg = ((-THREE.MathUtils.radToDeg(baseYawRad + this.yawOffset) % 360) + 360) % 360;
    const overrides = new Map<string, MoonMarkerOverride>();
    if (this.moonPlacement) {
      overrides.set("moon", {
        directionLocalThree: this.moonPlacement.rayLocal,
        ...rayToAltAzDeg(this.moonPlacement.rayLocal),
        physical: this.moonPlacement.physical,
      });
    }
    if (systemReveal > 0) {
      for (const [bodyId, geoLocalM] of this.bodyGeoLocalM) {
        if (bodyId === "moon") continue;
        const ray = this.rayFromGeoLocal(geoLocalM, altitudeM);
        overrides.set(bodyId, {
          directionLocalThree: ray,
          ...rayToAltAzDeg(ray),
          physical: true,
        });
      }
    }
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
        opacity: layers["ecliptic-rings"] ? 0.55 * (1 - systemReveal) : 0,
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
