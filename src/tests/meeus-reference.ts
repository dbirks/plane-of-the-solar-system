/**
 * Independent low-precision reference implementations from Jean Meeus,
 * "Astronomical Algorithms" (2nd ed.) — used ONLY by tests to cross-check
 * astronomy-engine. Deliberately a different code lineage: truncated series,
 * no shared code with the production astronomy module.
 *
 * Expected accuracy: Sun ≈ 0.01°, Moon ≈ 0.2° (truncated ELP terms).
 */

export type ReferenceAltAz = {
  altitudeDeg: number;
  azimuthDeg: number;
};

const DEG = Math.PI / 180;

function normalizeDeg(value: number): number {
  return ((value % 360) + 360) % 360;
}

function julianDay(utcMs: number): number {
  return utcMs / 86_400_000 + 2_440_587.5;
}

function centuriesSinceJ2000(jd: number): number {
  return (jd - 2_451_545) / 36_525;
}

function greenwichMeanSiderealTimeDeg(jd: number): number {
  const t = centuriesSinceJ2000(jd);
  return normalizeDeg(
    280.46061837 +
      360.98564736629 * (jd - 2_451_545) +
      0.000387933 * t * t -
      (t * t * t) / 38_710_000,
  );
}

/** Geocentric equatorial direction (RA/dec, degrees) to geometric alt-az for an observer. */
function equatorialToAltAz(
  raDeg: number,
  decDeg: number,
  jd: number,
  latitudeDeg: number,
  longitudeDeg: number,
): ReferenceAltAz {
  const localSiderealDeg = normalizeDeg(greenwichMeanSiderealTimeDeg(jd) + longitudeDeg);
  const hourAngle = normalizeDeg(localSiderealDeg - raDeg) * DEG;
  const dec = decDeg * DEG;
  const lat = latitudeDeg * DEG;

  const up = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(hourAngle);
  const north = Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(hourAngle);
  const east = -Math.cos(dec) * Math.sin(hourAngle);

  return {
    altitudeDeg: Math.asin(Math.min(1, Math.max(-1, up))) / DEG,
    azimuthDeg: normalizeDeg(Math.atan2(east, north) / DEG),
  };
}

type SunEcliptic = {
  apparentLongitudeDeg: number;
  distanceAu: number;
  obliquityDeg: number;
  jd: number;
};

/** Meeus ch. 25 (low accuracy) apparent solar longitude and distance. */
function sunEcliptic(utcMs: number): SunEcliptic {
  const jd = julianDay(utcMs);
  const t = centuriesSinceJ2000(jd);
  const meanLongitude = normalizeDeg(280.46646 + 36_000.76983 * t + 0.0003032 * t * t);
  const meanAnomalyDeg = normalizeDeg(357.52911 + 35_999.05029 * t - 0.0001537 * t * t);
  const meanAnomaly = meanAnomalyDeg * DEG;
  const eccentricity = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
  const equationOfCenter =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(meanAnomaly) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * meanAnomaly) +
    0.000289 * Math.sin(3 * meanAnomaly);
  const trueLongitude = meanLongitude + equationOfCenter;
  const trueAnomaly = (meanAnomalyDeg + equationOfCenter) * DEG;
  const distanceAu =
    (1.000001018 * (1 - eccentricity * eccentricity)) / (1 + eccentricity * Math.cos(trueAnomaly));
  const ascendingNode = (125.04 - 1934.136 * t) * DEG;
  const apparentLongitudeDeg = trueLongitude - 0.00569 - 0.00478 * Math.sin(ascendingNode);
  const obliquityDeg =
    23.439291111 - 0.0130042 * t - 1.64e-7 * t * t + 0.00256 * Math.cos(ascendingNode);
  return { apparentLongitudeDeg, distanceAu, obliquityDeg, jd };
}

export function referenceSunAltAz(
  utcMs: number,
  latitudeDeg: number,
  longitudeDeg: number,
): ReferenceAltAz {
  const { apparentLongitudeDeg, obliquityDeg, jd } = sunEcliptic(utcMs);
  const longitude = apparentLongitudeDeg * DEG;
  const obliquity = obliquityDeg * DEG;
  const raDeg = Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude)) / DEG;
  const decDeg = Math.asin(Math.sin(obliquity) * Math.sin(longitude)) / DEG;
  return equatorialToAltAz(normalizeDeg(raDeg), decDeg, jd, latitudeDeg, longitudeDeg);
}

// Truncated principal terms of the lunar theory, Meeus ch. 47.
// Rows: [coefficientD, coefficientM, coefficientMprime, coefficientF, value].
// Longitude values in 1e-6 degrees, distance values in 1e-3 km.
const MOON_LONGITUDE_TERMS: readonly (readonly [number, number, number, number, number])[] = [
  [0, 0, 1, 0, 6_288_774],
  [2, 0, -1, 0, 1_274_027],
  [2, 0, 0, 0, 658_314],
  [0, 0, 2, 0, 213_618],
  [0, 1, 0, 0, -185_116],
  [0, 0, 0, 2, -114_332],
  [2, 0, -2, 0, 58_793],
  [2, -1, -1, 0, 57_066],
  [2, 0, 1, 0, 53_322],
  [2, -1, 0, 0, 45_758],
  [0, 1, -1, 0, -40_923],
  [1, 0, 0, 0, -34_720],
  [0, 1, 1, 0, -30_383],
  [2, 0, 0, -2, 15_327],
  [0, 0, 1, 2, -12_528],
  [0, 0, 1, -2, 10_980],
];

const MOON_DISTANCE_TERMS: readonly (readonly [number, number, number, number, number])[] = [
  [0, 0, 1, 0, -20_905_355],
  [2, 0, -1, 0, -3_699_111],
  [2, 0, 0, 0, -2_955_968],
  [0, 0, 2, 0, -569_925],
  [0, 1, 0, 0, 48_888],
  [0, 0, 0, 2, -3_149],
  [2, 0, -2, 0, 246_158],
  [2, -1, -1, 0, -152_138],
  [2, 0, 1, 0, -170_733],
  [2, -1, 0, 0, -204_586],
  [0, 1, -1, 0, -129_620],
  [1, 0, 0, 0, 108_743],
  [0, 1, 1, 0, 104_755],
  [2, 0, 0, -2, 10_321],
  [0, 0, 1, -2, 79_661],
];

const MOON_LATITUDE_TERMS: readonly (readonly [number, number, number, number, number])[] = [
  [0, 0, 0, 1, 5_128_122],
  [0, 0, 1, 1, 280_602],
  [0, 0, 1, -1, 277_693],
  [2, 0, 0, -1, 173_237],
  [2, 0, -1, 1, 55_413],
  [2, 0, -1, -1, 46_271],
  [2, 0, 0, 1, 32_573],
  [0, 0, 2, 1, 17_198],
  [2, 0, 1, -1, 9_266],
  [0, 0, 2, -1, 8_822],
];

type MoonGeocentric = {
  eclipticLongitudeDeg: number;
  eclipticLatitudeDeg: number;
  distanceKm: number;
  obliquityDeg: number;
  jd: number;
};

function moonGeocentric(utcMs: number): MoonGeocentric {
  const jd = julianDay(utcMs);
  const t = centuriesSinceJ2000(jd);
  const meanLongitude = normalizeDeg(
    218.3164477 + 481_267.88123421 * t - 0.0015786 * t * t + (t * t * t) / 538_841,
  );
  const elongation = normalizeDeg(
    297.8501921 + 445_267.1114034 * t - 0.0018819 * t * t + (t * t * t) / 545_868,
  );
  const sunAnomaly = normalizeDeg(357.5291092 + 35_999.0502909 * t - 0.0001536 * t * t);
  const moonAnomaly = normalizeDeg(
    134.9633964 + 477_198.8675055 * t + 0.0087414 * t * t + (t * t * t) / 69_699,
  );
  const argumentLatitude = normalizeDeg(93.272095 + 483_202.0175233 * t - 0.0036539 * t * t);
  const eccentricityFactor = 1 - 0.002516 * t - 0.0000074 * t * t;

  const argumentDeg = (term: readonly [number, number, number, number, number]) =>
    term[0] * elongation +
    term[1] * sunAnomaly +
    term[2] * moonAnomaly +
    term[3] * argumentLatitude;
  const eccentricityScale = (term: readonly [number, number, number, number, number]) =>
    Math.abs(term[1]) === 2
      ? eccentricityFactor * eccentricityFactor
      : Math.abs(term[1]) === 1
        ? eccentricityFactor
        : 1;

  let longitudeSum = 0;
  for (const term of MOON_LONGITUDE_TERMS) {
    longitudeSum += term[4] * eccentricityScale(term) * Math.sin(argumentDeg(term) * DEG);
  }
  let distanceSum = 0;
  for (const term of MOON_DISTANCE_TERMS) {
    distanceSum += term[4] * eccentricityScale(term) * Math.cos(argumentDeg(term) * DEG);
  }
  let latitudeSum = 0;
  for (const term of MOON_LATITUDE_TERMS) {
    latitudeSum += term[4] * eccentricityScale(term) * Math.sin(argumentDeg(term) * DEG);
  }

  const t2 = t * t;
  const obliquityDeg = 23.439291111 - 0.0130042 * t - 1.64e-7 * t2;

  return {
    eclipticLongitudeDeg: normalizeDeg(meanLongitude + longitudeSum * 1e-6),
    eclipticLatitudeDeg: latitudeSum * 1e-6,
    distanceKm: 385_000.56 + distanceSum * 1e-3,
    obliquityDeg,
    jd,
  };
}

export type ReferenceMoon = ReferenceAltAz & {
  topocentricDistanceKm: number;
};

/** Topocentric geometric Moon alt-az with spherical-Earth parallax correction. */
export function referenceMoonAltAz(
  utcMs: number,
  latitudeDeg: number,
  longitudeDeg: number,
): ReferenceMoon {
  const moon = moonGeocentric(utcMs);
  const longitude = moon.eclipticLongitudeDeg * DEG;
  const latitude = moon.eclipticLatitudeDeg * DEG;
  const obliquity = moon.obliquityDeg * DEG;

  // Geocentric ecliptic -> equatorial cartesian (km).
  const xEcliptic = Math.cos(latitude) * Math.cos(longitude);
  const yEcliptic = Math.cos(latitude) * Math.sin(longitude);
  const zEcliptic = Math.sin(latitude);
  const xEquatorial = xEcliptic;
  const yEquatorial = yEcliptic * Math.cos(obliquity) - zEcliptic * Math.sin(obliquity);
  const zEquatorial = yEcliptic * Math.sin(obliquity) + zEcliptic * Math.cos(obliquity);

  const geocentric = [
    xEquatorial * moon.distanceKm,
    yEquatorial * moon.distanceKm,
    zEquatorial * moon.distanceKm,
  ];

  // Observer position in the same frame (spherical Earth is fine at this tolerance).
  const localSiderealRad = normalizeDeg(greenwichMeanSiderealTimeDeg(moon.jd) + longitudeDeg) * DEG;
  const observerLatitude = latitudeDeg * DEG;
  const earthRadiusKm = 6_378.14;
  const observer = [
    earthRadiusKm * Math.cos(observerLatitude) * Math.cos(localSiderealRad),
    earthRadiusKm * Math.cos(observerLatitude) * Math.sin(localSiderealRad),
    earthRadiusKm * Math.sin(observerLatitude),
  ];

  const topocentric = [
    geocentric[0]! - observer[0]!,
    geocentric[1]! - observer[1]!,
    geocentric[2]! - observer[2]!,
  ];
  const topocentricDistanceKm = Math.hypot(topocentric[0]!, topocentric[1]!, topocentric[2]!);
  const raDeg = normalizeDeg(Math.atan2(topocentric[1]!, topocentric[0]!) / DEG);
  const decDeg = Math.asin(topocentric[2]! / topocentricDistanceKm) / DEG;

  const altAz = equatorialToAltAz(raDeg, decDeg, moon.jd, latitudeDeg, longitudeDeg);
  return { ...altAz, topocentricDistanceKm };
}

/** Illuminated fraction of the Moon's disc, Meeus ch. 48. */
export function referenceMoonIlluminatedFraction(utcMs: number): number {
  const moon = moonGeocentric(utcMs);
  const sun = sunEcliptic(utcMs);
  const elongationCos =
    Math.cos(moon.eclipticLatitudeDeg * DEG) *
    Math.cos((moon.eclipticLongitudeDeg - sun.apparentLongitudeDeg) * DEG);
  const elongation = Math.acos(Math.min(1, Math.max(-1, elongationCos)));
  const sunDistanceKm = sun.distanceAu * 149_597_870.7;
  const phaseAngle = Math.atan2(
    sunDistanceKm * Math.sin(elongation),
    moon.distanceKm - sunDistanceKm * Math.cos(elongation),
  );
  return (1 + Math.cos(phaseAngle)) / 2;
}
