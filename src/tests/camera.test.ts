import { describe, expect, it } from "vitest";

import { stepCriticalSpring } from "../camera/camera-spring";
import {
  earthMoonCompositionForAltitude,
  eclipticRollBlendForAltitude,
  journeyCompositionForSlider,
  wholeEarthFovDegForAspect,
} from "../camera/camera-compositions";
import { formatDistance } from "../camera/distance-format";
import {
  applySoftLandmarkAttraction,
  distanceToSlider,
  JOURNEY_LANDMARKS,
  sliderToDistance,
} from "../camera/scale-domains";

describe("logarithmic journey scale", () => {
  it("maps both endpoints exactly", () => {
    expect(sliderToDistance(0)).toBeCloseTo(2, 12);
    expect(sliderToDistance(1)).toBeCloseTo(8_000_000_000_000, 1);
  });

  it("round-trips values", () => {
    for (const distanceM of [2, 100_000, 500_000, 20_000_000, 500_000_000, 8_000_000_000_000]) {
      // Relative tolerance: absolute float error grows with the magnitude.
      expect(sliderToDistance(distanceToSlider(distanceM)) / distanceM).toBeCloseTo(1, 9);
    }
  });

  it("uses perceptual logarithmic anchors for a responsive ascent", () => {
    expect(distanceToSlider(1_000)).toBeCloseTo(0.1, 12);
    expect(distanceToSlider(100_000)).toBeCloseTo(0.24, 12);
    expect(distanceToSlider(500_000)).toBeCloseTo(0.36, 12);
    expect(distanceToSlider(20_000_000)).toBeCloseTo(0.6, 12);
    expect(distanceToSlider(500_000_000)).toBeCloseTo(0.76, 12);
    expect(JOURNEY_LANDMARKS.at(-1)).toMatchObject({
      id: "full-system",
      distanceM: 8_000_000_000_000,
    });
  });

  it("gently attracts near a landmark without trapping distant values", () => {
    const atmosphereT = distanceToSlider(
      JOURNEY_LANDMARKS.find((item) => item.id === "atmosphere")!.distanceM,
    );
    const near = atmosphereT + 0.01;
    expect(Math.abs(applySoftLandmarkAttraction(near) - atmosphereT)).toBeLessThan(
      Math.abs(near - atmosphereT),
    );
    expect(applySoftLandmarkAttraction(atmosphereT + 0.05)).toBeCloseTo(atmosphereT + 0.05, 12);
  });
});

describe("camera spring", () => {
  it("converges without overshoot at uneven frame intervals", () => {
    let state = { value: Math.log(2), velocity: 0 };
    const target = Math.log(20_000_000);
    const intervals = [1 / 60, 1 / 30, 1 / 120, 0.05, 0.2];
    let previous = state.value;
    for (let index = 0; index < 300; index += 1) {
      state = stepCriticalSpring(state, target, intervals[index % intervals.length]!);
      expect(state.value).toBeGreaterThanOrEqual(previous - 1e-12);
      expect(state.value).toBeLessThanOrEqual(target + 1e-12);
      previous = state.value;
    }
    expect(state.value).toBeCloseTo(target, 8);
  });
});

describe("whole-Earth composition", () => {
  it("widens the vertical FOV in portrait to preserve horizontal framing", () => {
    expect(wholeEarthFovDegForAspect(16 / 9)).toBe(46);
    expect(wholeEarthFovDegForAspect(390 / 844)).toBeGreaterThan(68);
    expect(wholeEarthFovDegForAspect(390 / 844)).toBeLessThanOrEqual(76);
  });

  it("keeps black space visible at the low-orbit landmark", () => {
    expect(journeyCompositionForSlider(0)).toBe(0);
    expect(journeyCompositionForSlider(0.24)).toBeCloseTo(0.17, 12);
    expect(journeyCompositionForSlider(0.36)).toBeCloseTo(0.34, 12);
    expect(journeyCompositionForSlider(0.6)).toBe(1);
    expect(journeyCompositionForSlider(1)).toBe(1);
  });

  it("re-levels screen-up onto the ecliptic between the atmosphere and Earth-Moon", () => {
    expect(eclipticRollBlendForAltitude(2)).toBe(0);
    expect(eclipticRollBlendForAltitude(100_000)).toBe(0);
    // Turning through low orbit and whole Earth…
    expect(eclipticRollBlendForAltitude(500_000)).toBeGreaterThan(0.05);
    expect(eclipticRollBlendForAltitude(500_000)).toBeLessThan(0.25);
    expect(eclipticRollBlendForAltitude(20_000_000)).toBeGreaterThan(0.5);
    expect(eclipticRollBlendForAltitude(20_000_000)).toBeLessThan(0.9);
    // …and already flat when the Earth–Moon system frames up.
    expect(eclipticRollBlendForAltitude(500_000_000)).toBe(1);
    expect(eclipticRollBlendForAltitude(8_000_000_000_000)).toBe(1);
    // Monotonic through the transition band.
    let previous = 0;
    for (let exponent = 5; exponent <= 8.7; exponent += 0.1) {
      const value = eclipticRollBlendForAltitude(10 ** exponent);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("frames Earth and Moon together beyond whole Earth", () => {
    const moonRay = [0.6, -0.35, -0.72] as const;
    const nearWholeEarth = earthMoonCompositionForAltitude(20_000_000, moonRay, 46);
    const atEarthMoon = earthMoonCompositionForAltitude(500_000_000, moonRay, 46);
    expect(nearWholeEarth.blend).toBeLessThan(0.3);
    expect(atEarthMoon.blend).toBe(1);
    // Gaze lifts off the nadir toward the Moon and the FOV covers both.
    expect(atEarthMoon.guidedPitchRad).toBeGreaterThan(-Math.PI / 2);
    expect(atEarthMoon.fovDeg).toBeGreaterThanOrEqual(46);
    expect(atEarthMoon.fovDeg).toBeLessThanOrEqual(92);
  });
});

describe("distance readout", () => {
  it("uses scale-aware units", () => {
    expect(formatDistance(2)).toBe("Altitude · 2 m");
    expect(formatDistance(12_400)).toBe("Altitude · 12.4 km");
    expect(formatDistance(20_000_000)).toBe("Distance from Earth · 20,000 km");
    expect(formatDistance(500_000_000)).toBe("Distance from Earth · 500,000 km");
  });
});
