import { describe, expect, it } from "vitest";

import { stepCriticalSpring } from "../camera/camera-spring";
import {
  earthMoonCompositionForAltitude,
  journeyCompositionForSlider,
  OBSERVER_SWING_RAD,
  REVEAL_NORTH_LIFT,
  revealBlendForAltitude,
  systemCompositionForAltitude,
  wholeEarthFovDegForAspect,
} from "../camera/camera-compositions";
import { formatBodyRange, formatDistance } from "../camera/distance-format";
import {
  applySoftLandmarkAttraction,
  distanceToSlider,
  JOURNEY_LANDMARKS,
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
    // The whole quiet ground → whole-Earth leg fits the first ~third; the
    // journey beyond, where the system assembles, owns most of the slider.
    expect(distanceToSlider(100_000)).toBeCloseTo(0.12, 12);
    expect(distanceToSlider(500_000)).toBeCloseTo(0.18, 12);
    expect(distanceToSlider(20_000_000)).toBeCloseTo(0.3, 12);
    expect(distanceToSlider(500_000_000)).toBeCloseTo(0.48, 12);
    expect(JOURNEY_LANDMARKS.at(-1)).toMatchObject({
      id: "full-system",
      distanceM: 12_000_000_000_000,
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
    // Midway between the atmosphere (0.12) and low-orbit (0.18) anchors,
    // outside both attraction radii.
    expect(applySoftLandmarkAttraction(atmosphereT + 0.03)).toBeCloseTo(atmosphereT + 0.03, 12);
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

  it("settles the FOV by the atmosphere landmark", () => {
    expect(journeyCompositionForSlider(0)).toBe(0);
    expect(journeyCompositionForSlider(0.08)).toBeCloseTo(0.55, 12);
    expect(journeyCompositionForSlider(0.12)).toBe(1);
    expect(journeyCompositionForSlider(0.18)).toBe(1);
    expect(journeyCompositionForSlider(0.3)).toBe(1);
    expect(journeyCompositionForSlider(1)).toBe(1);
  });

  it("runs the reveal as one motion from ~10 km, settled before whole Earth", () => {
    expect(revealBlendForAltitude(2)).toBe(0);
    expect(revealBlendForAltitude(10_000)).toBe(0);
    // The plane starts flattening on the way to the atmosphere…
    expect(revealBlendForAltitude(100_000)).toBeGreaterThan(0.2);
    expect(revealBlendForAltitude(100_000)).toBeLessThan(0.6);
    // …keeps turning smoothly through low orbit (nothing new starts there)…
    expect(revealBlendForAltitude(500_000)).toBeGreaterThan(0.5);
    expect(revealBlendForAltitude(500_000)).toBeLessThan(0.95);
    // …and is fully settled well before whole Earth: from there out the
    // journey only zooms.
    expect(revealBlendForAltitude(4_000_000)).toBe(1);
    expect(revealBlendForAltitude(20_000_000)).toBe(1);
    expect(revealBlendForAltitude(8_000_000_000_000)).toBe(1);
    // Monotonic through the whole band.
    let previous = 0;
    for (let exponent = 4; exponent <= 6.6; exponent += 0.05) {
      const value = revealBlendForAltitude(10 ** exponent);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("swings the vantage well around the observer, near the plane", () => {
    // ~70° around from the observer's zenith keeps the dot on the visible
    // side of the tilted globe (not the limb); ~8.5° of ecliptic latitude
    // keeps the plane a near-flat line rather than a disc seen from above.
    expect(OBSERVER_SWING_RAD).toBeGreaterThan(1.0);
    expect(OBSERVER_SWING_RAD).toBeLessThan(1.5);
    const elevationDeg = (Math.asin(REVEAL_NORTH_LIFT / Math.hypot(1, REVEAL_NORTH_LIFT)) * 180) / Math.PI;
    expect(elevationDeg).toBeGreaterThan(4);
    expect(elevationDeg).toBeLessThan(15);
  });

  it("widens the FOV to hold Earth and Moon without moving the gaze", () => {
    const moonRay = [0.6, -0.35, -0.72] as const;
    const gazeDown = [0, -1, 0] as const;
    const nearWholeEarth = earthMoonCompositionForAltitude(20_000_000, moonRay, gazeDown, 46);
    const atEarthMoon = earthMoonCompositionForAltitude(500_000_000, moonRay, gazeDown, 46);
    expect(nearWholeEarth.blend).toBeLessThan(0.3);
    expect(atEarthMoon.blend).toBe(1);
    // Moon 69.5° off the gaze → FOV covers it, capped for sanity.
    expect(atEarthMoon.fovDeg).toBeGreaterThan(46);
    expect(atEarthMoon.fovDeg).toBeLessThanOrEqual(100);
    // A Moon nearly along the gaze keeps the base FOV.
    expect(
      earthMoonCompositionForAltitude(500_000_000, [0.1, -0.99, 0.1], gazeDown, 46).fovDeg,
    ).toBe(46);
  });

  it("opens toward the system FOV with no gaze target change", () => {
    expect(systemCompositionForAltitude(500_000_000, 46).blend).toBe(0);
    const atFullSystem = systemCompositionForAltitude(8_000_000_000_000, 46);
    expect(atFullSystem.blend).toBe(1);
    expect(atFullSystem.fovDeg).toBe(78);
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
