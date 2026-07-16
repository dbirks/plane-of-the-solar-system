import { useEffect, useRef, useState } from "react";

import { type FeatureFlags, readFeatureFlags } from "./feature-flags";
import { setActiveDistanceUnit, setGroundElevationM } from "../camera/distance-format";
import { nearestLandmark } from "../camera/scale-domains";
import { compassSupported } from "../location/compass-mode";
import { locateAndGo } from "../location/locate";
import { nearestPlace } from "../location/nearest-place";
import { resolveObserverLocation } from "../location/observer-location";
import { togglePhoneLook } from "../location/phone-look";
import { SpaceRenderer } from "../renderer/space-renderer";
import { BodyInset } from "../ui/BodyInset";
import { CompassRibbon } from "../ui/CompassRibbon";
import { DebugPanel } from "../ui/DebugPanel";
import { INTRO_STORAGE_KEY, IntroDialog } from "../ui/IntroDialog";
import { MoonInset } from "../ui/MoonInset";
import { ObserverChip } from "../ui/ObserverChip";
import { ScaleSlider } from "../ui/ScaleSlider";
import { SettingsDialog } from "../ui/SettingsDialog";
import { useAppStore } from "./app-store";
import { installWakeLock } from "./wake-lock";

const observer = resolveObserverLocation(window.location.search, window.localStorage);
const flags: FeatureFlags = {
  ...readFeatureFlags(),
  latitudeDeg: observer.latitudeDeg,
  longitudeDeg: observer.longitudeDeg,
};
setActiveDistanceUnit(flags.distanceUnit);
setGroundElevationM(nearestPlace(observer.latitudeDeg, observer.longitudeDeg)?.elevationM ?? 0);
installWakeLock();

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
  const [showSettings, setShowSettings] = useState(false);
  const telemetry = useAppStore((state) => state.telemetry);
  const openingTargetLabel = useAppStore((state) => state.openingTargetLabel);
  const phoneLookActive = useAppStore((state) => state.phoneLookActive);
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
          <button
            type="button"
            className="quiet-button icon-button"
            aria-label="Center on my location"
            onClick={() => locateAndGo()}
          >
            {/* Lucide "locate" (open crosshair). */}
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="2" x2="5" y1="12" y2="12" />
              <line x1="19" x2="22" y1="12" y2="12" />
              <line x1="12" x2="12" y1="2" y2="5" />
              <line x1="12" x2="12" y1="19" y2="22" />
              <circle cx="12" cy="12" r="7" />
            </svg>
          </button>
          {compassSupported() && (
            <button
              type="button"
              className={`quiet-button icon-button${phoneLookActive ? " icon-button--active" : ""}`}
              aria-label={phoneLookActive ? "Compass mode on" : "Compass mode"}
              aria-pressed={phoneLookActive}
              onClick={() => void togglePhoneLook()}
            >
              {/* Lucide "smartphone" with motion arcs — tilt navigation. */}
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="10" height="14" x="3" y="8" rx="2" />
                <path d="M5 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2.4" />
                <path d="M8 18h.01" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="quiet-button icon-button"
            aria-label="Settings"
            onClick={() => setShowSettings(true)}
          >
            {/* Lucide "sliders-horizontal", inlined (no runtime deps). */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="21" x2="14" y1="4" y2="4" />
              <line x1="10" x2="3" y1="4" y2="4" />
              <line x1="21" x2="12" y1="12" y2="12" />
              <line x1="8" x2="3" y1="12" y2="12" />
              <line x1="21" x2="16" y1="20" y2="20" />
              <line x1="12" x2="3" y1="20" y2="20" />
              <line x1="14" x2="14" y1="2" y2="6" />
              <line x1="8" x2="8" y1="10" y2="14" />
              <line x1="16" x2="16" y1="18" y2="22" />
            </svg>
          </button>
        </div>
      </header>

      <ObserverChip observer={observer} />

      <CompassRibbon />
      <ScaleSlider />
      <span id="imagery-credit" className="imagery-credit" style={{ visibility: "hidden" }}>
        Imagery © Esri, Maxar, Earthstar Geographics
      </span>
      <MoonInset />
      <BodyInset />
      <DebugPanel flags={flags} />

      <IntroDialog open={showIntro} onClose={() => setShowIntro(false)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />

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
