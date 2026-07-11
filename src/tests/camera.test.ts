import { describe, expect, it } from "vitest";

import { stepCriticalSpring } from "../camera/camera-spring";
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
    const intervals = [1 / 60, 1 / 30, 1 / 120, 0.05];
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

describe("distance readout", () => {
  it("uses scale-aware units", () => {
    expect(formatDistance(2)).toBe("Altitude · 2 m");
    expect(formatDistance(12_400)).toBe("Altitude · 12.4 km");
    expect(formatDistance(20_000_000)).toBe("Distance from Earth · 20,000 km");
  });
});
