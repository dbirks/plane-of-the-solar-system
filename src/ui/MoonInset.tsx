import { useEffect, useRef } from "react";

import { moonPhaseName } from "../astronomy/moon-phase-name";
import { useAppStore } from "../app/app-store";

const DISC_SIZE_PX = 104;

/**
 * Draw the lit portion of the disc from the phase angle (0 new → 180 full).
 * Classic two-arc construction: half the disc is lit, and the terminator is a
 * half-ellipse whose minor axis follows cos(phase). Waxing light grows on the
 * right, as seen from the northern hemisphere.
 */
function drawPhaseDisc(canvas: HTMLCanvasElement, phaseDeg: number): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const size = canvas.width;
  const center = size / 2;
  const radius = size / 2 - 2;
  const normalized = ((phaseDeg % 360) + 360) % 360;
  const waxing = normalized <= 180;
  const illuminatedFraction = (1 - Math.cos((normalized * Math.PI) / 180)) / 2;

  context.clearRect(0, 0, size, size);

  // Night side.
  context.fillStyle = "#232b34";
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.fill();

  // Lit semicircle on the bright-limb side.
  context.fillStyle = "#e9e6dc";
  context.beginPath();
  if (waxing) {
    context.arc(center, center, radius, -Math.PI / 2, Math.PI / 2);
  } else {
    context.arc(center, center, radius, Math.PI / 2, (3 * Math.PI) / 2);
  }
  context.fill();

  // Terminator ellipse: adds light past half phase, removes it before.
  const minorAxis = radius * Math.abs(2 * illuminatedFraction - 1);
  context.fillStyle = illuminatedFraction >= 0.5 ? "#e9e6dc" : "#232b34";
  context.beginPath();
  context.ellipse(center, center, Math.max(0.5, minorAxis), radius, 0, 0, Math.PI * 2);
  context.fill();
}

export function MoonInset() {
  const selectedBodyId = useAppStore((state) => state.selectedBodyId);
  const setSelectedBodyId = useAppStore((state) => state.setSelectedBodyId);
  const skyReadout = useAppStore((state) => state.skyReadout);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const open = selectedBodyId === "moon" && skyReadout !== null;

  useEffect(() => {
    if (!open || !canvasRef.current || !skyReadout) return;
    drawPhaseDisc(canvasRef.current, skyReadout.moonPhaseDeg);
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
            <dd>{Math.round(skyReadout.moonDistanceM / 1000).toLocaleString("en-US")} km</dd>
          </div>
        </dl>
      </div>
      <p className="moon-inset-note">
        True size and distance stay in the main view; this close-up is labeled UI, not the scene.
      </p>
    </aside>
  );
}
