import { describe, expect, it } from "vitest";

import { tileBounds, tileXY } from "../scene/earth/satellite-patch";

describe("web-mercator tile math (slippy z/x/y)", () => {
  it("maps the origin and Indianapolis to known tiles", () => {
    expect(tileXY(0, 0, 1)).toEqual({ x: 1, y: 1 });
    // Indianapolis at zoom 10: well-known tile neighborhood (x ~266, y ~388).
    const indy = tileXY(39.7684, -86.1581, 10);
    expect(Math.floor(indy.x)).toBe(266);
    expect(Math.floor(indy.y)).toBe(388);
  });

  it("round-trips tile bounds through tileXY", () => {
    const bounds = tileBounds(266, 388, 10);
    expect(bounds.westDeg).toBeLessThan(-86.1581);
    expect(bounds.eastDeg).toBeGreaterThan(-86.1581);
    expect(bounds.northDeg).toBeGreaterThan(39.7684);
    expect(bounds.southDeg).toBeLessThan(39.7684);
    // Corners map back onto integer tile coordinates.
    const corner = tileXY(bounds.northDeg, bounds.westDeg, 10);
    expect(corner.x).toBeCloseTo(266, 6);
    expect(corner.y).toBeCloseTo(388, 6);
  });
});
