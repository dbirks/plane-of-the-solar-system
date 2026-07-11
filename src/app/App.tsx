import { useEffect, useRef, useState } from "react";

import { readFeatureFlags } from "./feature-flags";
import { SpaceRenderer } from "../renderer/space-renderer";
import { CompassRibbon } from "../ui/CompassRibbon";
import { DebugPanel } from "../ui/DebugPanel";
import { ScaleSlider } from "../ui/ScaleSlider";
import { useAppStore } from "./app-store";

const flags = readFeatureFlags();

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const setReducedMotion = useAppStore((state) => state.setReducedMotion);
  const telemetry = useAppStore((state) => state.telemetry);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const spaceRenderer = new SpaceRenderer(canvas, flags);
    void spaceRenderer.initialize().catch((error: unknown) => {
      setRendererError(error instanceof Error ? error.message : "Renderer unavailable");
    });
    return () => spaceRenderer.dispose();
  }, []);

  return (
    <main className="experience-shell">
      <canvas ref={canvasRef} className="space-canvas" aria-label="View from Earth" />
      <div className="sky-glow" aria-hidden="true" />
      <header className="app-header">
        <div>
          <span className="brand-kicker">A change of scale</span>
          <h1>On Earth</h1>
        </div>
        <div className="header-actions">
          <span className="backend-pill">{telemetry.backend}</span>
          <button type="button" className="quiet-button" onClick={() => setShowHelp(!showHelp)}>
            {showHelp ? "Close" : "How to move"}
          </button>
        </div>
      </header>

      <div className="observer-label">
        <span className="pulse-dot" />
        Fixed observer · Indianapolis
      </div>

      <CompassRibbon />
      <ScaleSlider />
      <DebugPanel flags={flags} />

      {showHelp && (
        <aside className="help-card">
          <span className="eyebrow">Explore freely</span>
          <p>Drag the sky to look around. Scroll or use the scale control to leave the surface.</p>
          <label>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => setReducedMotion(event.currentTarget.checked)}
            />
            Reduce camera motion
          </label>
        </aside>
      )}

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
