import { describe, expect, it } from "vitest";

import { stepCriticalSpring } from "../camera/camera-spring";
import {
  cameraArcBlendForAltitude,
  earthMoonCompositionForAltitude,
  eclipticRollBlendForAltitude,
  journeyCompositionForSlider,
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
    expect(distanceToSlider(100_000)).toBeCloseTo(0.22, 12);
    expect(distanceToSlider(500_000)).toBeCloseTo(0.29, 12);
    // The quiet atmosphere → whole-Earth leg is compressed; the journey
    // beyond, where the system assembles, owns most of the slider.
    expect(distanceToSlider(20_000_000)).toBeCloseTo(0.42, 12);
    expect(distanceToSlider(500_000_000)).toBeCloseTo(0.6, 12);
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

  it("reaches the nadir gaze by the atmosphere landmark", () => {
    expect(journeyCompositionForSlider(0)).toBe(0);
    // Sweeping down through the ascent…
    expect(journeyCompositionForSlider(0.14)).toBeCloseTo(0.55, 12);
    // …and looking straight at the observer's dot from the atmosphere on.
    expect(journeyCompositionForSlider(0.22)).toBe(1);
    expect(journeyCompositionForSlider(0.29)).toBe(1);
    expect(journeyCompositionForSlider(0.42)).toBe(1);
    expect(journeyCompositionForSlider(1)).toBe(1);
  });

  it("arcs the camera off the zenith between the atmosphere and whole Earth", () => {
    expect(cameraArcBlendForAltitude(2)).toBe(0);
    expect(cameraArcBlendForAltitude(100_000)).toBe(0);
    expect(cameraArcBlendForAltitude(500_000)).toBeGreaterThan(0.05);
    expect(cameraArcBlendForAltitude(500_000)).toBeLessThan(0.5);
    expect(cameraArcBlendForAltitude(20_000_000)).toBe(1);
    expect(cameraArcBlendForAltitude(8_000_000_000_000)).toBe(1);
    // Monotonic through the transition band.
    let previous = 0;
    for (let exponent = 5.3; exponent <= 7.3; exponent += 0.1) {
      const value = cameraArcBlendForAltitude(10 ** exponent);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("re-levels screen-up onto the ecliptic between the atmosphere and whole Earth", () => {
    expect(eclipticRollBlendForAltitude(2)).toBe(0);
    expect(eclipticRollBlendForAltitude(100_000)).toBe(0);
    // Turning through low orbit…
    expect(eclipticRollBlendForAltitude(500_000)).toBeGreaterThan(0.1);
    expect(eclipticRollBlendForAltitude(500_000)).toBeLessThan(0.5);
    // …and whole Earth arrives tilted against an already-flat ecliptic.
    expect(eclipticRollBlendForAltitude(20_000_000)).toBe(1);
    expect(eclipticRollBlendForAltitude(500_000_000)).toBe(1);
    expect(eclipticRollBlendForAltitude(8_000_000_000_000)).toBe(1);
    // Monotonic through the transition band.
    let previous = 0;
    for (let exponent = 5; exponent <= 7.3; exponent += 0.1) {
      const value = eclipticRollBlendForAltitude(10 ** exponent);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
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
    expect(formatDistance(8_000_000_000_000, "km")).toBe("Distance from Earth · 53.48 AU");
  });

  it("formats miles for miles-country locales", () => {
    expect(formatDistance(2, "mi")).toBe("Altitude · 7 ft");
    expect(formatDistance(12_400, "mi")).toBe("Altitude · 7.7 mi");
    expect(formatDistance(20_000_000, "mi")).toBe("Distance from Earth · 12,427 mi");
    expect(formatDistance(500_000_000, "mi")).toBe("Distance from Earth · 310,686 mi");
    // Astronomical distances stay in AU regardless of region.
    expect(formatDistance(8_000_000_000_000, "mi")).toBe("Distance from Earth · 53.48 AU");
    expect(formatBodyRange(382_500_000, "mi")).toBe("237,674 mi");
    expect(formatBodyRange(382_500_000, "km")).toBe("382,500 km");
  });
});
