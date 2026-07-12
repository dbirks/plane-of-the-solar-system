const CARDINAL_LABELS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const PX_PER_DEG = 4;

/**
 * Sliding compass strip. React renders the static ticks once; the renderer
 * translates #compass-strip every frame from the live camera heading, so no
 * React work happens in the render loop.
 */
export function CompassRibbon() {
  const ticks: Array<{ azimuthDeg: number; label: string; major: boolean }> = [];
  // Cover -180°..540° so the strip wraps seamlessly at any heading.
  for (let azimuthDeg = -180; azimuthDeg <= 540; azimuthDeg += 45) {
    const normalized = ((azimuthDeg % 360) + 360) % 360;
    const label = CARDINAL_LABELS[Math.round(normalized / 45) % 8]!;
    ticks.push({ azimuthDeg, label, major: label.length === 1 });
  }

  return (
    <div className="compass-ribbon" aria-label="Compass heading">
      <div className="compass-window">
        <div className="compass-strip" id="compass-strip">
          {ticks.map((tick) => (
            <span
              key={tick.azimuthDeg}
              className={tick.major ? "compass-tick compass-tick--major" : "compass-tick"}
              style={{ left: `${(tick.azimuthDeg + 180) * PX_PER_DEG}px` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
