import { describe, expect, it } from "vitest";

import { moonPhaseName } from "../astronomy/moon-phase-name";

describe("moonPhaseName (input: ecliptic phase angle, degrees)", () => {
  it("names the principal phases", () => {
    expect(moonPhaseName(0)).toBe("New Moon");
    expect(moonPhaseName(90)).toBe("First quarter");
    expect(moonPhaseName(180)).toBe("Full Moon");
    expect(moonPhaseName(270)).toBe("Third quarter");
  });

  it("names the intermediate phases", () => {
    expect(moonPhaseName(45)).toBe("Waxing crescent");
    expect(moonPhaseName(135)).toBe("Waxing gibbous");
    expect(moonPhaseName(225)).toBe("Waning gibbous");
    expect(moonPhaseName(315)).toBe("Waning crescent");
  });

  it("handles band edges and wraparound", () => {
    expect(moonPhaseName(22.4)).toBe("New Moon");
    expect(moonPhaseName(22.5)).toBe("Waxing crescent");
    expect(moonPhaseName(337.5)).toBe("New Moon");
    expect(moonPhaseName(360)).toBe("New Moon");
    expect(moonPhaseName(-45)).toBe("Waning crescent");
    expect(moonPhaseName(719.4)).toBe("New Moon");
  });
});
