import { describe, expect, it } from "vitest";

import { readFeatureFlags } from "../app/feature-flags";

describe("debug feature flags", () => {
  it("accepts reproducible renderer, time, and observer parameters", () => {
    const flags = readFeatureFlags(
      "?debug=1&renderer=webgl&depth=log&quality=low&time=2024-01-02T03:04:05Z&lat=-33.9&lon=151.2",
    );
    expect(flags).toMatchObject({
      debug: true,
      renderer: "webgl",
      depth: "log",
      quality: "low",
      latitudeDeg: -33.9,
      longitudeDeg: 151.2,
    });
    expect(flags.hasExplicitTime).toBe(true);
    expect(new Date(flags.initialUtcMs).toISOString()).toBe("2024-01-02T03:04:05.000Z");
  });

  it("falls back to the Indianapolis observer when lat/lon are absent or blank", () => {
    expect(readFeatureFlags("?debug=1")).toMatchObject({
      latitudeDeg: 39.7684,
      longitudeDeg: -86.1581,
    });
    expect(readFeatureFlags("?lat=&lon=")).toMatchObject({
      latitudeDeg: 39.7684,
      longitudeDeg: -86.1581,
    });
    expect(readFeatureFlags("?lat=abc&lon=xyz")).toMatchObject({
      latitudeDeg: 39.7684,
      longitudeDeg: -86.1581,
    });
  });

  it("resolves miles for miles-country locales, kilometres elsewhere", () => {
    expect(readFeatureFlags("?debug=1", ["en-US"]).distanceUnit).toBe("mi");
    expect(readFeatureFlags("?debug=1", ["en-GB"]).distanceUnit).toBe("mi");
    expect(readFeatureFlags("?debug=1", ["de-DE"]).distanceUnit).toBe("km");
    expect(readFeatureFlags("?debug=1", ["fr"]).distanceUnit).toBe("km");
    // Bare "en" maximizes to en-US.
    expect(readFeatureFlags("?debug=1", ["en"]).distanceUnit).toBe("mi");
    expect(readFeatureFlags("?debug=1", []).distanceUnit).toBe("km");
  });

  it("lets ?units= override the locale", () => {
    expect(readFeatureFlags("?units=km", ["en-US"]).distanceUnit).toBe("km");
    expect(readFeatureFlags("?units=mi", ["de-DE"]).distanceUnit).toBe("mi");
    expect(readFeatureFlags("?units=bogus", ["de-DE"]).distanceUnit).toBe("km");
  });

  it("defaults to the live current time when no ?time= is given", () => {
    const before = Date.now();
    const flags = readFeatureFlags("?debug=1");
    const after = Date.now();
    expect(flags.hasExplicitTime).toBe(false);
    expect(flags.initialUtcMs).toBeGreaterThanOrEqual(before);
    expect(flags.initialUtcMs).toBeLessThanOrEqual(after);
  });
});
