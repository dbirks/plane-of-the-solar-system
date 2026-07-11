import {
  Body,
  Equator,
  Horizon,
  Illumination,
  MakeTime,
  MoonPhase,
  Observer,
  Rotation_EQJ_HOR,
} from "astronomy-engine";

import { horizonToLocalThree } from "../coordinates/transforms";
import { degreesToRadians, METERS_PER_AU } from "../coordinates/units";
import type { Vec3d } from "../coordinates/vec3d";

export type SkyBodyId = "sun" | "moon" | "mercury" | "venus" | "mars" | "jupiter" | "saturn";

export type SkyBodyState = {
  id: SkyBodyId;
  label: string;
  /** Apparent (refracted) altitude above the horizon. */
  altitudeDeg: number;
  /** Azimuth measured from north toward east. */
  azimuthDeg: number;
  /** Unrefracted geometric altitude, for tests and precise geometry. */
  geometricAltitudeDeg: number;
  /** Topocentric distance from the observer. */
  distanceM: number;
  angularRadiusDeg: number;
  magnitude: number;
  /** Fraction of the visible disc that is sunlit (1 for the Sun). */
  illuminatedFraction: number;
  /** Unit direction toward the body in the local Three frame. */
  directionLocalThree: Vec3d;
};

export type SkyState = {
  utcMs: number;
  observerLatitudeDeg: number;
  observerLongitudeDeg: number;
  sun: SkyBodyState;
  moon: SkyBodyState;
  planets: readonly SkyBodyState[];
  /** Moon phase angle: 0 new, 90 first quarter, 180 full, 270 third quarter. */
  moonPhaseDeg: number;
  /**
   * Row-major 3x3 matrix mapping a J2000 equatorial (EQJ) unit vector into the
   * local Three frame. Applies Earth rotation, precession, and observer
   * orientation; drives the star field.
   */
  eqjToLocalThree: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
};

type BodyDefinition = {
  id: SkyBodyId;
  label: string;
  body: Body;
  radiusM: number;
};

const SUN_RADIUS_M = 695_700_000;
const MOON_RADIUS_M = 1_738_100;

const BODY_DEFINITIONS: readonly BodyDefinition[] = [
  { id: "sun", label: "Sun", body: Body.Sun, radiusM: SUN_RADIUS_M },
  { id: "moon", label: "Moon", body: Body.Moon, radiusM: MOON_RADIUS_M },
  { id: "mercury", label: "Mercury", body: Body.Mercury, radiusM: 2_439_700 },
  { id: "venus", label: "Venus", body: Body.Venus, radiusM: 6_051_800 },
  { id: "mars", label: "Mars", body: Body.Mars, radiusM: 3_389_500 },
  { id: "jupiter", label: "Jupiter", body: Body.Jupiter, radiusM: 69_911_000 },
  { id: "saturn", label: "Saturn", body: Body.Saturn, radiusM: 58_232_000 },
];

/** Convert an alt-az direction (degrees, azimuth from north toward east) to a local-Three unit vector. */
export function altAzToLocalThree(altitudeDeg: number, azimuthDeg: number): Vec3d {
  const altitudeRad = degreesToRadians(altitudeDeg);
  const azimuthRad = degreesToRadians(azimuthDeg);
  const cosAltitude = Math.cos(altitudeRad);
  const northComponent = cosAltitude * Math.cos(azimuthRad);
  const westComponent = -cosAltitude * Math.sin(azimuthRad);
  const upComponent = Math.sin(altitudeRad);
  return horizonToLocalThree([northComponent, westComponent, upComponent]);
}

function computeBodyState(
  definition: BodyDefinition,
  time: ReturnType<typeof MakeTime>,
  observer: Observer,
): SkyBodyState {
  const topocentricEqd = Equator(definition.body, time, observer, true, true);
  const apparent = Horizon(time, observer, topocentricEqd.ra, topocentricEqd.dec, "normal");
  const geometric = Horizon(time, observer, topocentricEqd.ra, topocentricEqd.dec);
  const distanceM = topocentricEqd.dist * METERS_PER_AU;
  const illumination = Illumination(definition.body, time);

  return {
    id: definition.id,
    label: definition.label,
    altitudeDeg: apparent.altitude,
    azimuthDeg: apparent.azimuth,
    geometricAltitudeDeg: geometric.altitude,
    distanceM,
    angularRadiusDeg: (Math.asin(Math.min(1, definition.radiusM / distanceM)) * 180) / Math.PI,
    magnitude: illumination.mag,
    illuminatedFraction: definition.id === "sun" ? 1 : illumination.phase_fraction,
    directionLocalThree: altAzToLocalThree(apparent.altitude, apparent.azimuth),
  };
}

export function computeSkyState(
  utcMs: number,
  observerLatitudeDeg: number,
  observerLongitudeDeg: number,
): SkyState {
  const time = MakeTime(new Date(utcMs));
  const observer = new Observer(observerLatitudeDeg, observerLongitudeDeg, 0);

  const states = BODY_DEFINITIONS.map((definition) => computeBodyState(definition, time, observer));
  const sun = states[0]!;
  const moon = states[1]!;
  const planets = states.slice(2);

  // astronomy-engine stores rot[source][target]; RotateVector computes
  // target[j] = Σ_i rot[i][j] · source[i]. HOR axes are [north, west, zenith],
  // which horizonToLocalThree maps into the local Three frame.
  const { rot } = Rotation_EQJ_HOR(time, observer);
  const northRow: Vec3d = [rot[0]![0]!, rot[1]![0]!, rot[2]![0]!];
  const westRow: Vec3d = [rot[0]![1]!, rot[1]![1]!, rot[2]![1]!];
  const upRow: Vec3d = [rot[0]![2]!, rot[1]![2]!, rot[2]![2]!];
  // localThree = [-west, up, -north] applied row-wise.
  const eqjToLocalThree = [
    -westRow[0],
    -westRow[1],
    -westRow[2],
    upRow[0],
    upRow[1],
    upRow[2],
    -northRow[0],
    -northRow[1],
    -northRow[2],
  ] as const;

  return {
    utcMs,
    observerLatitudeDeg,
    observerLongitudeDeg,
    sun,
    moon,
    planets,
    moonPhaseDeg: MoonPhase(time),
    eqjToLocalThree,
  };
}
