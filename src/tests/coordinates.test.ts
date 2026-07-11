import { describe, expect, it } from "vitest";

import { geodeticSurfaceUnitEarthFixed } from "../coordinates/geodetic";
import { degreesToRadians, METERS_PER_AU, radiansToDegrees } from "../coordinates/units";
import { toCameraRelativeRender } from "../coordinates/render-origin";
import { earthFixedToThree, eclipticToThree, horizonToLocalThree } from "../coordinates/transforms";

describe("coordinate frames and units", () => {
  it("uses the exact IAU astronomical-unit conversion", () => {
    expect(METERS_PER_AU).toBe(149_597_870_700);
  });

  it("round-trips degrees and radians", () => {
    expect(radiansToDegrees(degreesToRadians(123.456))).toBeCloseTo(123.456, 12);
  });

  it("maps ECL_J2000 into right-handed Three Y-up axes", () => {
    expect(eclipticToThree([1, 2, 3])).toEqual([1, 3, -2]);
  });

  it("maps Astronomy Engine HOR axes into LOCAL_THREE", () => {
    expect(horizonToLocalThree([1, 2, 3])).toEqual([-2, 3, -1]);
  });

  it("maps WGS84-style geodetic directions into EARTH_FIXED and Three Y-up", () => {
    expect(geodeticSurfaceUnitEarthFixed(0, 0)).toEqual([1, 0, 0]);
    expect(geodeticSurfaceUnitEarthFixed(90, 0)[2]).toBeCloseTo(1, 12);
    expect(earthFixedToThree([1, 2, 3])).toEqual([1, 3, -2]);
  });

  it("subtracts the physical render origin before applying units", () => {
    expect(toCameraRelativeRender([101, 205, -5], [100, 200, -10], 2)).toEqual([2, 10, 10]);
  });
});
