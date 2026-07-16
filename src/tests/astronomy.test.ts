import { Body, Equator, MakeTime, Observer } from "astronomy-engine";
import { describe, expect, it } from "vitest";

import { marsSeasonLabel, marsSolarLongitudeDeg } from "../astronomy/mars-season";
import { computeEclipticRingEqjM, eclipticNorthEqj } from "../astronomy/planet-orbits";
import {
  altAzToLocalThree,
  computeSkyState,
  computeSunHorizonEvents,
} from "../astronomy/sky-state";
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

describe("computeSunHorizonEvents (azimuth degrees, north→east)", () => {
  it("puts July sunset in the northwest and sunrise in the northeast at mid-northern latitude", () => {
    const events = computeSunHorizonEvents(Date.parse("2026-07-24T02:30:00Z"), 39.7684, -86.1581);
    expect(events).not.toBeNull();
    // Summer sun sets north of due west and rises north of due east.
    expect(events!.setAzimuthDeg).toBeGreaterThan(280);
    expect(events!.setAzimuthDeg).toBeLessThan(320);
    expect(events!.riseAzimuthDeg).toBeGreaterThan(40);
    expect(events!.riseAzimuthDeg).toBeLessThan(80);
  });

  it("returns null in polar day", () => {
    expect(computeSunHorizonEvents(Date.parse("2026-06-21T12:00:00Z"), 80, 0)).toBeNull();
  });

  it("reports event times bracketing a night-time query", () => {
    const utcMs = Date.parse("2026-07-24T02:30:00Z"); // 10:30pm EDT
    const events = computeSunHorizonEvents(utcMs, 39.7684, -86.1581);
    expect(events).not.toBeNull();
    // The most recent sunset was one-to-three hours ago; sunrise is hours off.
    expect(utcMs - events!.setUtcMs).toBeGreaterThan(3_600_000);
    expect(utcMs - events!.setUtcMs).toBeLessThan(3 * 3_600_000);
    expect(events!.riseUtcMs - utcMs).toBeGreaterThan(4 * 3_600_000);
    expect(events!.riseUtcMs - utcMs).toBeLessThan(12 * 3_600_000);
  });
});

describe("sky-shell ecliptic band placement (EQJ ring through eqjToLocalThree, degrees)", () => {
  function bandMaxAltitudeDeg(utcMs: number, latitudeDeg: number, longitudeDeg: number): number {
    const sky = computeSkyState(utcMs, latitudeDeg, longitudeDeg);
    const m = sky.eqjToLocalThree;
    const ring = computeEclipticRingEqjM(1, 720);
    let maxSinAltitude = -1;
    for (let i = 0; i < ring.length; i += 3) {
      const length = Math.hypot(ring[i]!, ring[i + 1]!, ring[i + 2]!);
      const x = ring[i]! / length;
      const y = ring[i + 1]! / length;
      const z = ring[i + 2]! / length;
      // Local-Three y is up.
      const up = m[3]! * x + m[4]! * y + m[5]! * z;
      if (up > maxSinAltitude) maxSinAltitude = up;
    }
    return (Math.asin(Math.min(1, maxSinAltitude)) * 180) / Math.PI;
  }

  it("rides low over Indianapolis on a July evening and high on a January one", () => {
    // 10pm EDT, 2026-07-13: the visible (anti-solar) half of the ecliptic sits
    // near -23° declination in July, so the band tops out around 30° — low is
    // correct on summer evenings; winter evenings are the high ones.
    const july = bandMaxAltitudeDeg(Date.parse("2026-07-14T02:00:00Z"), 39.7684, -86.1581);
    expect(july).toBeGreaterThan(28);
    expect(july).toBeLessThan(37);
    const january = bandMaxAltitudeDeg(Date.parse("2026-01-14T02:00:00Z"), 39.7684, -86.1581);
    expect(january).toBeGreaterThan(65);
    expect(january).toBeLessThan(78);
  });

  it("keeps the Sun on the band at every fixed epoch", () => {
    for (const testCase of FIXED_CASES) {
      const sky = computeSkyState(testCase.utcMs, testCase.latitudeDeg, testCase.longitudeDeg);
      const m = sky.eqjToLocalThree;
      const [nx, ny, nz] = eclipticNorthEqj();
      const northLocal: Vec3d = [
        m[0]! * nx + m[1]! * ny + m[2]! * nz,
        m[3]! * nx + m[4]! * ny + m[5]! * nz,
        m[6]! * nx + m[7]! * ny + m[8]! * nz,
      ];
      const [sx, sy, sz] = sky.sun.directionLocalThree;
      const eclipticLatitudeDeg =
        (Math.asin(Math.abs(sx * northLocal[0] + sy * northLocal[1] + sz * northLocal[2])) * 180) /
        Math.PI;
      // Topocentric parallax and refraction keep it within a fraction of the
      // band's ±1.5° half-width.
      expect(eclipticLatitudeDeg).toBeLessThan(0.5);
    }
  });
});

describe("marsSolarLongitudeDeg (areocentric Ls, degrees)", () => {
  it("pins Ls ≈ 0 at the Mars Year 36 northern spring equinox (2021-02-07)", () => {
    const ls = marsSolarLongitudeDeg(Date.parse("2021-02-07T00:00:00Z"));
    const distanceFromZero = Math.min(ls, 360 - ls);
    expect(distanceFromZero).toBeLessThan(2);
  });

  it("labels the four quadrants", () => {
    // Ls advances ~0.5°/day; pick epochs a season apart from the MY36 equinox.
    expect(marsSeasonLabel(Date.parse("2021-03-15T00:00:00Z"))).toContain("Northern spring");
    expect(marsSeasonLabel(Date.parse("2021-09-01T00:00:00Z"))).toContain("Northern summer");
    expect(marsSeasonLabel(Date.parse("2022-03-01T00:00:00Z"))).toContain("Northern autumn");
    expect(marsSeasonLabel(Date.parse("2022-08-15T00:00:00Z"))).toContain("Northern winter");
  });
});
