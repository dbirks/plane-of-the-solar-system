import { describe, expect, it } from "vitest";

import { stepCriticalSpring } from "../camera/camera-spring";
import {
  journeyCompositionForSlider,
  wholeEarthFovDegForAspect,
} from "../camera/camera-compositions";
import { formatDistance } from "../camera/distance-format";
import {
  applySoftLandmarkAttraction,
  distanceToSlider,
  PHASE_ONE_LANDMARKS,
  sliderToDistance,
} from "../camera/scale-domains";

describe("logarithmic journey scale", () => {
  it("maps both endpoints exactly", () => {
    expect(sliderToDistance(0)).toBeCloseTo(2, 12);
    expect(sliderToDistance(1)).toBeCloseTo(20_000_000, 5);
  });

  it("round-trips values", () => {
    for (const distanceM of [2, 100_000, 500_000, 20_000_000]) {
      expect(sliderToDistance(distanceToSlider(distanceM))).toBeCloseTo(distanceM, 6);
    }
  });

  it("uses perceptual logarithmic anchors for a responsive ascent", () => {
    expect(distanceToSlider(1_000)).toBeCloseTo(0.16, 12);
    expect(distanceToSlider(100_000)).toBeCloseTo(0.38, 12);
    expect(distanceToSlider(500_000)).toBeCloseTo(0.58, 12);
    expect(sliderToDistance(0.27)).toBeCloseTo(10_000, 6);
  });

  it("gently attracts near a landmark without trapping distant values", () => {
    const atmosphereT = distanceToSlider(
      PHASE_ONE_LANDMARKS.find((item) => item.id === "atmosphere")!.distanceM,
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
    expect(journeyCompositionForSlider(0.38)).toBeCloseTo(0.17, 12);
    expect(journeyCompositionForSlider(0.58)).toBeCloseTo(0.34, 12);
    expect(journeyCompositionForSlider(1)).toBe(1);
  });
});

describe("distance readout", () => {
  it("uses scale-aware units", () => {
    expect(formatDistance(2)).toBe("Altitude · 2 m");
    expect(formatDistance(12_400)).toBe("Altitude · 12.4 km");
    expect(formatDistance(20_000_000)).toBe("Distance from Earth · 20,000 km");
  });
});
