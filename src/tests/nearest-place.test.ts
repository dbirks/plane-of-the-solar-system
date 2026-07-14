import { describe, expect, it } from "vitest";

import { nearestPlace } from "../location/nearest-place";

describe("nearestPlace (offline GeoNames subset)", () => {
  it("anchors the default observer to Indianapolis with a US state code", () => {
    const place = nearestPlace(39.7684, -86.1581);
    expect(place?.label).toBe("Indianapolis, IN");
    expect(place?.distanceKm).toBeLessThan(20);
  });

  it("labels non-US cities with the country name", () => {
    expect(nearestPlace(52.52, 13.405)?.label).toBe("Berlin, Germany");
    expect(nearestPlace(-33.87, 151.21)?.label).toBe("Sydney, Australia");
  });

  it("handles the antimeridian without wrapping errors", () => {
    const place = nearestPlace(-41.29, 174.78);
    expect(place?.label).toContain("Wellington");
  });

  it("returns null in the open ocean instead of a far-fetched anchor", () => {
    expect(nearestPlace(-42, -120)).toBeNull();
  });
});
