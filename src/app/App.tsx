import { useEffect, useRef, useState } from "react";

import { type FeatureFlags, readFeatureFlags } from "./feature-flags";
import { setActiveDistanceUnit, setGroundElevationM } from "../camera/distance-format";
import { nearestLandmark } from "../camera/scale-domains";
import { nearestPlace } from "../location/nearest-place";
import { resolveObserverLocation } from "../location/observer-location";
import { SpaceRenderer } from "../renderer/space-renderer";
import { BodyInset } from "../ui/BodyInset";
import { CompassRibbon } from "../ui/CompassRibbon";
import { LayersPanel } from "../ui/LayersPanel";
import { DebugPanel } from "../ui/DebugPanel";
import { INTRO_STORAGE_KEY, IntroDialog } from "../ui/IntroDialog";
import { MoonInset } from "../ui/MoonInset";
import { ObserverChip } from "../ui/ObserverChip";
import { ScaleSlider } from "../ui/ScaleSlider";
import { useAppStore } from "./app-store";

const observer = resolveObserverLocation(window.location.search, window.localStorage);
const flags: FeatureFlags = {
  ...readFeatureFlags(),
  latitudeDeg: observer.latitudeDeg,
  longitudeDeg: observer.longitudeDeg,
};
setActiveDistanceUnit(flags.distanceUnit);
setGroundElevationM(nearestPlace(observer.latitudeDeg, observer.longitudeDeg)?.elevationM ?? 0);

// The intro greets plain first visits; reproducible capture URLs (?time/?lat)
// and returning visitors go straight to the sky.
function introDismissed(): boolean {
  try {
    return window.localStorage.getItem(INTRO_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}
const showIntroInitially = !flags.hasExplicitTime && observer.source !== "url" && !introDismissed();

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(showIntroInitially);
  const telemetry = useAppStore((state) => state.telemetry);
  const openingTargetLabel = useAppStore((state) => state.openingTargetLabel);
  const currentLandmarkLabel = nearestLandmark(telemetry.currentDistanceM).label;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const spaceRenderer = new SpaceRenderer(canvas, flags, overlayRef.current);
    void spaceRenderer.initialize().catch((error: unknown) => {
      setRendererError(error instanceof Error ? error.message : "Renderer unavailable");
    });
    return () => spaceRenderer.dispose();
  }, []);

  return (
    <main className="experience-shell">
      <canvas ref={canvasRef} className="space-canvas" aria-label="View from Earth" />
      <div className="sky-glow" aria-hidden="true" />
      <div
        ref={overlayRef}
        className="sky-overlay"
        data-opening-target={openingTargetLabel ?? ""}
      />
      <header className="app-header">
        <div>
          <span className="brand-kicker">Plane of the solar system</span>
          <h1>{currentLandmarkLabel}</h1>
        </div>
        <div className="header-actions">
          <span className="backend-pill">{telemetry.backend}</span>
          <LayersPanel />
          <button
            type="button"
            className="quiet-button"
            aria-label="About & how to move"
            onClick={() => setShowIntro(true)}
          >
            ?
          </button>
        </div>
      </header>

      <ObserverChip observer={observer} facingLabel={openingTargetLabel} />

      <CompassRibbon />
      <ScaleSlider />
      <MoonInset />
      <BodyInset />
      <DebugPanel flags={flags} />

      <IntroDialog open={showIntro} onClose={() => setShowIntro(false)} />

      <p className="nonvisual-summary" aria-live="polite">
        Current scale domain: {telemetry.scaleDomain}. Renderer: {telemetry.backend}.
      </p>

      {rendererError && (
        <div className="error-banner" role="alert">
          <strong>The 3D view could not start.</strong>
          <span>{rendererError}</span>
        </div>
      )}
    </main>
  );
}
