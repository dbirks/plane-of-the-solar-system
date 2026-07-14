// Functional TSL forms only: the fluent chain typings (`node.mul(...)`) are
// proxy-generated and both confuse TypeScript 5 and pathologically blow up the
// TypeScript 7 native preview (multi-GB inference; see ADR-0003 amendment).
import {
  add,
  attribute,
  dot,
  float,
  length,
  max,
  mul,
  normalWorld,
  pointUV,
  smoothstep,
  sub,
  uniform,
  vec2,
  vec3,
} from "three/tsl";
import * as THREE from "three/webgpu";

import type { MoonPlacement } from "../../astronomy/moon-placement";
import { computeEclipticRingEqjM, eclipticNorthEqj } from "../../astronomy/planet-orbits";
import type { SkyBodyState, SkyState } from "../../astronomy/sky-state";
import { STAR_COLOR_INDEX, STAR_COUNT, STAR_DEC_DEG, STAR_MAG, STAR_RA_DEG } from "./star-catalog";

/**
 * All sky objects live on a fixed-radius celestial shell around the camera
 * (which stays at the render origin). Directions are the truth; the radius is
 * only a render placement inside the far plane, behind the atmosphere shell.
 */
const STAR_SHELL_RENDER_RADIUS = 1500;
const BODY_SHELL_RENDER_RADIUS = 1300;

const DEG = Math.PI / 180;

/** Approximate a star tint from its B−V color index. */
function colorFromBv(colorIndex: number): [number, number, number] {
  if (colorIndex < 0) return [0.72, 0.82, 1];
  if (colorIndex < 0.4) {
    const t = colorIndex / 0.4;
    return [0.72 + 0.28 * t, 0.82 + 0.16 * t, 1];
  }
  if (colorIndex < 0.9) {
    const t = (colorIndex - 0.4) / 0.5;
    return [1, 0.98 - 0.08 * t, 1 - 0.22 * t];
  }
  const t = Math.min(1, (colorIndex - 0.9) / 0.8);
  return [1, 0.9 - 0.18 * t, 0.78 - 0.3 * t];
}

/** Perceptual brightness weight for a visual magnitude (soft-capped). */
function brightnessFromMagnitude(magnitude: number): number {
  return Math.min(1, 10 ** (-0.32 * (magnitude - 0.4)));
}

type PointsUniforms = {
  opacityUniform: { value: number };
  sizeScaleUniform: { value: number };
};

/** Shared material for star and planet point clouds: per-vertex size/color, soft round sprites. */
function buildPointsMaterial(initialSizeScale: number): THREE.PointsNodeMaterial {
  const material = new THREE.PointsNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.blending = THREE.AdditiveBlending;
  material.vertexColors = true;
  material.sizeAttenuation = false;
  const sizeScaleUniform = uniform(initialSizeScale);
  material.sizeNode = mul(attribute("starSize", "float"), sizeScaleUniform);
  // Soft round points instead of hard GL squares. PointUVNode predates the
  // generic Node<'vec2'> typings in three 0.185, hence the bridge cast.
  const pointUvVec2 = pointUV as unknown as ReturnType<typeof vec2>;
  const radial = length(sub(pointUvVec2, vec2(0.5)));
  const opacityUniform = uniform(0);
  material.opacityNode = mul(smoothstep(0.5, 0.12, radial), opacityUniform);
  material.userData = { opacityUniform, sizeScaleUniform } satisfies PointsUniforms;
  return material;
}

function pointsUniforms(points: THREE.Points): PointsUniforms {
  return (points.material as THREE.PointsNodeMaterial).userData as PointsUniforms;
}

function buildStarField(initialSizeScale: number): THREE.Points {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);

  for (let i = 0; i < STAR_COUNT; i += 1) {
    const raRad = STAR_RA_DEG[i]! * DEG;
    const decRad = STAR_DEC_DEG[i]! * DEG;
    const cosDec = Math.cos(decRad);
    // J2000 equatorial (EQJ) unit vector; the group rotation brings it into
    // the local Three frame per time and observer.
    positions[i * 3] = STAR_SHELL_RENDER_RADIUS * cosDec * Math.cos(raRad);
    positions[i * 3 + 1] = STAR_SHELL_RENDER_RADIUS * cosDec * Math.sin(raRad);
    positions[i * 3 + 2] = STAR_SHELL_RENDER_RADIUS * Math.sin(decRad);

    const brightness = brightnessFromMagnitude(STAR_MAG[i]!);
    const [r, g, b] = colorFromBv(STAR_COLOR_INDEX[i]!);
    colors[i * 3] = r * brightness;
    colors[i * 3 + 1] = g * brightness;
    colors[i * 3 + 2] = b * brightness;
    sizes[i] = 1.3 + 2.4 * brightness;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("starSize", new THREE.BufferAttribute(sizes, 1));

  const points = new THREE.Points(geometry, buildPointsMaterial(initialSizeScale));
  points.frustumCulled = false;
  points.renderOrder = -6;
  return points;
}

function buildPlanetPoints(planetCount: number, initialSizeScale: number): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(planetCount * 3), 3),
  );
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(planetCount * 3), 3));
  geometry.setAttribute("starSize", new THREE.BufferAttribute(new Float32Array(planetCount), 1));

  const points = new THREE.Points(geometry, buildPointsMaterial(initialSizeScale));
  points.frustumCulled = false;
  points.renderOrder = -6;
  return points;
}

export function buildGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(255, 244, 224, 0.85)");
  gradient.addColorStop(0.25, "rgba(255, 236, 200, 0.35)");
  gradient.addColorStop(0.6, "rgba(255, 228, 180, 0.08)");
  gradient.addColorStop(1, "rgba(255, 224, 170, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class SkyLayer {
  readonly group = new THREE.Group();

  private readonly starPoints: THREE.Points;
  private readonly planetPoints: THREE.Points;
  private readonly sunDisc: THREE.Mesh;
  private readonly sunGlow: THREE.Sprite;
  private readonly moonMesh: THREE.Mesh;
  private readonly moonSunDirectionUniform = uniform(new THREE.Vector3(1, 0, 0));
  private readonly moonOrbitGuide: THREE.LineSegments;
  private readonly sunDirectionGuide: THREE.LineSegments;
  private readonly eclipticBand: THREE.LineSegments;
  private readonly eclipticBandFill: THREE.Mesh;

  constructor() {
    this.starPoints = buildStarField(1);
    this.planetPoints = buildPlanetPoints(8, 1);

    // The plane of the solar system, drawn on the sky itself: the ecliptic as
    // a subtle band (±1.5° of ecliptic latitude) on the star shell. From the
    // ground it is the strip the Sun, Moon, and planets all ride — the first
    // hint of the flat plane the journey later reveals. Screen-space captions
    // reading "Plane of the solar system" track it (see SkyOverlay).
    const sampleCount = 180;
    const eclipticDirections = computeEclipticRingEqjM(1, sampleCount);
    const north = eclipticNorthEqj();
    const bandRadius = STAR_SHELL_RENDER_RADIUS * 0.98;
    const halfWidthRad = (1.5 * Math.PI) / 180;
    const cosHalf = Math.cos(halfWidthRad);
    const sinHalf = Math.sin(halfWidthRad);
    const upperPath = new Float32Array(sampleCount * 3);
    const lowerPath = new Float32Array(sampleCount * 3);
    for (let i = 0; i < sampleCount; i += 1) {
      const x = eclipticDirections[i * 3]!;
      const y = eclipticDirections[i * 3 + 1]!;
      const z = eclipticDirections[i * 3 + 2]!;
      const length = Math.hypot(x, y, z) || 1;
      for (const [path, sign] of [
        [upperPath, 1],
        [lowerPath, -1],
      ] as const) {
        path[i * 3] = ((x / length) * cosHalf + north[0] * sinHalf * sign) * bandRadius;
        path[i * 3 + 1] = ((y / length) * cosHalf + north[1] * sinHalf * sign) * bandRadius;
        path[i * 3 + 2] = ((z / length) * cosHalf + north[2] * sinHalf * sign) * bandRadius;
      }
    }
    const edgeSegments = new Float32Array(sampleCount * 12);
    for (let i = 0; i < sampleCount; i += 1) {
      const next = (i + 1) % sampleCount;
      edgeSegments.set(upperPath.subarray(i * 3, i * 3 + 3), i * 12);
      edgeSegments.set(upperPath.subarray(next * 3, next * 3 + 3), i * 12 + 3);
      edgeSegments.set(lowerPath.subarray(i * 3, i * 3 + 3), i * 12 + 6);
      edgeSegments.set(lowerPath.subarray(next * 3, next * 3 + 3), i * 12 + 9);
    }
    const bandGeometry = new THREE.BufferGeometry();
    bandGeometry.setAttribute("position", new THREE.BufferAttribute(edgeSegments, 3));
    this.eclipticBand = new THREE.LineSegments(
      bandGeometry,
      new THREE.LineBasicMaterial({
        color: 0x7fb4b8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.eclipticBand.renderOrder = -4;
    this.eclipticBand.frustumCulled = false;
    this.eclipticBand.visible = false;

    // Translucent fill between the edge lines.
    const fillPositions = new Float32Array((sampleCount + 1) * 6);
    const fillIndices: number[] = [];
    for (let i = 0; i <= sampleCount; i += 1) {
      const wrapped = i % sampleCount;
      fillPositions.set(upperPath.subarray(wrapped * 3, wrapped * 3 + 3), i * 6);
      fillPositions.set(lowerPath.subarray(wrapped * 3, wrapped * 3 + 3), i * 6 + 3);
      if (i < sampleCount) {
        const a = i * 2;
        fillIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const fillGeometry = new THREE.BufferGeometry();
    fillGeometry.setAttribute("position", new THREE.BufferAttribute(fillPositions, 3));
    fillGeometry.setIndex(fillIndices);
    this.eclipticBandFill = new THREE.Mesh(
      fillGeometry,
      new THREE.MeshBasicMaterial({
        color: 0x7fb4b8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.eclipticBandFill.renderOrder = -4;
    this.eclipticBandFill.frustumCulled = false;
    this.eclipticBandFill.visible = false;

    // Earth-anchored guides: geometry lives in EQJ meters (orbit) or local
    // meters (sun ray); per frame they are positioned at the Earth's render
    // center and uniformly scaled by render-units-per-meter. LineSegments,
    // not LineLoop: the WebGPU-flavored renderer does not draw line loops.
    const orbitMaterial = new THREE.LineBasicMaterial({
      color: 0x9fd8dc,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.moonOrbitGuide = new THREE.LineSegments(new THREE.BufferGeometry(), orbitMaterial);
    this.moonOrbitGuide.renderOrder = -4;
    this.moonOrbitGuide.frustumCulled = false;
    this.moonOrbitGuide.visible = false;

    const sunGuideMaterial = new THREE.LineBasicMaterial({
      color: 0xf5c977,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sunGuideGeometry = new THREE.BufferGeometry();
    sunGuideGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    this.sunDirectionGuide = new THREE.LineSegments(sunGuideGeometry, sunGuideMaterial);
    this.sunDirectionGuide.renderOrder = -4;
    this.sunDirectionGuide.frustumCulled = false;
    this.sunDirectionGuide.visible = false;

    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xfff3dc });
    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), sunMaterial);
    this.sunDisc.renderOrder = -5;

    const glowMaterial = new THREE.SpriteMaterial({
      map: buildGlowTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sunGlow = new THREE.Sprite(glowMaterial);
    this.sunGlow.renderOrder = -5;

    // The Moon's terminator comes from physical geometry: shade the sphere by
    // the true Sun direction. A touch of earthshine keeps the night side legible.
    const moonMaterial = new THREE.MeshBasicNodeMaterial();
    const lit = max(float(0), dot(normalWorld, this.moonSunDirectionUniform));
    moonMaterial.colorNode = mul(vec3(0.86, 0.85, 0.82), add(mul(lit, 0.95), 0.035));
    this.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), moonMaterial);
    this.moonMesh.renderOrder = -5;

    this.group.add(
      this.starPoints,
      this.planetPoints,
      this.sunDisc,
      this.sunGlow,
      this.moonMesh,
      this.moonOrbitGuide,
      this.sunDirectionGuide,
      this.eclipticBand,
      this.eclipticBandFill,
    );
  }

  /** Point-size multiplier compensating for device pixel ratio. */
  setSizeScale(scale: number): void {
    pointsUniforms(this.starPoints).sizeScaleUniform.value = scale;
    pointsUniforms(this.planetPoints).sizeScaleUniform.value = scale;
  }

  /** Apply a fresh astronomy snapshot (called about once per second). */
  updateAstronomy(sky: SkyState): void {
    // Star field: EQJ -> local Three via the snapshot's rotation matrix.
    const m = sky.eqjToLocalThree;
    const rotation = new THREE.Matrix4().set(
      m[0],
      m[1],
      m[2],
      0,
      m[3],
      m[4],
      m[5],
      0,
      m[6],
      m[7],
      m[8],
      0,
      0,
      0,
      0,
      1,
    );
    this.starPoints.quaternion.setFromRotationMatrix(rotation);
    // The Moon orbit guide and ecliptic band live in EQJ; share the rotation.
    this.moonOrbitGuide.quaternion.copy(this.starPoints.quaternion);
    this.eclipticBand.quaternion.copy(this.starPoints.quaternion);
    this.eclipticBandFill.quaternion.copy(this.starPoints.quaternion);

    this.placeBody(this.sunDisc, sky.sun);
    const sunGlowDistance = BODY_SHELL_RENDER_RADIUS * 0.98;
    this.sunGlow.position.set(...sky.sun.directionLocalThree).multiplyScalar(sunGlowDistance);
    const glowScale = sunGlowDistance * Math.tan(8 * DEG);
    this.sunGlow.scale.setScalar(glowScale);

    // The Moon mesh itself is placed per frame from the current altitude
    // (computeMoonPlacement); here only its lighting direction refreshes.
    this.moonSunDirectionUniform.value.set(...sky.sun.directionLocalThree);

    const sunGuidePositions = this.sunDirectionGuide.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const [sunX, sunY, sunZ] = sky.sun.directionLocalThree;
    const sunGuideLengthM = 60_000_000;
    sunGuidePositions.setXYZ(0, 0, 0, 0);
    sunGuidePositions.setXYZ(
      1,
      sunX * sunGuideLengthM,
      sunY * sunGuideLengthM,
      sunZ * sunGuideLengthM,
    );
    sunGuidePositions.needsUpdate = true;

    // Planets: positions, brightness, and warm/cool tints by magnitude.
    const positionAttribute = this.planetPoints.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const colorAttribute = this.planetPoints.geometry.getAttribute(
      "color",
    ) as THREE.BufferAttribute;
    const sizeAttribute = this.planetPoints.geometry.getAttribute(
      "starSize",
    ) as THREE.BufferAttribute;
    sky.planets.forEach((planet, index) => {
      const [x, y, z] = planet.directionLocalThree;
      positionAttribute.setXYZ(
        index,
        x * STAR_SHELL_RENDER_RADIUS,
        y * STAR_SHELL_RENDER_RADIUS,
        z * STAR_SHELL_RENDER_RADIUS,
      );
      const brightness = brightnessFromMagnitude(planet.magnitude);
      const tint = planet.id === "mars" ? [1, 0.72, 0.55] : [1, 0.97, 0.9];
      colorAttribute.setXYZ(
        index,
        tint[0]! * brightness,
        tint[1]! * brightness,
        tint[2]! * brightness,
      );
      sizeAttribute.setX(index, 1.6 + 2.6 * brightness);
    });
    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
    sizeAttribute.needsUpdate = true;
  }

  /**
   * Per-frame altitude response: the sky shell is camera-anchored, so only
   * visibility changes with altitude (space is star-filled even at noon).
   * `systemReveal` fades the sky-proxy Sun and planet points out as the
   * physical heliocentric layer takes over.
   */
  updateAltitude(
    altitudeM: number,
    sunAltitudeDeg: number,
    systemReveal = 0,
    eclipticBandEnabled = true,
  ): void {
    const spaceFactor = smoothstepNumber(40_000, 400_000, altitudeM);

    // The sky-shell ecliptic hands off to the heliocentric rings and orbit
    // lines as the physical system fades in.
    const bandOpacity = eclipticBandEnabled ? 0.14 * (1 - systemReveal) : 0;
    this.eclipticBand.visible = bandOpacity > 0.003;
    (this.eclipticBand.material as THREE.LineBasicMaterial).opacity = bandOpacity;
    this.eclipticBandFill.visible = bandOpacity > 0.003;
    (this.eclipticBandFill.material as THREE.MeshBasicMaterial).opacity = bandOpacity * 0.3;
    const groundStarOpacity = clamp01((-sunAltitudeDeg - 3) / 11);
    const starOpacity = Math.max(groundStarOpacity, spaceFactor * 0.85);
    this.setPointsOpacity(this.starPoints, starOpacity);
    const groundPlanetOpacity = clamp01((-sunAltitudeDeg + 1) / 8);
    this.setPointsOpacity(
      this.planetPoints,
      Math.max(groundPlanetOpacity, spaceFactor * 0.9) * (1 - systemReveal),
    );

    const sunProxyOpacity = 1 - systemReveal;
    const sunDiscMaterial = this.sunDisc.material as THREE.MeshBasicMaterial;
    sunDiscMaterial.transparent = systemReveal > 0;
    sunDiscMaterial.opacity = sunProxyOpacity;
    this.sunDisc.visible = sunProxyOpacity > 0.01;
    const sunGlowMaterial = this.sunGlow.material as THREE.SpriteMaterial;
    sunGlowMaterial.opacity = sunProxyOpacity;
    this.sunGlow.visible = sunProxyOpacity > 0.01;
  }

  /** Per-frame Moon mesh placement (proxy shell near ground, physical beyond). */
  updateMoonPlacement(placement: MoonPlacement): void {
    const [x, y, z] = placement.rayLocal;
    this.moonMesh.position.set(
      x * placement.renderDistance,
      y * placement.renderDistance,
      z * placement.renderDistance,
    );
    this.moonMesh.scale.setScalar(Math.max(1e-7, placement.renderRadius));
  }

  /** Replace the Moon orbit guide geometry (EQJ meters, flattened xyz). */
  setMoonOrbitGeometry(pointsEqjM: Float32Array): void {
    // Expand the closed path into segment pairs for LineSegments, and swap in
    // a fresh geometry (the WebGPU renderer caches attribute layouts).
    const sampleCount = pointsEqjM.length / 3;
    const segments = new Float32Array(sampleCount * 6);
    for (let i = 0; i < sampleCount; i += 1) {
      const next = (i + 1) % sampleCount;
      segments[i * 6] = pointsEqjM[i * 3]!;
      segments[i * 6 + 1] = pointsEqjM[i * 3 + 1]!;
      segments[i * 6 + 2] = pointsEqjM[i * 3 + 2]!;
      segments[i * 6 + 3] = pointsEqjM[next * 3]!;
      segments[i * 6 + 4] = pointsEqjM[next * 3 + 1]!;
      segments[i * 6 + 5] = pointsEqjM[next * 3 + 2]!;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(segments, 3));
    const previous = this.moonOrbitGuide.geometry;
    this.moonOrbitGuide.geometry = geometry;
    previous.dispose();
  }

  /** Per-frame Earth-anchored guide placement and system-scale fades. */
  updateEarthAnchored(
    earthCenterRender: THREE.Vector3,
    renderUnitsPerMeter: number,
    altitudeM: number,
    gates: { moonOrbit: boolean; sunGuide: boolean },
  ): void {
    const reveal = smoothstepNumber(4_000_000, 30_000_000, altitudeM);
    // The short sunlight-direction pointer retires once the physical Sun and
    // Earth's actual orbit line take over — a truncated ray at system scale
    // reads as a broken orbit, not a light direction.
    const sunGuideFade = 1 - smoothstepNumber(1e9, 6e9, altitudeM);
    const guideStates: ReadonlyArray<[THREE.LineSegments, boolean, number]> = [
      [this.moonOrbitGuide, gates.moonOrbit, 1],
      [this.sunDirectionGuide, gates.sunGuide, sunGuideFade],
    ];
    for (const [guide, enabled, fade] of guideStates) {
      guide.position.copy(earthCenterRender);
      guide.scale.setScalar(renderUnitsPerMeter);
      const opacity = reveal * fade * 0.4;
      guide.visible = enabled && opacity > 0.003;
      (guide.material as THREE.LineBasicMaterial).opacity = opacity;
    }
  }

  private setPointsOpacity(points: THREE.Points, value: number): void {
    pointsUniforms(points).opacityUniform.value = value;
    points.visible = value > 0.003;
  }

  private placeBody(mesh: THREE.Object3D, body: SkyBodyState): void {
    const [x, y, z] = body.directionLocalThree;
    mesh.position.set(
      x * BODY_SHELL_RENDER_RADIUS,
      y * BODY_SHELL_RENDER_RADIUS,
      z * BODY_SHELL_RENDER_RADIUS,
    );
    const angularRadiusRad = body.angularRadiusDeg * DEG;
    mesh.scale.setScalar(BODY_SHELL_RENDER_RADIUS * Math.tan(angularRadiusRad));
    if (mesh instanceof THREE.Mesh && mesh.geometry instanceof THREE.CircleGeometry) {
      mesh.lookAt(0, 0, 0);
    }
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstepNumber(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
