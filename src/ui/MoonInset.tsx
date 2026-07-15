import { useEffect, useRef } from "react";

import { formatBodyRange } from "../camera/distance-format";
import { moonPhaseName } from "../astronomy/moon-phase-name";
import { useAppStore } from "../app/app-store";
import { drawPhaseDisc } from "./phase-disc";

const DISC_SIZE_PX = 104;

// The nearside face for the disc, from the same NASA LRO map the scene uses.
const moonFace = new Image();
moonFace.src = `${import.meta.env.BASE_URL}textures/moon-lroc-2048.jpg`;

export function MoonInset() {
  const selectedBodyId = useAppStore((state) => state.selectedBodyId);
  const setSelectedBodyId = useAppStore((state) => state.setSelectedBodyId);
  const skyReadout = useAppStore((state) => state.skyReadout);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const open = selectedBodyId === "moon" && skyReadout !== null;

  useEffect(() => {
    if (!open || !canvasRef.current || !skyReadout) return;
    const canvas = canvasRef.current;
    // Waxing (phase < 180°) lights the right limb, northern-hemisphere style.
    const draw = () =>
      drawPhaseDisc(canvas, {
        image: moonFace,
        tint: "#c9c4b8",
        sizePx: DISC_SIZE_PX,
        illuminatedFraction: skyReadout.moonIlluminatedFraction,
        litOnRight: ((skyReadout.moonPhaseDeg % 360) + 360) % 360 <= 180,
      });
    draw();
    if (!moonFace.complete) {
      moonFace.addEventListener("load", draw, { once: true });
      return () => moonFace.removeEventListener("load", draw);
    }
    return undefined;
  }, [open, skyReadout]);

  if (!open || !skyReadout) return null;

  return (
    <aside className="moon-inset" aria-label="Moon inspection">
      <header>
        <span className="eyebrow">The Moon right now</span>
        <button
          type="button"
          className="quiet-button"
          onClick={() => setSelectedBodyId(null)}
          aria-label="Close Moon inspection"
        >
          Close
        </button>
      </header>
      <div className="moon-inset-body">
        <canvas
          ref={canvasRef}
          width={DISC_SIZE_PX}
          height={DISC_SIZE_PX}
          style={{ width: DISC_SIZE_PX, height: DISC_SIZE_PX }}
          role="img"
          aria-label={`Moon phase: ${moonPhaseName(skyReadout.moonPhaseDeg)}`}
        />
        <dl>
          <div>
            <dt>Phase</dt>
            <dd data-testid="moon-phase-name">{moonPhaseName(skyReadout.moonPhaseDeg)}</dd>
          </div>
          <div>
            <dt>Illuminated</dt>
            <dd>{(skyReadout.moonIlluminatedFraction * 100).toFixed(1)}%</dd>
          </div>
          <div>
            <dt>Distance</dt>
            <dd>{formatBodyRange(skyReadout.moonDistanceM)}</dd>
          </div>
        </dl>
      </div>
      <p className="moon-inset-note">
        A close-up for reading the phase. Out in the sky, the Moon keeps its true size and
        distance.
      </p>
    </aside>
  );
}
