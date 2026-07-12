import { Body, Equator, MakeTime, Observer } from "astronomy-engine";
import { describe, expect, it } from "vitest";

import { altAzToLocalThree, computeSkyState } from "../astronomy/sky-state";
import type { Vec3d } from "../coordinates/vec3d";
import {
  referenceMoonAltAz,
  referenceMoonIlluminatedFraction,
  referenceSunAltAz,
} from "./meeus-reference";

// Fixed epochs across seasons, hemispheres, and times of day.
const FIXED_CASES = [
  {
    name: "Indianapolis summer evening",
    utcMs: Date.parse("2026-07-11T22:00:00Z"),
    latitudeDeg: 39.7684,
    longitudeDeg: -86.1581,
  },
  {
    name: "Sydney winter morning",
    utcMs: Date.parse("2026-01-15T06:00:00Z"),
    latitudeDeg: -33.8688,
    longitudeDeg: 151.2093,
  },
  {
    name: "Reykjavik equinox midnight",
    utcMs: Date.parse("2026-03-20T00:00:00Z"),
    latitudeDeg: 64.1466,
    longitudeDeg: -21.9426,
  },
  {
    name: "Quito autumn night",
    utcMs: Date.parse("2025-10-05T04:30:00Z"),
    latitudeDeg: -0.1807,
    longitudeDeg: -78.4678,
  },
] as const;

function separationDeg(a: Vec3d, b: Vec3d): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
}

describe("computeSkyState against independent Meeus reference (frames: HOR geometric, units: degrees)", () => {
  for (const testCase of FIXED_CASES) {
    it(`Sun direction matches within 0.3 degrees — ${testCase.name}`, () => {
      const sky = computeSkyState(testCase.utcMs, testCase.latitudeDeg, testCase.longitudeDeg);
      const reference = referenceSunAltAz(
        testCase.utcMs,
        testCase.latitudeDeg,
        testCase.longitudeDeg,
      );
      const engineDirection = altAzToLocalThree(sky.sun.geometricAltitudeDeg, sky.sun.azimuthDeg);
      const referenceDirection = altAzToLocalThree(reference.altitudeDeg, reference.azimuthDeg);
      expect(separationDeg(engineDirection, referenceDirection)).toBeLessThan(0.3);
    });

    it(`Moon direction matches within 0.5 degrees — ${testCase.name}`, () => {
      const sky = computeSkyState(testCase.utcMs, testCase.latitudeDeg, testCase.longitudeDeg);
      const reference = referenceMoonAltAz(
        testCase.utcMs,
        testCase.latitudeDeg,
        testCase.longitudeDeg,
      );
      const engineDirection = altAzToLocalThree(sky.moon.geometricAltitudeDeg, sky.moon.azimuthDeg);
      const referenceDirection = altAzToLocalThree(reference.altitudeDeg, reference.azimuthDeg);
      expect(separationDeg(engineDirection, referenceDirection)).toBeLessThan(0.5);
    });

    it(`Moon topocentric distance matches within 1500 km — ${testCase.name}`, () => {
      const sky = computeSkyState(testCase.utcMs, testCase.latitudeDeg, testCase.longitudeDeg);
      const reference = referenceMoonAltAz(
        testCase.utcMs,
        testCase.latitudeDeg,
        testCase.longitudeDeg,
      );
      expect(Math.abs(sky.moon.distanceM / 1000 - reference.topocentricDistanceKm)).toBeLessThan(
        1500,
      );
    });

    it(`Moon illuminated fraction matches within 0.02 and derives from phase geometry — ${testCase.name}`, () => {
      const sky = computeSkyState(testCase.utcMs, testCase.latitudeDeg, testCase.longitudeDeg);
      const reference = referenceMoonIlluminatedFraction(testCase.utcMs);
      expect(Math.abs(sky.moon.illuminatedFraction - reference)).toBeLessThan(0.02);
      // moonPhaseDeg is ecliptic elongation: 0 new, 180 full. Illuminated
      // fraction must be consistent with it: k ≈ (1 − cos(phase)) / 2.
      const fromPhase = (1 - Math.cos((sky.moonPhaseDeg * Math.PI) / 180)) / 2;
      expect(Math.abs(sky.moon.illuminatedFraction - fromPhase)).toBeLessThan(0.02);
    });

    it(`star-field EQJ rotation agrees with per-body alt-az path within 0.1 degrees — ${testCase.name}`, () => {
      const sky = computeSkyState(testCase.utcMs, testCase.latitudeDeg, testCase.longitudeDeg);
      const m = sky.eqjToLocalThree;
      // The matrix must be a rotation: rows orthonormal.
      const rows: Vec3d[] = [
        [m[0], m[1], m[2]],
        [m[3], m[4], m[5]],
        [m[6], m[7], m[8]],
      ];
      for (let i = 0; i < 3; i += 1) {
        const [x, y, z] = rows[i]!;
        expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
        for (let j = i + 1; j < 3; j += 1) {
          const [ox, oy, oz] = rows[j]!;
          expect(Math.abs(x * ox + y * oy + z * oz)).toBeLessThan(1e-9);
        }
      }
      // Probe the star path with the Moon: its topocentric EQJ direction pushed
      // through eqjToLocalThree must land where the alt-az path put it.
      const time = MakeTime(new Date(testCase.utcMs));
      const observer = new Observer(testCase.latitudeDeg, testCase.longitudeDeg, 0);
      const eqj = Equator(Body.Moon, time, observer, false, true);
      const raRad = (eqj.ra * 15 * Math.PI) / 180;
      const decRad = (eqj.dec * Math.PI) / 180;
      const eqjUnit: Vec3d = [
        Math.cos(decRad) * Math.cos(raRad),
        Math.cos(decRad) * Math.sin(raRad),
        Math.sin(decRad),
      ];
      const viaStarPath: Vec3d = [
        m[0] * eqjUnit[0] + m[1] * eqjUnit[1] + m[2] * eqjUnit[2],
        m[3] * eqjUnit[0] + m[4] * eqjUnit[1] + m[5] * eqjUnit[2],
        m[6] * eqjUnit[0] + m[7] * eqjUnit[1] + m[8] * eqjUnit[2],
      ];
      const viaAltAzPath = altAzToLocalThree(sky.moon.geometricAltitudeDeg, sky.moon.azimuthDeg);
      expect(separationDeg(viaStarPath, viaAltAzPath)).toBeLessThan(0.1);
    });
  }

  it("altAzToLocalThree maps compass directions into the local Three frame", () => {
    const north = altAzToLocalThree(0, 0);
    expect(north[0]).toBeCloseTo(0, 10);
    expect(north[1]).toBeCloseTo(0, 10);
    expect(north[2]).toBeCloseTo(-1, 10);

    const east = altAzToLocalThree(0, 90);
    expect(east[0]).toBeCloseTo(1, 10);
    expect(east[2]).toBeCloseTo(0, 10);

    const zenith = altAzToLocalThree(90, 123);
    expect(zenith[1]).toBeCloseTo(1, 10);
  });

  it("Sun and Moon angular radii are physically plausible", () => {
    const sky = computeSkyState(
      FIXED_CASES[0].utcMs,
      FIXED_CASES[0].latitudeDeg,
      FIXED_CASES[0].longitudeDeg,
    );
    expect(sky.sun.angularRadiusDeg).toBeGreaterThan(0.255);
    expect(sky.sun.angularRadiusDeg).toBeLessThan(0.28);
    expect(sky.moon.angularRadiusDeg).toBeGreaterThan(0.24);
    expect(sky.moon.angularRadiusDeg).toBeLessThan(0.3);
  });

  it("returns the eight planets to Pluto with finite state", () => {
    const sky = computeSkyState(
      FIXED_CASES[0].utcMs,
      FIXED_CASES[0].latitudeDeg,
      FIXED_CASES[0].longitudeDeg,
    );
    expect(sky.planets.map((planet) => planet.id)).toEqual([
      "mercury",
      "venus",
      "mars",
      "jupiter",
      "saturn",
      "uranus",
      "neptune",
      "pluto",
    ]);
    for (const planet of sky.planets) {
      expect(Number.isFinite(planet.altitudeDeg)).toBe(true);
      expect(Number.isFinite(planet.azimuthDeg)).toBe(true);
      expect(Number.isFinite(planet.magnitude)).toBe(true);
      expect(planet.distanceM).toBeGreaterThan(0.2 * 1.496e11);
    }
  });
});
