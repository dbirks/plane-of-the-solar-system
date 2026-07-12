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

  it("defaults to the live current time when no ?time= is given", () => {
    const before = Date.now();
    const flags = readFeatureFlags("?debug=1");
    const after = Date.now();
    expect(flags.hasExplicitTime).toBe(false);
    expect(flags.initialUtcMs).toBeGreaterThanOrEqual(before);
    expect(flags.initialUtcMs).toBeLessThanOrEqual(after);
  });
});
