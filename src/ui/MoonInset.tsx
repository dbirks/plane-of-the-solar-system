import { useEffect, useRef } from "react";

import { moonPhaseName } from "../astronomy/moon-phase-name";
import { formatBodyRange } from "../camera/distance-format";
import { useAppStore } from "../app/app-store";

const DISC_SIZE_PX = 104;

// The nearside face for the disc, from the same NASA LRO map the scene uses.
const moonFace = new Image();
moonFace.src = `${import.meta.env.BASE_URL}textures/moon-lroc-2048.jpg`;

/**
 * Trace the lit region as one path: half the limb on the bright side plus the
 * terminator half-ellipse whose minor axis follows cos(phase). Waxing light
 * grows on the right, as seen from the northern hemisphere.
 */
function traceLitRegion(
  context: CanvasRenderingContext2D,
  center: number,
  radius: number,
  illuminatedFraction: number,
  waxing: boolean,
): void {
  const minorAxis = Math.max(0.4, radius * Math.abs(2 * illuminatedFraction - 1));
  // A crescent's terminator bulges toward the lit limb, a gibbous one away.
  const counterclockwise = illuminatedFraction < 0.5;
  context.beginPath();
  if (waxing) {
    context.arc(center, center, radius, -Math.PI / 2, Math.PI / 2, false);
    context.ellipse(center, center, minorAxis, radius, 0, Math.PI / 2, -Math.PI / 2, counterclockwise);
  } else {
    context.arc(center, center, radius, Math.PI / 2, -Math.PI / 2, false);
    context.ellipse(center, center, minorAxis, radius, 0, -Math.PI / 2, Math.PI / 2, counterclockwise);
  }
  context.closePath();
}

/**
 * Draw the phase disc: the LRO nearside as the face (crisp at device pixel
 * ratio), fully drawn in faint earthshine, with the lit region re-drawn at
 * full brightness through the terminator path.
 */
function drawPhaseDisc(canvas: HTMLCanvasElement, phaseDeg: number): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const pixelRatio = Math.min(3, window.devicePixelRatio || 1);
  const size = DISC_SIZE_PX;
  if (canvas.width !== size * pixelRatio) {
    canvas.width = size * pixelRatio;
    canvas.height = size * pixelRatio;
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const center = size / 2;
  const radius = size / 2 - 2;
  const normalized = ((phaseDeg % 360) + 360) % 360;
  const waxing = normalized <= 180;
  const illuminatedFraction = (1 - Math.cos((normalized * Math.PI) / 180)) / 2;

  context.clearRect(0, 0, size, size);

  const drawFace = () => {
    if (moonFace.complete && moonFace.naturalWidth > 0) {
      // Central square of the equirectangular map ≈ the nearside face.
      const sourceSize = moonFace.naturalHeight;
      const sourceX = (moonFace.naturalWidth - sourceSize) / 2;
      context.drawImage(
        moonFace,
        sourceX,
        0,
        sourceSize,
        sourceSize,
        center - radius,
        center - radius,
        radius * 2,
        radius * 2,
      );
    } else {
      context.fillStyle = "#c9c4b8";
      context.fillRect(center - radius, center - radius, radius * 2, radius * 2);
    }
  };

  // Night side first: the whole face in faint earthshine.
  context.save();
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.clip();
  context.filter = "brightness(0.22) saturate(0.6)";
  drawFace();
  context.restore();

  // Lit region at full brightness through the terminator path.
  context.save();
  traceLitRegion(context, center, radius, illuminatedFraction, waxing);
  context.clip();
  context.filter = "brightness(1.12)";
  drawFace();
  context.restore();
}

export function MoonInset() {
  const selectedBodyId = useAppStore((state) => state.selectedBodyId);
  const setSelectedBodyId = useAppStore((state) => state.setSelectedBodyId);
  const skyReadout = useAppStore((state) => state.skyReadout);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const open = selectedBodyId === "moon" && skyReadout !== null;

  useEffect(() => {
    if (!open || !canvasRef.current || !skyReadout) return;
    const canvas = canvasRef.current;
    drawPhaseDisc(canvas, skyReadout.moonPhaseDeg);
    if (!moonFace.complete) {
      const redraw = () => drawPhaseDisc(canvas, skyReadout.moonPhaseDeg);
      moonFace.addEventListener("load", redraw, { once: true });
      return () => moonFace.removeEventListener("load", redraw);
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
