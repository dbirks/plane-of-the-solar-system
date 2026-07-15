/**
 * Martian season from the areocentric solar longitude Ls (Allison & McEwen
 * 2000 approximation, good to a small fraction of a degree — plenty for a
 * season label). Ls 0° is the northern spring equinox.
 */

const DEG = Math.PI / 180;
const J2000_JD = 2_451_545;
const MS_PER_DAY = 86_400_000;
const J2000_UTC_MS = Date.UTC(2000, 0, 1, 12);

export function marsSolarLongitudeDeg(utcMs: number): number {
  const daysSinceJ2000 = (utcMs - J2000_UTC_MS) / MS_PER_DAY + (J2000_JD - J2000_JD);
  const meanAnomalyDeg = 19.3871 + 0.52402073 * daysSinceJ2000;
  const fictitiousMeanSunDeg = 270.3871 + 0.524038496 * daysSinceJ2000;
  const m = meanAnomalyDeg * DEG;
  const equationOfCenterDeg =
    (10.691 + 3.0e-7 * daysSinceJ2000) * Math.sin(m) +
    0.623 * Math.sin(2 * m) +
    0.05 * Math.sin(3 * m) +
    0.005 * Math.sin(4 * m) +
    0.0005 * Math.sin(5 * m);
  return (((fictitiousMeanSunDeg + equationOfCenterDeg) % 360) + 360) % 360;
}

/** Human season pair for the Mars inset ("Northern winter · Southern summer"). */
export function marsSeasonLabel(utcMs: number): string {
  const ls = marsSolarLongitudeDeg(utcMs);
  if (ls < 90) return "Northern spring · Southern autumn";
  if (ls < 180) return "Northern summer · Southern winter";
  if (ls < 270) return "Northern autumn · Southern spring";
  return "Northern winter · Southern summer";
}
