import { describe, expect, it } from "vitest";

import { computeMoonOrbitEqjM, MOON_ORBIT_SAMPLE_COUNT } from "../astronomy/moon-orbit";
import {
  computeMoonPlacement,
  MOON_MEAN_RADIUS_M,
  MOON_PROXY_SHELL_RENDER_DISTANCE,
  rayToAltAzDeg,
} from "../astronomy/moon-placement";
import { renderUnitsPerMeterForAltitude } from "../camera/scale-domains";
import type { Vec3d } from "../coordinates/vec3d";

// Moon 30° up in the southern sky, at a typical topocentric distance.
const MOON_DISTANCE_M = 384_400_000;
const MOON_FROM_GROUND: Vec3d = [
  0,
  Math.sin((30 * Math.PI) / 180) * MOON_DISTANCE_M,
  Math.cos((30 * Math.PI) / 180) * MOON_DISTANCE_M,
];

/** The historical straight-up camera path. */
function zenithCameraM(altitudeM: number): Vec3d {
  return [0, altitudeM, 0];
}

describe("computeMoonPlacement (units: meters and render units, frame: LOCAL_THREE)", () => {
  it("keeps the Moon on the proxy shell at ground altitude", () => {
    const placement = computeMoonPlacement(
      MOON_FROM_GROUND,
      zenithCameraM(2),
      renderUnitsPerMeterForAltitude(2),
    );
    expect(placement.physical).toBe(false);
    expect(placement.renderDistance).toBe(MOON_PROXY_SHELL_RENDER_DISTANCE);
    // Angular size stays true even on the shell.
    const angular = Math.atan(placement.renderRadius / placement.renderDistance);
    expect(angular).toBeCloseTo(Math.asin(MOON_MEAN_RADIUS_M / placement.cameraDistanceM), 6);
  });

  it("goes physical at high altitude with an uncompressed distance", () => {
    const altitudeM = 100_000_000;
    const scale = renderUnitsPerMeterForAltitude(altitudeM);
    const placement = computeMoonPlacement(MOON_FROM_GROUND, zenithCameraM(altitudeM), scale);
    expect(placement.physical).toBe(true);
    // Round-trip: render distance divided by scale is the true camera distance.
    expect(placement.renderDistance / scale).toBeCloseTo(placement.cameraDistanceM, 4);
    // True camera distance follows the triangle between zenith travel and Moon.
    const expected = Math.hypot(
      MOON_FROM_GROUND[0],
      MOON_FROM_GROUND[1] - altitudeM,
      MOON_FROM_GROUND[2],
    );
    expect(placement.cameraDistanceM).toBeCloseTo(expected, 4);
  });

  it("handles a camera off the zenith ray (the reveal arc)", () => {
    const altitudeM = 100_000_000;
    const scale = renderUnitsPerMeterForAltitude(altitudeM);
    const arcCameraM: Vec3d = [altitudeM * 0.6, altitudeM * 0.64, altitudeM * 0.48];
    const placement = computeMoonPlacement(MOON_FROM_GROUND, arcCameraM, scale);
    const expected = Math.hypot(
      MOON_FROM_GROUND[0] - arcCameraM[0],
      MOON_FROM_GROUND[1] - arcCameraM[1],
      MOON_FROM_GROUND[2] - arcCameraM[2],
    );
    expect(placement.cameraDistanceM).toBeCloseTo(expected, 4);
    // The mesh position (camera + ray·distance) lands on the true Moon point.
    const scaled = placement.renderDistance / scale;
    expect(arcCameraM[0] + placement.rayLocal[0] * scaled).toBeCloseTo(MOON_FROM_GROUND[0], 2);
    expect(arcCameraM[1] + placement.rayLocal[1] * scaled).toBeCloseTo(MOON_FROM_GROUND[1], 2);
    expect(arcCameraM[2] + placement.rayLocal[2] * scaled).toBeCloseTo(MOON_FROM_GROUND[2], 2);
  });

  it("hands off proxy to physical continuously (same ray, same angular size)", () => {
    // Find the altitude where the physical render distance crosses the shell.
    let low = 2;
    let high = 400_000_000;
    for (let i = 0; i < 60; i += 1) {
      const mid = (low + high) / 2;
      const placement = computeMoonPlacement(
        MOON_FROM_GROUND,
        zenithCameraM(mid),
        renderUnitsPerMeterForAltitude(mid),
      );
      if (placement.physical) high = mid;
      else low = mid;
    }
    const before = computeMoonPlacement(
      MOON_FROM_GROUND,
      zenithCameraM(low * 0.999),
      renderUnitsPerMeterForAltitude(low * 0.999),
    );
    const after = computeMoonPlacement(
      MOON_FROM_GROUND,
      zenithCameraM(high * 1.001),
      renderUnitsPerMeterForAltitude(high * 1.001),
    );
    expect(before.physical).toBe(false);
    expect(after.physical).toBe(true);
    // Ray and angular size cross the boundary without a jump.
    const dot =
      before.rayLocal[0] * after.rayLocal[0] +
      before.rayLocal[1] * after.rayLocal[1] +
      before.rayLocal[2] * after.rayLocal[2];
    expect(dot).toBeGreaterThan(0.999999);
    const angularBefore = Math.atan(before.renderRadius / before.renderDistance);
    const angularAfter = Math.atan(after.renderRadius / after.renderDistance);
    expect(Math.abs(angularBefore - angularAfter)).toBeLessThan(1e-5);
  });

  it("gains parallax as the camera rises past the Moon's altitude", () => {
    const ground = computeMoonPlacement(MOON_FROM_GROUND, zenithCameraM(2), 1e-4);
    const high = computeMoonPlacement(MOON_FROM_GROUND, zenithCameraM(300_000_000), 1e-7);
    // Rising along the zenith pushes the apparent Moon down toward the horizon.
    expect(high.rayLocal[1]).toBeLessThan(ground.rayLocal[1]);
  });

  it("converts rays to alt-az consistently", () => {
    const north = rayToAltAzDeg([0, 0, -1]);
    expect(north.altitudeDeg).toBeCloseTo(0, 10);
    expect(north.azimuthDeg).toBeCloseTo(0, 10);
    const eastUp = rayToAltAzDeg([Math.cos(Math.PI / 4), Math.sin(Math.PI / 4), 0]);
    expect(eastUp.altitudeDeg).toBeCloseTo(45, 10);
    expect(eastUp.azimuthDeg).toBeCloseTo(90, 10);
  });
});

describe("computeMoonOrbitEqjM (frame: EQJ, units: meters)", () => {
  it("keeps every sample inside the physical Earth-Moon distance band", () => {
    const points = computeMoonOrbitEqjM(Date.parse("2026-07-24T02:30:00Z"));
    expect(points.length).toBe(MOON_ORBIT_SAMPLE_COUNT * 3);
    for (let i = 0; i < MOON_ORBIT_SAMPLE_COUNT; i += 1) {
      const radius = Math.hypot(points[i * 3]!, points[i * 3 + 1]!, points[i * 3 + 2]!);
      expect(radius).toBeGreaterThan(350_000_000);
      expect(radius).toBeLessThan(410_000_000);
    }
  });
});
