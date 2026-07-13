import { describe, expect, it } from "vitest";

import {
  computeEarthOrbitEqjM,
  computeEclipticRingEqjM,
  computePlanetOrbitEqjM,
  eclipticNorthEqj,
  PLANET_IDS,
  type PlanetId,
} from "../astronomy/planet-orbits";
import { computeSkyState } from "../astronomy/sky-state";
import { METERS_PER_AU } from "../coordinates/units";

const FIXED_UTC_MS = Date.parse("2026-07-24T02:30:00Z");

// Perihelion/aphelion bands with small tolerance, in AU.
const HELIO_DISTANCE_BANDS_AU: Record<PlanetId, readonly [number, number]> = {
  mercury: [0.3, 0.48],
  venus: [0.71, 0.74],
  mars: [1.35, 1.7],
  jupiter: [4.9, 5.5],
  saturn: [9.0, 10.2],
  uranus: [18.2, 20.2],
  neptune: [29.7, 30.5],
  pluto: [29.5, 49.5],
};

// Orbital inclinations to the ecliptic are small (Pluto's 17° is the largest).
const MAX_ECLIPTIC_LATITUDE_SIN: Record<PlanetId, number> = {
  mercury: Math.sin((8 * Math.PI) / 180),
  venus: Math.sin((4.5 * Math.PI) / 180),
  mars: Math.sin((2.5 * Math.PI) / 180),
  jupiter: Math.sin((2 * Math.PI) / 180),
  saturn: Math.sin((3 * Math.PI) / 180),
  uranus: Math.sin((1.5 * Math.PI) / 180),
  neptune: Math.sin((2.5 * Math.PI) / 180),
  pluto: Math.sin((17.5 * Math.PI) / 180),
};

describe("heliocentric solar system (frame: EQJ, units: meters)", () => {
  const sky = computeSkyState(FIXED_UTC_MS, 39.7684, -86.1581);
  const eclipticNorth = eclipticNorthEqj();

  it("places every planet inside its physical distance band from the Sun", () => {
    for (const planet of sky.planets) {
      const radiusAu =
        Math.hypot(planet.helioEqjM[0], planet.helioEqjM[1], planet.helioEqjM[2]) / METERS_PER_AU;
      const [low, high] = HELIO_DISTANCE_BANDS_AU[planet.id as PlanetId]!;
      expect(radiusAu, planet.id).toBeGreaterThan(low);
      expect(radiusAu, planet.id).toBeLessThan(high);
    }
  });

  it("keeps Earth near 1 AU and every planet near the ecliptic plane", () => {
    const earthAu =
      Math.hypot(sky.earthHelioEqjM[0], sky.earthHelioEqjM[1], sky.earthHelioEqjM[2]) /
      METERS_PER_AU;
    expect(earthAu).toBeGreaterThan(0.98);
    expect(earthAu).toBeLessThan(1.02);

    for (const planet of sky.planets) {
      const radius = Math.hypot(planet.helioEqjM[0], planet.helioEqjM[1], planet.helioEqjM[2]);
      const outOfPlane =
        (planet.helioEqjM[0] * eclipticNorth[0] +
          planet.helioEqjM[1] * eclipticNorth[1] +
          planet.helioEqjM[2] * eclipticNorth[2]) /
        radius;
      expect(Math.abs(outOfPlane), planet.id).toBeLessThan(
        MAX_ECLIPTIC_LATITUDE_SIN[planet.id as PlanetId]!,
      );
    }
  });

  it("orbit lines stay inside each planet's distance band", () => {
    for (const planetId of PLANET_IDS) {
      const points = computePlanetOrbitEqjM(planetId, FIXED_UTC_MS, 48);
      const [low, high] = HELIO_DISTANCE_BANDS_AU[planetId]!;
      for (let i = 0; i < points.length / 3; i += 1) {
        const radiusAu =
          Math.hypot(points[i * 3]!, points[i * 3 + 1]!, points[i * 3 + 2]!) / METERS_PER_AU;
        expect(radiusAu, planetId).toBeGreaterThan(low * 0.99);
        expect(radiusAu, planetId).toBeLessThan(high * 1.01);
      }
    }
  });

  it("Earth's orbit line stays near 1 AU and near the ecliptic", () => {
    const points = computeEarthOrbitEqjM(FIXED_UTC_MS, 48);
    const north = eclipticNorthEqj();
    for (let i = 0; i < points.length / 3; i += 1) {
      const x = points[i * 3]!;
      const y = points[i * 3 + 1]!;
      const z = points[i * 3 + 2]!;
      const radiusAu = Math.hypot(x, y, z) / METERS_PER_AU;
      expect(radiusAu).toBeGreaterThan(0.975);
      expect(radiusAu).toBeLessThan(1.02);
      // Earth defines the ecliptic to well under a degree.
      const latitudeSin = (x * north[0] + y * north[1] + z * north[2]) / (radiusAu * METERS_PER_AU);
      expect(Math.abs(latitudeSin)).toBeLessThan(Math.sin((0.1 * Math.PI) / 180));
    }
  });

  it("ecliptic rings lie exactly in the ecliptic plane at the requested radius", () => {
    const ring = computeEclipticRingEqjM(10, 32);
    for (let i = 0; i < ring.length / 3; i += 1) {
      const x = ring[i * 3]!;
      const y = ring[i * 3 + 1]!;
      const z = ring[i * 3 + 2]!;
      expect(Math.hypot(x, y, z) / METERS_PER_AU).toBeCloseTo(10, 6);
      const outOfPlane = x * eclipticNorth[0] + y * eclipticNorth[1] + z * eclipticNorth[2];
      // Float32 storage quantizes to ~1e-7 relative; 1e-5 AU is ~1500 km.
      expect(Math.abs(outOfPlane) / METERS_PER_AU).toBeLessThan(1e-5);
    }
  });

  it("ecliptic north is a unit vector tilted by the obliquity from the equatorial pole", () => {
    const [x, y, z] = eclipticNorthEqj();
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 10);
    const obliquityDeg = (Math.acos(z) * 180) / Math.PI;
    expect(obliquityDeg).toBeGreaterThan(23.4);
    expect(obliquityDeg).toBeLessThan(23.5);
  });
});
