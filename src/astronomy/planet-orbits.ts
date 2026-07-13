import {
  Body,
  HelioVector,
  MakeTime,
  PlanetOrbitalPeriod,
  Rotation_ECL_EQJ,
} from "astronomy-engine";

import { METERS_PER_AU } from "../coordinates/units";
import type { SkyBodyId } from "./sky-state";

export type PlanetId = Exclude<SkyBodyId, "sun" | "moon">;

const PLANET_BODIES: Record<PlanetId, Body> = {
  mercury: Body.Mercury,
  venus: Body.Venus,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
};

export const PLANET_IDS = Object.keys(PLANET_BODIES) as readonly PlanetId[];

export const ORBIT_SAMPLE_COUNT = 192;

/**
 * One full orbit of heliocentric J2000-equatorial (EQJ) positions in meters,
 * sampled from astronomy-engine over the planet's true orbital period and
 * centered on `utcMs`. Precomputed once at startup — orbits are stable on the
 * lifetime of a browsing session.
 */
export function computePlanetOrbitEqjM(
  planetId: PlanetId,
  utcMs: number,
  sampleCount = ORBIT_SAMPLE_COUNT,
): Float32Array {
  const body = PLANET_BODIES[planetId];
  const periodMs = PlanetOrbitalPeriod(body) * 86_400_000;
  const points = new Float32Array(sampleCount * 3);
  for (let i = 0; i < sampleCount; i += 1) {
    const sampleMs = utcMs - periodMs / 2 + (i / sampleCount) * periodMs;
    const helio = HelioVector(body, MakeTime(new Date(sampleMs)));
    points[i * 3] = helio.x * METERS_PER_AU;
    points[i * 3 + 1] = helio.y * METERS_PER_AU;
    points[i * 3 + 2] = helio.z * METERS_PER_AU;
  }
  return points;
}

/**
 * Earth's own year around the Sun, sampled like the planet orbits — the
 * observer's path through the solar system.
 */
export function computeEarthOrbitEqjM(utcMs: number, sampleCount = ORBIT_SAMPLE_COUNT): Float32Array {
  const periodMs = PlanetOrbitalPeriod(Body.Earth) * 86_400_000;
  const points = new Float32Array(sampleCount * 3);
  for (let i = 0; i < sampleCount; i += 1) {
    const sampleMs = utcMs - periodMs / 2 + (i / sampleCount) * periodMs;
    const helio = HelioVector(Body.Earth, MakeTime(new Date(sampleMs)));
    points[i * 3] = helio.x * METERS_PER_AU;
    points[i * 3 + 1] = helio.y * METERS_PER_AU;
    points[i * 3 + 2] = helio.z * METERS_PER_AU;
  }
  return points;
}

/**
 * A circle of `radiusAu` lying exactly in the J2000 ecliptic plane, expressed
 * in EQJ meters — the guide geometry that makes the plane of the solar system
 * visible.
 */
export function computeEclipticRingEqjM(radiusAu: number, sampleCount = 128): Float32Array {
  const { rot } = Rotation_ECL_EQJ();
  const points = new Float32Array(sampleCount * 3);
  const radiusM = radiusAu * METERS_PER_AU;
  for (let i = 0; i < sampleCount; i += 1) {
    const angle = (i / sampleCount) * Math.PI * 2;
    const ecl = [radiusM * Math.cos(angle), radiusM * Math.sin(angle), 0] as const;
    // astronomy-engine matrices are rot[source][target].
    points[i * 3] = rot[0]![0]! * ecl[0] + rot[1]![0]! * ecl[1] + rot[2]![0]! * ecl[2];
    points[i * 3 + 1] = rot[0]![1]! * ecl[0] + rot[1]![1]! * ecl[1] + rot[2]![1]! * ecl[2];
    points[i * 3 + 2] = rot[0]![2]! * ecl[0] + rot[1]![2]! * ecl[1] + rot[2]![2]! * ecl[2];
  }
  return points;
}

/** J2000 ecliptic north pole as an EQJ unit vector. */
export function eclipticNorthEqj(): readonly [number, number, number] {
  const { rot } = Rotation_ECL_EQJ();
  return [rot[2]![0]!, rot[2]![1]!, rot[2]![2]!];
}
