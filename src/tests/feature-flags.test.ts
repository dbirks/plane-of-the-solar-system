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
    expect(new Date(flags.fixedTimeUtcMs).toISOString()).toBe("2024-01-02T03:04:05.000Z");
  });
});
