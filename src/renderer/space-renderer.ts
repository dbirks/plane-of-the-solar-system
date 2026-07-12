import * as THREE from "three/webgpu";

import { useAppStore } from "../app/app-store";
import type { FeatureFlags } from "../app/feature-flags";
import { type BrightStar, chooseOpeningTarget } from "../astronomy/opening-target";
import { computeSkyState, type SkyState } from "../astronomy/sky-state";
import { stepCriticalSpring, type SpringState } from "../camera/camera-spring";
import {
  journeyCompositionForSlider,
  wholeEarthFovDegForAspect,
} from "../camera/camera-compositions";
import {
  distanceToSlider,
  earthRenderRadiusForAltitude,
  PHASE_ONE_MIN_DISTANCE_M,
  renderUnitsPerMeterForAltitude,
  scaleDomainForDistance,
  sliderToDistance,
} from "../camera/scale-domains";
import { EARTH_MEAN_RADIUS_M } from "../coordinates/units";
import { createContinentOutlines } from "../scene/earth/continent-outlines";
import { SkyLayer } from "../scene/sky/sky-layer";
import {
  STAR_COUNT,
  STAR_DEC_DEG,
  STAR_MAG,
  STAR_NAMES,
  STAR_RA_DEG,
} from "../scene/sky/star-catalog";
import { SimulationClock } from "../simulation/simulation-clock";
import { SkyOverlay } from "../ui/sky-overlay";
import { createRenderer } from "./renderer-factory";

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
  private skyState: SkyState | null = null;
  private overlay: SkyOverlay | null = null;
  private readonly overlayRoot: HTMLElement | null;
  private lookTarget: { azimuthDeg: number; altitudeDeg: number } | null = null;
  private lastAstronomyUtcMs = Number.NEGATIVE_INFINITY;
  private readonly sunDirectionLocal = new THREE.Vector3(0, 1, 0);
  private sunAltitudeDeg = -90;
  private distanceSpring: SpringState = {
    value: Math.log(PHASE_ONE_MIN_DISTANCE_M),
    velocity: 0,
  };
  private yawOffset = 0;
  private pitchOffset = 0;
  private guidanceRequested = false;
  private previousTargetLogMeters = Math.log(PHASE_ONE_MIN_DISTANCE_M);
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
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.00001, 5000);
    this.camera.position.set(0, 0, 0);
    this.objects = createSceneObjects(this.scene, this.flags.latitudeDeg, this.flags.longitudeDeg);
    this.skyLayer = new SkyLayer();
    this.scene.add(this.skyLayer.group);
    if (this.overlayRoot) {
      this.overlay = new SkyOverlay(this.overlayRoot, (azimuthDeg, altitudeDeg) =>
        this.lookToward(azimuthDeg, altitudeDeg),
      );
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
    const pixelRatio = Math.min(window.devicePixelRatio, qualityCap);
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
    this.overlay?.setSky(sky);
    const [sunX, sunY, sunZ] = sky.sun.directionLocalThree;
    this.sunDirectionLocal.set(sunX, sunY, sunZ);
    this.sunAltitudeDeg = sky.sun.altitudeDeg;

    useAppStore.getState().setSkyReadout({
      sunAltitudeDeg: sky.sun.altitudeDeg,
      sunAzimuthDeg: sky.sun.azimuthDeg,
      moonAltitudeDeg: sky.moon.altitudeDeg,
      moonAzimuthDeg: sky.moon.azimuthDeg,
      moonIlluminatedFraction: sky.moon.illuminatedFraction,
      moonPhaseDeg: sky.moonPhaseDeg,
      visibleStarCount: sky.sun.altitudeDeg < -3 ? STAR_COUNT : 0,
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
    const earthCenterY = -(EARTH_MEAN_RADIUS_M + altitudeM) * renderUnitsPerMeter;

    const globalObjects: THREE.Object3D[] = [
      this.objects.earth,
      this.objects.atmosphereInside,
      this.objects.atmosphereOutside,
      this.objects.coordinateGrid,
      this.objects.continentOutlines,
    ];
    for (const object of globalObjects) {
      object.position.set(0, earthCenterY, 0);
      object.scale.setScalar(earthRadiusRender);
    }

    const localFade = 1 - smoothstep(8_000, 90_000, altitudeM);
    const capRadiusM = Math.max(220_000, Math.sqrt(2 * EARTH_MEAN_RADIUS_M * altitudeM) * 1.5);
    this.objects.localCap.position.set(0, -altitudeM * renderUnitsPerMeter, 0);
    this.objects.localCap.scale.setScalar(capRadiusM * renderUnitsPerMeter);
    this.objects.localCap.visible = localFade > 0.001;
    (this.objects.localCap.material as THREE.MeshStandardMaterial).opacity = localFade;

    const markerReveal = smoothstep(20_000, 800_000, altitudeM);
    const markerDistanceRender = altitudeM * renderUnitsPerMeter;
    const markerSize = Math.max(0.002, markerDistanceRender * 0.006);
    this.objects.observerMarker.position.set(0, -altitudeM * renderUnitsPerMeter, 0);
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
    this.objects.coordinateGrid.visible = false;
    this.skyLayer?.updateAltitude(altitudeM, this.sunAltitudeDeg);
    const continentReveal = smoothstep(0.3, 0.82, normalizedScale);
    this.objects.continentOutlines.visible = continentReveal > 0.001;
    (this.objects.continentOutlines.material as THREE.LineBasicMaterial).opacity =
      0.04 + continentReveal * 0.28;

    // Sunlight arrives from the true Sun direction; rays run parallel from
    // position toward the earth-center target, so the terminator is physical.
    const sunOffsetRender = earthRadiusRender * 4;
    this.objects.keyLight.position.set(
      this.sunDirectionLocal.x * sunOffsetRender,
      earthCenterY + this.sunDirectionLocal.y * sunOffsetRender,
      this.sunDirectionLocal.z * sunOffsetRender,
    );
    this.objects.keyLight.target.position.set(0, earthCenterY, 0);
    this.objects.fillLight.intensity = 0.22 + 0.63 * daylight;

    const composition = journeyCompositionForSlider(normalizedScale);

    // Marker-click look-at: ease the free-look offsets toward the body.
    if (this.lookTarget && this.pointerId === null) {
      const targetYaw = -THREE.MathUtils.degToRad(this.lookTarget.azimuthDeg);
      const basePitch = (-Math.PI / 2) * composition;
      const targetPitch = THREE.MathUtils.clamp(
        THREE.MathUtils.degToRad(Math.min(60, Math.max(4, this.lookTarget.altitudeDeg))) -
          basePitch,
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

    const baseQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      (-Math.PI / 2) * composition,
    );
    const userQuaternion = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yawOffset)
      .multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitchOffset),
      );
    this.camera.quaternion.copy(baseQuaternion).multiply(userQuaternion);
    this.camera.fov = THREE.MathUtils.lerp(
      58,
      wholeEarthFovDegForAspect(this.camera.aspect),
      composition,
    );
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
    const headingDeg = ((-THREE.MathUtils.radToDeg(this.yawOffset) % 360) + 360) % 360;
    this.overlay?.update(this.camera, headingDeg, altitudeM);
    this.framesSinceTelemetry += 1;
    this.collectTelemetry(
      timeMs,
      rawDeltaSeconds * 1000,
      altitudeM,
      renderUnitsPerMeter,
      capRadiusM,
      simulationUtcMs,
    );
  }

  private collectTelemetry(
    timeMs: number,
    frameMs: number,
    altitudeM: number,
    renderUnitsPerMeter: number,
    capRadiusM: number,
    simulationUtcMs: number,
  ): void {
    if (!this.renderer) return;
    if (frameMs < 100) this.frameSamplesMs.push(frameMs);
    if (this.frameSamplesMs.length > 180) this.frameSamplesMs.shift();
    if (timeMs - this.telemetryAtMs < TELEMETRY_INTERVAL_MS) return;
    this.telemetryAtMs = timeMs;

    const total = this.frameSamplesMs.reduce((sum, sample) => sum + sample, 0);
    const averageFrameMs = this.frameSamplesMs.length ? total / this.frameSamplesMs.length : 0;
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
      headingDeg: ((-THREE.MathUtils.radToDeg(this.yawOffset) % 360) + 360) % 360,
      simulationUtcMs,
    });
  }
}
