import { useEffect, useRef, useState } from "react";

import { type FeatureFlags, readFeatureFlags } from "./feature-flags";
import { setActiveDistanceUnit, setGroundElevationM } from "../camera/distance-format";
import { nearestLandmark } from "../camera/scale-domains";
import { compassSupported } from "../location/compass-mode";
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
          {compassSupported() && (
            <button
              type="button"
              className={`quiet-button icon-button${phoneLookActive ? " icon-button--active" : ""}`}
              aria-label={phoneLookActive ? "Compass mode on" : "Compass mode"}
              aria-pressed={phoneLookActive}
              onClick={() => void togglePhoneLook()}
            >
              {/* Lucide "compass", inlined (no runtime deps). */}
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
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
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
