import { describe, expect, it } from "vitest";

import { stepCriticalSpring } from "../camera/camera-spring";
import {
  earthMoonCompositionForAltitude,
  journeyCompositionForSlider,
  nadirBlendForAltitude,
  OBSERVER_SWING_RAD,
  REVEAL_NORTH_LIFT,
  revealBlendForAltitude,
  systemCompositionForAltitude,
  vantageSwingBlendForAltitude,
  wholeEarthFovDegForAspect,
} from "../camera/camera-compositions";
import { formatBodyRange, formatDistance } from "../camera/distance-format";
import {
  applySoftLandmarkAttraction,
  distanceToSlider,
  JOURNEY_LANDMARKS,
  nearPlaneRenderUnitsForAltitude,
  renderUnitsPerMeterForAltitude,
  sliderToDistance,
} from "../camera/scale-domains";

describe("logarithmic journey scale", () => {
  it("maps both endpoints exactly", () => {
    expect(sliderToDistance(0)).toBeCloseTo(2, 12);
    expect(sliderToDistance(1)).toBeCloseTo(12_000_000_000_000, 1);
  });

  it("round-trips values", () => {
    for (const distanceM of [2, 100_000, 500_000, 20_000_000, 500_000_000, 12_000_000_000_000]) {
      // Relative tolerance: absolute float error grows with the magnitude.
      expect(sliderToDistance(distanceToSlider(distanceM)) / distanceM).toBeCloseTo(1, 9);
    }
  });

  it("uses perceptual logarithmic anchors for a responsive ascent", () => {
    // Ground goes straight to whole Earth (no atmosphere / low-orbit stops);
    // the journey beyond, where the system assembles, owns most of the rail.
    expect(distanceToSlider(20_000_000)).toBeCloseTo(0.22, 12);
    expect(distanceToSlider(500_000_000)).toBeCloseTo(0.42, 12);
    expect(distanceToSlider(400_000_000_000)).toBeCloseTo(0.72, 12);
    expect(JOURNEY_LANDMARKS).toHaveLength(5);
    expect(JOURNEY_LANDMARKS.at(-1)).toMatchObject({
      id: "full-system",
      distanceM: 12_000_000_000_000,
    });
  });

  it("gently attracts near a landmark without trapping distant values", () => {
    const wholeEarthT = distanceToSlider(
      JOURNEY_LANDMARKS.find((item) => item.id === "whole-earth")!.distanceM,
    );
    const near = wholeEarthT + 0.01;
    expect(Math.abs(applySoftLandmarkAttraction(near) - wholeEarthT)).toBeLessThan(
      Math.abs(near - wholeEarthT),
    );
    // Well between whole-Earth (0.22) and Earth–Moon (0.42), outside both
    // attraction radii.
    expect(applySoftLandmarkAttraction(wholeEarthT + 0.08)).toBeCloseTo(wholeEarthT + 0.08, 12);
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

  it("settles the FOV early in the pull-out", () => {
    expect(journeyCompositionForSlider(0)).toBe(0);
    expect(journeyCompositionForSlider(0.04)).toBeCloseTo(0.35, 12);
    expect(journeyCompositionForSlider(0.15)).toBe(1);
    expect(journeyCompositionForSlider(0.22)).toBe(1);
    expect(journeyCompositionForSlider(1)).toBe(1);
  });

  it("holds the map view to ~1300 km, then banks gently into the ball by whole Earth", () => {
    expect(revealBlendForAltitude(2)).toBe(0);
    // The whole map leg stays dead-centered on the observer's dot…
    expect(revealBlendForAltitude(1_000)).toBe(0);
    expect(revealBlendForAltitude(100_000)).toBe(0);
    expect(revealBlendForAltitude(1_200_000)).toBe(0);
    // …then the slow realign eases in imperceptibly (smootherstep tail)…
    expect(revealBlendForAltitude(1_600_000)).toBeLessThan(0.03);
    expect(revealBlendForAltitude(5_000_000)).toBeGreaterThan(0.2);
    expect(revealBlendForAltitude(5_000_000)).toBeLessThan(0.9);
    // …and settles by whole Earth: from there out the journey only zooms.
    expect(revealBlendForAltitude(20_000_000)).toBe(1);
    expect(revealBlendForAltitude(8_000_000_000_000)).toBe(1);
    // Monotonic through the whole band.
    let previous = 0;
    for (let exponent = 6.1; exponent <= 7.3; exponent += 0.05) {
      const value = revealBlendForAltitude(10 ** exponent);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("holds a pure-zoom ball beat, then swings gently onto the plane", () => {
    // Three-beat reveal: while revealBlend is already easing the frame's
    // gates, the vantage itself stays glued to the zenith (the ground curls
    // into a ball dead-center, dot facing the camera) until ~8,000 km; the
    // 35° swing then unrolls over a long band, settling ~32,000 km
    // (~20,000 mi — stretched from whole Earth for a less abrupt slide).
    expect(vantageSwingBlendForAltitude(1_500_000)).toBe(0);
    expect(revealBlendForAltitude(1_500_000)).toBeGreaterThan(0);
    expect(vantageSwingBlendForAltitude(7_000_000)).toBe(0);
    expect(vantageSwingBlendForAltitude(20_000_000)).toBeGreaterThan(0.5);
    expect(vantageSwingBlendForAltitude(20_000_000)).toBeLessThan(0.95);
    expect(vantageSwingBlendForAltitude(32_000_000)).toBe(1);
    let previous = 0;
    for (let exponent = 6.9; exponent <= 7.5; exponent += 0.02) {
      const value = vantageSwingBlendForAltitude(10 ** exponent);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("swings the vantage moderately around the observer, near the plane", () => {
    // ~45° around from the observer's zenith keeps the dot front-ish on the
    // tilted globe, facing the camera; ~8.5° of ecliptic latitude keeps the
    // plane a near-flat line rather than a disc seen from above.
    expect(OBSERVER_SWING_RAD).toBeGreaterThan(0.6);
    expect(OBSERVER_SWING_RAD).toBeLessThan(1.0);
    const elevationDeg =
      (Math.asin(REVEAL_NORTH_LIFT / Math.hypot(1, REVEAL_NORTH_LIFT)) * 180) / Math.PI;
    expect(elevationDeg).toBeGreaterThan(4);
    expect(elevationDeg).toBeLessThan(15);
  });

  it("widens the FOV toward the system framing, driven by altitude alone", () => {
    // Purely altitude-driven: a moon-separation feedback used to creep the
    // whole frame (band included) as the camera crossed the Moon's distance.
    const nearWholeEarth = earthMoonCompositionForAltitude(20_000_000);
    const atEarthMoon = earthMoonCompositionForAltitude(500_000_000);
    expect(nearWholeEarth.blend).toBeLessThan(0.3);
    expect(atEarthMoon.blend).toBeGreaterThan(0.99);
    expect(atEarthMoon.fovDeg).toBe(78);
    // Monotonic widening through the leg.
    let previous = 0;
    for (let exponent = 7.4; exponent <= 8.7; exponent += 0.05) {
      const value = earthMoonCompositionForAltitude(10 ** exponent).blend;
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("opens toward the system FOV with no gaze target change", () => {
    expect(systemCompositionForAltitude(500_000_000, 46).blend).toBe(0);
    const atFullSystem = systemCompositionForAltitude(8_000_000_000_000, 46);
    expect(atFullSystem.blend).toBe(1);
    expect(atFullSystem.fovDeg).toBe(78);
  });
});

describe("near plane vs. depth precision", () => {
  it("rides the altitude so standard depth keeps sub-percent steps at scale", () => {
    // A 24-bit standard depth buffer quantizes roughly by z²/(near · 2^24):
    // at every journey altitude the step at the Earth-surface distance must
    // stay far below the atmosphere shell gap (2.5% of the render radius),
    // or the shells and the globe z-fight into flashing splotches.
    for (const altitudeM of [50, 71_000, 7_700_000, 500_000_000, 4e11]) {
      const near = nearPlaneRenderUnitsForAltitude(altitudeM);
      const surfaceZ = altitudeM * renderUnitsPerMeterForAltitude(altitudeM);
      const depthStep = (surfaceZ * surfaceZ) / (near * 2 ** 24);
      expect(depthStep).toBeLessThan(surfaceZ * 0.002);
      // And the near plane itself never clips the content below the camera.
      expect(near).toBeLessThanOrEqual(surfaceZ);
    }
  });

  it("never reaches the camera-anchored sky shell", () => {
    expect(nearPlaneRenderUnitsForAltitude(12_000_000_000_000)).toBeLessThan(1_300);
    expect(nearPlaneRenderUnitsForAltitude(2)).toBeGreaterThanOrEqual(0.00001);
  });
});

describe("distance readout", () => {
  it("uses scale-aware units", () => {
    expect(formatDistance(2, "km")).toBe("Altitude · 2 m");
    expect(formatDistance(12_400, "km")).toBe("Altitude · 12.4 km");
    expect(formatDistance(20_000_000, "km")).toBe("Distance from Earth · 20,000 km");
    expect(formatDistance(500_000_000, "km")).toBe("Distance from Earth · 500,000 km");
    expect(formatDistance(8_000_000_000_000, "km")).toBe("Distance from Earth · 53 AU");
    expect(formatDistance(3 * 1.495978707e11, "km")).toBe("Distance from Earth · 3.0 AU");
  });

  it("formats miles for miles-country locales", () => {
    expect(formatDistance(2, "mi")).toBe("Altitude · 7 ft");
    expect(formatDistance(12_400, "mi")).toBe("Altitude · 7.7 mi");
    expect(formatDistance(20_000_000, "mi")).toBe("Distance from Earth · 12,427 mi");
    expect(formatDistance(500_000_000, "mi")).toBe("Distance from Earth · 310,686 mi");
    // Astronomical distances stay in AU regardless of region.
    expect(formatDistance(8_000_000_000_000, "mi")).toBe("Distance from Earth · 53 AU");
    expect(formatBodyRange(382_500_000, "mi")).toBe("237,674 mi");
    expect(formatBodyRange(382_500_000, "km")).toBe("382,500 km");
  });
});

describe("nadir map beat", () => {
  it("is fully aerial by ~30 m (100 ft), before the imagery fades in", () => {
    expect(nadirBlendForAltitude(2)).toBe(0);
    expect(nadirBlendForAltitude(9)).toBe(0);
    expect(nadirBlendForAltitude(18)).toBeGreaterThan(0.3);
    expect(nadirBlendForAltitude(31)).toBe(1);
    expect(nadirBlendForAltitude(1_000_000)).toBe(1);
  });
});
