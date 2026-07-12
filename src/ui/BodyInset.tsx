import { formatDistance } from "../camera/distance-format";
import { METERS_PER_AU } from "../coordinates/units";
import { useAppStore } from "../app/app-store";

function formatAu(distanceM: number): string {
  const au = distanceM / METERS_PER_AU;
  return au >= 10 ? `${au.toFixed(1)} AU` : `${au.toFixed(2)} AU`;
}

/**
 * Selection card for the Sun and planets (the Moon has its own inset with a
 * phase disc). True size and distance stay in the main view; this is UI.
 */
export function BodyInset() {
  const selectedBodyId = useAppStore((state) => state.selectedBodyId);
  const setSelectedBodyId = useAppStore((state) => state.setSelectedBodyId);
  const skyReadout = useAppStore((state) => state.skyReadout);

  if (!selectedBodyId || selectedBodyId === "moon" || !skyReadout) return null;
  const body = skyReadout.bodies.find((candidate) => candidate.id === selectedBodyId);
  if (!body) return null;

  return (
    <aside className="moon-inset" aria-label={`${body.label} details`}>
      <header>
        <span className="eyebrow">{body.label}</span>
        <button
          type="button"
          className="quiet-button"
          onClick={() => setSelectedBodyId(null)}
          aria-label={`Close ${body.label} details`}
        >
          Close
        </button>
      </header>
      <div className="moon-inset-body">
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
          <div>
            <dt>Magnitude</dt>
            <dd>{body.magnitude.toFixed(1)}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
