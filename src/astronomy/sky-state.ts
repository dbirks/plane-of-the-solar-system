import {
  Body,
  Equator,
  HelioVector,
  Horizon,
  Illumination,
  MakeTime,
  MoonPhase,
  Observer,
  Rotation_EQJ_HOR,
  SearchRiseSet,
} from "astronomy-engine";

import { horizonToLocalThree } from "../coordinates/transforms";
import { degreesToRadians, METERS_PER_AU } from "../coordinates/units";
import type { Vec3d } from "../coordinates/vec3d";

export type SkyBodyId =
  | "sun"
  | "moon"
  // Synthetic overlay-only entry: Earth has no place in Earth's own sky,
  // but gets a marker once the journey reaches system scale.
  | "earth"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "pluto";

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
  /**
   * The same direction without atmospheric refraction. Refraction is a
   * ground-atmosphere artifact; geometry reconstructed for a camera in space
   * must start from this one (astronomy-engine's "normal" refraction lifts
   * bodies ~0.5° even well below the horizon).
   */
  directionLocalThreeAirless: Vec3d;
  /** Physical mean radius, for true-size rendering. */
  radiusM: number;
  /** Heliocentric position in J2000 equatorial (EQJ) meters; [0,0,0] for the Sun. */
  helioEqjM: Vec3d;
};

export type SkyState = {
  utcMs: number;
  observerLatitudeDeg: number;
  observerLongitudeDeg: number;
  sun: SkyBodyState;
  moon: SkyBodyState;
  /** Mercury through Pluto, in order from the Sun. */
  planets: readonly SkyBodyState[];
  /** Earth's heliocentric position in EQJ meters (offsets the planet group). */
  earthHelioEqjM: Vec3d;
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
export const MOON_RADIUS_M = 1_738_100;

const BODY_DEFINITIONS: readonly BodyDefinition[] = [
  { id: "sun", label: "Sun", body: Body.Sun, radiusM: SUN_RADIUS_M },
  { id: "moon", label: "Moon", body: Body.Moon, radiusM: MOON_RADIUS_M },
  { id: "mercury", label: "Mercury", body: Body.Mercury, radiusM: 2_439_700 },
  { id: "venus", label: "Venus", body: Body.Venus, radiusM: 6_051_800 },
  { id: "mars", label: "Mars", body: Body.Mars, radiusM: 3_389_500 },
  { id: "jupiter", label: "Jupiter", body: Body.Jupiter, radiusM: 69_911_000 },
  { id: "saturn", label: "Saturn", body: Body.Saturn, radiusM: 58_232_000 },
  { id: "uranus", label: "Uranus", body: Body.Uranus, radiusM: 25_362_000 },
  { id: "neptune", label: "Neptune", body: Body.Neptune, radiusM: 24_622_000 },
  { id: "pluto", label: "Pluto", body: Body.Pluto, radiusM: 1_188_300 },
];

export type SunHorizonEvents = {
  /** Azimuth where the Sun last set / will set (degrees, north→east). */
  setAzimuthDeg: number;
  /** When that sunset happens (UTC milliseconds). */
  setUtcMs: number;
  /** Azimuth where the Sun will rise / last rose. */
  riseAzimuthDeg: number;
  /** When that sunrise happens (UTC milliseconds). */
  riseUtcMs: number;
};

/**
 * Where on the horizon the Sun sets and rises around `utcMs` — the nearest
 * set within the past day and the nearest rise within the coming day (or the
 * reverse when the search finds them the other way round). Null in polar
 * day/night when no event occurs within the window.
 */
export function computeSunHorizonEvents(
  utcMs: number,
  observerLatitudeDeg: number,
  observerLongitudeDeg: number,
): SunHorizonEvents | null {
  const observer = new Observer(observerLatitudeDeg, observerLongitudeDeg, 0);
  // Search backward half a day so "where the sun went down" points at the
  // most recent sunset through the night.
  const searchStart = MakeTime(new Date(utcMs - 43_200_000));
  const setEvent = SearchRiseSet(Body.Sun, observer, -1, searchStart, 1.5);
  const riseEvent = SearchRiseSet(Body.Sun, observer, +1, searchStart, 1.5);
  if (!setEvent || !riseEvent) return null;

  const azimuthAt = (time: ReturnType<typeof MakeTime>) => {
    const equatorial = Equator(Body.Sun, time, observer, true, true);
    return Horizon(time, observer, equatorial.ra, equatorial.dec, "normal").azimuth;
  };
  return {
    setAzimuthDeg: azimuthAt(setEvent),
    setUtcMs: setEvent.date.getTime(),
    riseAzimuthDeg: azimuthAt(riseEvent),
    riseUtcMs: riseEvent.date.getTime(),
  };
}

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
  const helioEqjAu =
    definition.id === "sun" || definition.id === "moon" ? null : HelioVector(definition.body, time);

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
    directionLocalThreeAirless: altAzToLocalThree(geometric.altitude, geometric.azimuth),
    radiusM: definition.radiusM,
    helioEqjM: helioEqjAu
      ? [helioEqjAu.x * METERS_PER_AU, helioEqjAu.y * METERS_PER_AU, helioEqjAu.z * METERS_PER_AU]
      : [0, 0, 0],
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

  const earthHelio = HelioVector(Body.Earth, time);

  return {
    utcMs,
    observerLatitudeDeg,
    observerLongitudeDeg,
    sun,
    moon,
    planets,
    earthHelioEqjM: [
      earthHelio.x * METERS_PER_AU,
      earthHelio.y * METERS_PER_AU,
      earthHelio.z * METERS_PER_AU,
    ],
    moonPhaseDeg: MoonPhase(time),
    eqjToLocalThree,
  };
}
