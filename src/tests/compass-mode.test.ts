import { describe, expect, it } from "vitest";

import { headingFromOrientationEvent } from "../location/compass-mode";

describe("headingFromOrientationEvent (output: degrees clockwise from north)", () => {
  it("prefers the iOS compass heading verbatim", () => {
    expect(headingFromOrientationEvent({ alpha: 10, webkitCompassHeading: 275.5 })).toBeCloseTo(
      275.5,
      10,
    );
    expect(headingFromOrientationEvent({ alpha: null, webkitCompassHeading: 360 })).toBe(0);
  });

  it("converts absolute alpha (counterclockwise) to a compass heading", () => {
    expect(headingFromOrientationEvent({ alpha: 0, absolute: true })).toBe(0);
    expect(headingFromOrientationEvent({ alpha: 90, absolute: true })).toBe(270);
    expect(headingFromOrientationEvent({ alpha: 270, absolute: true })).toBe(90);
  });

  it("returns null for relative or empty orientations", () => {
    expect(headingFromOrientationEvent({ alpha: 45, absolute: false })).toBeNull();
    expect(headingFromOrientationEvent({ alpha: null })).toBeNull();
  });
});
