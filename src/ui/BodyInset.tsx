import { useEffect, useRef } from "react";

import { formatDistance } from "../camera/distance-format";
import { METERS_PER_AU } from "../coordinates/units";
import { marsSeasonLabel } from "../astronomy/mars-season";
import type { SkyBodyId } from "../astronomy/sky-state";
import { useAppStore } from "../app/app-store";
import { drawPhaseDisc } from "./phase-disc";

const DISC_SIZE_PX = 104;

// Surface maps for the planet discs (Solar System Scope, CC BY 4.0; Pluto:
// NASA New Horizons mosaic, public domain — the heart sits center-face).
// The Sun gets a plain glow tint.
const TEXTURED: Partial<Record<SkyBodyId, string>> = {
  mercury: "planet-mercury-1024.jpg",
  venus: "planet-venus-1024.jpg",
  mars: "planet-mars-1024.jpg",
  jupiter: "planet-jupiter-1024.jpg",
  saturn: "planet-saturn-1024.jpg",
  uranus: "planet-uranus-1024.jpg",
  neptune: "planet-neptune-1024.jpg",
  pluto: "planet-pluto-1024.jpg",
};

const TINTS: Partial<Record<SkyBodyId, string>> = {
  sun: "#ffe9b8",
  pluto: "#b3a08c",
};

const faceCache = new Map<string, HTMLImageElement>();

function faceFor(bodyId: SkyBodyId): HTMLImageElement | null {
  const file = TEXTURED[bodyId];
  if (!file) return null;
  let image = faceCache.get(file);
  if (!image) {
    image = new Image();
    image.src = `${import.meta.env.BASE_URL}textures/${file}`;
    faceCache.set(file, image);
  }
  return image;
}

function formatAu(distanceM: number): string {
  const au = distanceM / METERS_PER_AU;
  return au >= 10 ? `${au.toFixed(1)} AU` : `${au.toFixed(2)} AU`;
}

/**
 * Selection card for the Sun and planets (the Moon has its own inset): the
 * surface as a disc with the physically correct phase — Venus shows its real
 * crescent, Jupiter is effectively always full. True size and distance stay
 * in the main view; this close-up is UI.
 */
export function BodyInset() {
  const selectedBodyId = useAppStore((state) => state.selectedBodyId);
  const setSelectedBodyId = useAppStore((state) => state.setSelectedBodyId);
  const skyReadout = useAppStore((state) => state.skyReadout);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const body =
    selectedBodyId && selectedBodyId !== "moon" && skyReadout
      ? (skyReadout.bodies.find((candidate) => candidate.id === selectedBodyId) ?? null)
      : null;

  useEffect(() => {
    if (!body || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const image = faceFor(body.id);
    const draw = () =>
      drawPhaseDisc(canvas, {
        image,
        tint: TINTS[body.id] ?? "#9fb2bd",
        sizePx: DISC_SIZE_PX,
        illuminatedFraction: body.id === "sun" ? 1 : body.illuminatedFraction,
        litOnRight: body.litOnRight,
        // Pluto's southern hemisphere was unimaged (black) during the New
        // Horizons flyby: crop to the imaged band around the heart.
        sourceRect:
          body.id === "pluto" ? { x: 0.33, y: 0.04, width: 0.34, height: 0.62 } : undefined,
      });
    draw();
    if (image && !image.complete) {
      image.addEventListener("load", draw, { once: true });
      return () => image.removeEventListener("load", draw);
    }
    return undefined;
  }, [body]);

  if (!body) return null;

  return (
    <aside className="moon-inset" aria-label={`${body.label} details`}>
      <header>
        <span className="eyebrow">{body.label}</span>
        <button
          type="button"
          className="quiet-button icon-button inset-close"
          onClick={() => setSelectedBodyId(null)}
          aria-label={`Close ${body.label} details`}
        >
          ×
        </button>
      </header>
      <div className="moon-inset-body">
        <canvas
          ref={canvasRef}
          width={DISC_SIZE_PX}
          height={DISC_SIZE_PX}
          style={{ width: DISC_SIZE_PX, height: DISC_SIZE_PX }}
          role="img"
          aria-label={`${body.label}, ${Math.round((body.id === "sun" ? 1 : body.illuminatedFraction) * 100)}% lit`}
        />
        <dl>
          <div>
            <dt>From you</dt>
            <dd>
              {body.distanceFromObserverM > 0.05 * METERS_PER_AU
                ? formatAu(body.distanceFromObserverM)
                : formatDistance(body.distanceFromObserverM).replace("Distance from Earth · ", "")}
            </dd>
          </div>
          {body.id !== "sun" && (
            <div>
              <dt>From the Sun</dt>
              <dd>{formatAu(body.distanceFromSunM)}</dd>
            </div>
          )}
          {body.id !== "sun" && (
            <div>
              <dt>Lit</dt>
              <dd>{(body.illuminatedFraction * 100).toFixed(1)}%</dd>
            </div>
          )}
          <div>
            <dt>Magnitude</dt>
            <dd>{body.magnitude.toFixed(1)}</dd>
          </div>
          {body.id === "mars" && (
            <div>
              <dt>Season</dt>
              <dd>{marsSeasonLabel(Date.now())}</dd>
            </div>
          )}
        </dl>
      </div>
    </aside>
  );
}
