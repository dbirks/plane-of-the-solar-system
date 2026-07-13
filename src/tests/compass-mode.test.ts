import { describe, expect, it } from "vitest";

import { headingFromOrientationEvent, lookFromOrientationEvent } from "../location/compass-mode";

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

describe("lookFromOrientationEvent (through-the-screen gaze)", () => {
  it("reads the pitch from beta/gamma independent of heading", () => {
    // Flat on a table, screen up: the camera looks straight down.
    expect(lookFromOrientationEvent({ alpha: 0, beta: 0, gamma: 0, absolute: true })?.pitchDeg)
      .toBeCloseTo(-90, 6);
    // Held upright in portrait: looking at the horizon.
    expect(lookFromOrientationEvent({ alpha: 0, beta: 90, gamma: 0, absolute: true })?.pitchDeg)
      .toBeCloseTo(0, 6);
    // Tipped 45° past upright: looking 45° up into the sky.
    expect(lookFromOrientationEvent({ alpha: 0, beta: 135, gamma: 0, absolute: true })?.pitchDeg)
      .toBeCloseTo(45, 6);
    // On its side (landscape), still level with the horizon.
    expect(lookFromOrientationEvent({ alpha: 0, beta: 0, gamma: 90, absolute: true })?.pitchDeg)
      .toBeCloseTo(0, 6);
  });

  it("keeps the heading conventions of headingFromOrientationEvent", () => {
    const look = lookFromOrientationEvent({ alpha: 90, beta: 90, gamma: 0, absolute: true });
    expect(look?.headingDeg).toBe(270);
    // iOS: relative alpha but a webkit compass heading — pitch still works.
    const ios = lookFromOrientationEvent({
      alpha: 123,
      beta: 135,
      gamma: 0,
      absolute: false,
      webkitCompassHeading: 42,
    });
    expect(ios?.headingDeg).toBeCloseTo(42, 10);
    expect(ios?.pitchDeg).toBeCloseTo(45, 6);
    // No usable heading at all → null.
    expect(lookFromOrientationEvent({ alpha: 45, beta: 90, gamma: 0, absolute: false })).toBeNull();
  });
});
