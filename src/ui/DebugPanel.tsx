import { useAppStore } from "../app/app-store";
import type { FeatureFlags } from "../app/feature-flags";

export function DebugPanel({ flags }: { flags: FeatureFlags }) {
  const telemetry = useAppStore((state) => state.telemetry);

  if (!flags.debug) return null;

  const rows: Array<[string, string]> = [
    ["Timestamp", new Date(flags.fixedTimeUtcMs).toISOString()],
    ["Observer", `${flags.latitudeDeg.toFixed(4)}, ${flags.longitudeDeg.toFixed(4)}`],
    ["Renderer", telemetry.backend],
    ["Depth", flags.depth],
    ["Frame", `${telemetry.fps.toFixed(0)} fps · ${telemetry.averageFrameMs.toFixed(1)} ms avg`],
    ["Worst frame", `${telemetry.worstFrameMs.toFixed(1)} ms`],
    ["Domain", telemetry.scaleDomain],
    ["Physical distance", `${telemetry.currentDistanceM.toFixed(2)} m`],
    ["Render origin", "Camera · [0, 0, 0]"],
    ["Render scale", `${telemetry.renderScale.toExponential(3)} units/m`],
    ["Draw calls", String(telemetry.drawCalls)],
    ["GPU resources", `${telemetry.geometries} geom · ${telemetry.textures} tex`],
    ["Quantization est.", `${telemetry.estimatedJitterM.toFixed(3)} m`],
    ["Orientation offset", `${telemetry.orientationOffsetDeg.toFixed(3)}°`],
  ];

  return (
    <aside className="debug-panel" aria-label="Renderer debug information">
      <header>
        <span className="status-light" />
        Precision telemetry
      </header>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
