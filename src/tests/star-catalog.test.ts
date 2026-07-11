import { describe, expect, it } from "vitest";

import {
  STAR_COLOR_INDEX,
  STAR_COUNT,
  STAR_DEC_DEG,
  STAR_MAG,
  STAR_NAMES,
  STAR_RA_DEG,
} from "../scene/sky/star-catalog";

describe("generated bright-star catalog (frame: EQJ, units: degrees)", () => {
  it("holds the spec-mandated 1500-4000 stars through magnitude 5.5", () => {
    expect(STAR_COUNT).toBeGreaterThanOrEqual(1500);
    expect(STAR_COUNT).toBeLessThanOrEqual(4000);
    expect(STAR_RA_DEG).toHaveLength(STAR_COUNT);
    expect(STAR_DEC_DEG).toHaveLength(STAR_COUNT);
    expect(STAR_MAG).toHaveLength(STAR_COUNT);
    expect(STAR_COLOR_INDEX).toHaveLength(STAR_COUNT);
  });

  it("keeps coordinates and magnitudes in physical ranges, brightest first", () => {
    let previousMag = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < STAR_COUNT; i += 1) {
      expect(STAR_RA_DEG[i]).toBeGreaterThanOrEqual(0);
      expect(STAR_RA_DEG[i]).toBeLessThan(360);
      expect(STAR_DEC_DEG[i]).toBeGreaterThanOrEqual(-90);
      expect(STAR_DEC_DEG[i]).toBeLessThanOrEqual(90);
      expect(STAR_MAG[i]).toBeLessThanOrEqual(5.5);
      expect(STAR_MAG[i]!).toBeGreaterThanOrEqual(previousMag);
      previousMag = STAR_MAG[i]!;
    }
  });

  it("names Sirius as the brightest star and keeps name indices valid", () => {
    expect(STAR_NAMES[0]?.[1]).toBe("Sirius");
    expect(STAR_NAMES[0]?.[0]).toBe(0);
    for (const [index, name] of STAR_NAMES) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(STAR_COUNT);
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
