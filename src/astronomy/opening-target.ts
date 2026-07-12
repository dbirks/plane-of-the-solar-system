import { radiansToDegrees } from "../coordinates/units";
import type { Vec3d } from "../coordinates/vec3d";
import type { SkyBodyId, SkyState } from "./sky-state";

/**
 * Deterministic opening-view selection (SPEC §11.2): Moon above the horizon,
 * else the Sun near rise or set, else a bright visible planet, else a bright
 * star, else simply face south.
 */
export type OpeningTarget = {
  kind: SkyBodyId | "star" | "south";
  label: string;
  azimuthDeg: number;
  /** True altitude of the chosen object (or the fallback gaze altitude). */
  altitudeDeg: number;
  /** Comfortable camera pitch toward the target. */
  aimAltitudeDeg: number;
};

export type BrightStar = {
  name: string;
  raDeg: number;
  decDeg: number;
  magnitude: number;
};

const MOON_MIN_ALTITUDE_DEG = 3;
const SUN_WINDOW_LOW_DEG = -10;
const SUN_WINDOW_HIGH_DEG = 12;
const PLANET_MIN_ALTITUDE_DEG = 5;
const PLANET_MAX_MAGNITUDE = 1.5;
const STAR_MIN_ALTITUDE_DEG = 25;
const DARK_SUN_ALTITUDE_DEG = -10;

function clampAim(altitudeDeg: number): number {
  return Math.min(60, Math.max(4, altitudeDeg));
}

/** Alt-az of a J2000 direction through the sky snapshot's star-field rotation. */
export function eqjToAltAz(
  sky: SkyState,
  raDeg: number,
  decDeg: number,
): { altitudeDeg: number; azimuthDeg: number } {
  const raRad = (raDeg * Math.PI) / 180;
  const decRad = (decDeg * Math.PI) / 180;
  const eqj: Vec3d = [
    Math.cos(decRad) * Math.cos(raRad),
    Math.cos(decRad) * Math.sin(raRad),
    Math.sin(decRad),
  ];
  const m = sky.eqjToLocalThree;
  const x = m[0] * eqj[0] + m[1] * eqj[1] + m[2] * eqj[2];
  const y = m[3] * eqj[0] + m[4] * eqj[1] + m[5] * eqj[2];
  const z = m[6] * eqj[0] + m[7] * eqj[1] + m[8] * eqj[2];
  // Local Three frame: +x east, +y up, -z north.
  return {
    altitudeDeg: radiansToDegrees(Math.asin(Math.min(1, Math.max(-1, y)))),
    azimuthDeg: (radiansToDegrees(Math.atan2(x, -z)) + 360) % 360,
  };
}

export function chooseOpeningTarget(
  sky: SkyState,
  brightStars: readonly BrightStar[] = [],
): OpeningTarget {
  if (sky.moon.altitudeDeg > MOON_MIN_ALTITUDE_DEG) {
    return {
      kind: "moon",
      label: "Moon",
      azimuthDeg: sky.moon.azimuthDeg,
      altitudeDeg: sky.moon.altitudeDeg,
      aimAltitudeDeg: clampAim(sky.moon.altitudeDeg),
    };
  }

  if (sky.sun.altitudeDeg >= SUN_WINDOW_LOW_DEG && sky.sun.altitudeDeg <= SUN_WINDOW_HIGH_DEG) {
    return {
      kind: "sun",
      label: "Sun",
      azimuthDeg: sky.sun.azimuthDeg,
      altitudeDeg: sky.sun.altitudeDeg,
      aimAltitudeDeg: clampAim(sky.sun.altitudeDeg),
    };
  }

  const darkEnough = sky.sun.altitudeDeg < DARK_SUN_ALTITUDE_DEG;
  if (darkEnough) {
    const candidates = sky.planets.filter(
      (planet) =>
        planet.altitudeDeg > PLANET_MIN_ALTITUDE_DEG && planet.magnitude < PLANET_MAX_MAGNITUDE,
    );
    if (candidates.length > 0) {
      const brightest = candidates.reduce((best, planet) =>
        planet.magnitude < best.magnitude ? planet : best,
      );
      return {
        kind: brightest.id,
        label: brightest.label,
        azimuthDeg: brightest.azimuthDeg,
        altitudeDeg: brightest.altitudeDeg,
        aimAltitudeDeg: clampAim(brightest.altitudeDeg),
      };
    }

    // brightStars arrive brightest-first, so the first high-enough star wins.
    for (const star of brightStars) {
      const position = eqjToAltAz(sky, star.raDeg, star.decDeg);
      if (position.altitudeDeg > STAR_MIN_ALTITUDE_DEG) {
        return {
          kind: "star",
          label: star.name,
          azimuthDeg: position.azimuthDeg,
          altitudeDeg: position.altitudeDeg,
          aimAltitudeDeg: clampAim(position.altitudeDeg),
        };
      }
    }
  }

  return {
    kind: "south",
    label: "South",
    azimuthDeg: 180,
    altitudeDeg: 20,
    aimAltitudeDeg: 20,
  };
}
