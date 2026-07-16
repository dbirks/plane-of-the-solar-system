import { describe, expect, it } from "vitest";

import {
  attitudeQuaternionFromEvent,
  headingFromOrientationEvent,
  lookFromOrientationEvent,
} from "../location/compass-mode";

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
    expect(
      lookFromOrientationEvent({ alpha: 0, beta: 0, gamma: 0, absolute: true })?.pitchDeg,
    ).toBeCloseTo(-90, 6);
    // Held upright in portrait: looking at the horizon.
    expect(
      lookFromOrientationEvent({ alpha: 0, beta: 90, gamma: 0, absolute: true })?.pitchDeg,
    ).toBeCloseTo(0, 6);
    // Tipped 45° past upright: looking 45° up into the sky.
    expect(
      lookFromOrientationEvent({ alpha: 0, beta: 135, gamma: 0, absolute: true })?.pitchDeg,
    ).toBeCloseTo(45, 6);
    // On its side (landscape), still level with the horizon.
    expect(
      lookFromOrientationEvent({ alpha: 0, beta: 0, gamma: 90, absolute: true })?.pitchDeg,
    ).toBeCloseTo(0, 6);
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

describe("attitudeQuaternionFromEvent (camera quaternion, local frame: x east, y up, z south)", () => {
  const gazeOf = (quaternion: readonly [number, number, number, number]) => {
    const [qx, qy, qz, qw] = quaternion;
    // v' for v = (0, 0, -1) via the standard quaternion rotation.
    const tx = 2 * (qy * -1 - 0);
    const ty = 2 * (0 - qx * -1);
    const tz = 0;
    return [
      0 + qw * tx + qy * tz - qz * ty,
      0 + qw * ty + qz * tx - qx * tz,
      -1 + qw * tz + qx * ty - qy * tx,
    ] as const;
  };
  const pitchDegOf = (gaze: readonly [number, number, number]) =>
    (Math.asin(Math.min(1, Math.max(-1, gaze[1]))) * 180) / Math.PI;
  const azimuthDegOf = (gaze: readonly [number, number, number]) =>
    ((Math.atan2(gaze[0], -gaze[2]) * 180) / Math.PI + 360) % 360;

  it("matches the heading/pitch decomposition away from the zenith", () => {
    // Upright portrait facing north: gaze at the horizon, azimuth 0.
    const north = attitudeQuaternionFromEvent({ alpha: 0, beta: 90, gamma: 0 }, 0)!;
    expect(pitchDegOf(gazeOf(north))).toBeCloseTo(0, 6);
    expect(azimuthDegOf(gazeOf(north))).toBeCloseTo(0, 6);
    // Flat on a table, screen up: the back camera looks straight down.
    const flat = attitudeQuaternionFromEvent({ alpha: 0, beta: 0, gamma: 0 }, 0)!;
    expect(pitchDegOf(gazeOf(flat))).toBeCloseTo(-90, 6);
    // Tipped 45° past upright: 45° into the sky.
    const up45 = attitudeQuaternionFromEvent({ alpha: 0, beta: 135, gamma: 0 }, 0)!;
    expect(pitchDegOf(gazeOf(up45))).toBeCloseTo(45, 6);
    // alpha rotates the gaze counterclockwise: alpha 90 → azimuth 270.
    const west = attitudeQuaternionFromEvent({ alpha: 90, beta: 90, gamma: 0 }, 0)!;
    expect(azimuthDegOf(gazeOf(west))).toBeCloseTo(270, 6);
  });

  it("passes through the zenith continuously — no flip", () => {
    // Sweep beta from 160° to 200° (through pointing straight up at 180°):
    // consecutive gaze directions must stay within a few degrees of each
    // other. A heading+pitch camera flips ~180° of yaw across this sweep.
    let previous: readonly [number, number, number] | null = null;
    for (let beta = 160; beta <= 200; beta += 2) {
      const q = attitudeQuaternionFromEvent({ alpha: 30, beta, gamma: 0 }, 0)!;
      const gaze = gazeOf(q);
      if (previous) {
        const dot = gaze[0] * previous[0] + gaze[1] * previous[1] + gaze[2] * previous[2];
        const stepDeg = (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
        expect(stepDeg).toBeLessThan(4);
      }
      previous = gaze;
    }
  });

  it("compensates landscape screen orientation", () => {
    // Device on its left side (gamma -90 territory is messy; instead verify
    // that rotating the SCREEN by 90° while holding the device still leaves
    // the gaze unchanged and only rolls the frame).
    const portrait = attitudeQuaternionFromEvent({ alpha: 0, beta: 90, gamma: 0 }, 0)!;
    const rotatedScreen = attitudeQuaternionFromEvent({ alpha: 0, beta: 90, gamma: 0 }, 90)!;
    const gazeA = gazeOf(portrait);
    const gazeB = gazeOf(rotatedScreen);
    expect(gazeB[0]).toBeCloseTo(gazeA[0], 6);
    expect(gazeB[1]).toBeCloseTo(gazeA[1], 6);
    expect(gazeB[2]).toBeCloseTo(gazeA[2], 6);
  });
});
