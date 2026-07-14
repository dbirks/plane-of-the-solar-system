import * as THREE from "three/webgpu";

import {
  computeEarthOrbitEqjM,
  computeEclipticRingEqjM,
  computePlanetOrbitEqjM,
  PLANET_IDS,
  type PlanetId,
} from "../../astronomy/planet-orbits";
import type { SkyState } from "../../astronomy/sky-state";

const SUN_RADIUS_M = 695_700_000;

const PLANET_COLORS: Record<PlanetId, number> = {
  mercury: 0xb5aa9e,
  venus: 0xe8d9b0,
  mars: 0xd98a66,
  jupiter: 0xd9b38c,
  saturn: 0xe3cfa0,
  uranus: 0xa8dbe0,
  neptune: 0x7ba7e8,
  pluto: 0xc4b09a,
};

const ECLIPTIC_RING_RADII_AU = [10, 20, 30, 40] as const;

/** Expand a closed sample path into LineSegments pairs. */
function closedPathToSegments(path: Float32Array): Float32Array {
  const sampleCount = path.length / 3;
  const segments = new Float32Array(sampleCount * 6);
  for (let i = 0; i < sampleCount; i += 1) {
    const next = (i + 1) % sampleCount;
    segments[i * 6] = path[i * 3]!;
    segments[i * 6 + 1] = path[i * 3 + 1]!;
    segments[i * 6 + 2] = path[i * 3 + 2]!;
    segments[i * 6 + 3] = path[next * 3]!;
    segments[i * 6 + 4] = path[next * 3 + 1]!;
    segments[i * 6 + 5] = path[next * 3 + 2]!;
  }
  return segments;
}

function buildLineSegments(
  segments: Float32Array,
  color: number,
  baseOpacity: number,
): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(segments, 3));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const line = new THREE.LineSegments(geometry, material);
  line.frustumCulled = false;
  line.renderOrder = -4;
  line.userData["baseOpacity"] = baseOpacity;
  return line;
}

/**
 * The heliocentric scene: Sun, planets at true radii and current positions,
 * precomputed orbit lines, and faint ecliptic-plane rings. Geometry lives in
 * EQJ meters; the root group is oriented by the star-field rotation, anchored
 * to Earth's render center, and uniformly scaled — so proportions stay true
 * and nothing is ever enlarged.
 */
export class SolarSystemLayer {
  /** Root: EQJ meters → local render space (rotate, translate, scale). */
  readonly group = new THREE.Group();
  /** Children positioned heliocentrically; offset by −earthHelio each tick. */
  private readonly helioGroup = new THREE.Group();

  private readonly planetMeshes = new Map<PlanetId, THREE.Mesh>();
  private readonly fadeLines: THREE.LineSegments[] = [];
  private readonly sunCore: THREE.Mesh;
  private readonly sunGlow: THREE.Sprite;
  private orbitsBuilt = false;

  constructor(glowTexture: THREE.Texture) {
    this.group.add(this.helioGroup);

    this.sunCore = new THREE.Mesh(
      new THREE.SphereGeometry(SUN_RADIUS_M, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff2d5 }),
    );
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0,
    });
    this.sunGlow = new THREE.Sprite(glowMaterial);
    this.sunGlow.scale.setScalar(SUN_RADIUS_M * 30);
    this.helioGroup.add(this.sunCore, this.sunGlow);

    for (const planetId of PLANET_IDS) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 12),
        new THREE.MeshBasicMaterial({ color: PLANET_COLORS[planetId] }),
      );
      mesh.frustumCulled = false;
      this.planetMeshes.set(planetId, mesh);
      this.helioGroup.add(mesh);
    }

    for (const radiusAu of ECLIPTIC_RING_RADII_AU) {
      const ring = buildLineSegments(
        closedPathToSegments(computeEclipticRingEqjM(radiusAu)),
        0x7fb4b8,
        0.07,
      );
      ring.userData["kind"] = "ecliptic";
      this.fadeLines.push(ring);
      this.helioGroup.add(ring);
    }

    this.group.visible = false;
  }

  /** Build orbit lines once (≈1700 astronomy samples; ~a frame's budget). */
  buildOrbits(utcMs: number): void {
    if (this.orbitsBuilt) return;
    this.orbitsBuilt = true;
    for (const planetId of PLANET_IDS) {
      const orbit = buildLineSegments(
        closedPathToSegments(computePlanetOrbitEqjM(planetId, utcMs)),
        0x9fd8dc,
        0.2,
      );
      orbit.userData["kind"] = "orbit";
      this.fadeLines.push(orbit);
      this.helioGroup.add(orbit);
    }
    // Earth's own year — the observer's path — slightly brighter and warmer
    // so "this is the line I travel" stands out from the planet orbits.
    const earthOrbit = buildLineSegments(
      closedPathToSegments(computeEarthOrbitEqjM(utcMs)),
      0x9ec8ff,
      0.32,
    );
    earthOrbit.userData["kind"] = "orbit";
    this.fadeLines.push(earthOrbit);
    this.helioGroup.add(earthOrbit);
  }

  /** Apply an astronomy snapshot: orientation, Earth offset, planet positions and radii. */
  updateAstronomy(sky: SkyState): void {
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
    this.group.quaternion.setFromRotationMatrix(rotation);
    this.helioGroup.position.set(
      -sky.earthHelioEqjM[0],
      -sky.earthHelioEqjM[1],
      -sky.earthHelioEqjM[2],
    );
    for (const planet of sky.planets) {
      const mesh = this.planetMeshes.get(planet.id as PlanetId);
      if (!mesh) continue;
      mesh.position.set(planet.helioEqjM[0], planet.helioEqjM[1], planet.helioEqjM[2]);
      mesh.scale.setScalar(planet.radiusM);
    }
  }

  /** Per-frame anchoring, system-scale reveal, and layer gating. */
  updateFrame(
    earthCenterRender: THREE.Vector3,
    renderUnitsPerMeter: number,
    reveal: number,
    gates: { orbitLines: boolean; eclipticRings: boolean },
  ): void {
    this.group.visible = reveal > 0.003;
    if (!this.group.visible) return;
    this.group.position.copy(earthCenterRender);
    this.group.scale.setScalar(renderUnitsPerMeter);
    for (const line of this.fadeLines) {
      const enabled = line.userData["kind"] === "ecliptic" ? gates.eclipticRings : gates.orbitLines;
      line.visible = enabled;
      (line.material as THREE.LineBasicMaterial).opacity =
        reveal * (line.userData["baseOpacity"] as number);
    }
    (this.sunGlow.material as THREE.SpriteMaterial).opacity = reveal * 0.85;
    (this.sunCore.material as THREE.MeshBasicMaterial).opacity = 1;
  }
}
