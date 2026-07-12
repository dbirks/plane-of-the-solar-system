import { useAppStore } from "../app/app-store";
import type { FeatureFlags } from "../app/feature-flags";

export function DebugPanel({ flags }: { flags: FeatureFlags }) {
  const telemetry = useAppStore((state) => state.telemetry);
  const skyReadout = useAppStore((state) => state.skyReadout);
  const openingTargetLabel = useAppStore((state) => state.openingTargetLabel);

  if (!flags.debug) return null;

  const timestampUtcMs = telemetry.simulationUtcMs || flags.initialUtcMs;
  const rows: Array<[string, string]> = [
    [
      "Timestamp",
      `${new Date(timestampUtcMs).toISOString()}${flags.hasExplicitTime ? " (fixed)" : ""}`,
    ],
    ["Observer", `${flags.latitudeDeg.toFixed(4)}, ${flags.longitudeDeg.toFixed(4)}`],
    ["Heading", `${telemetry.headingDeg.toFixed(1)}°`],
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

  if (skyReadout) {
    rows.push(
      [
        "Sun",
        `alt ${skyReadout.sunAltitudeDeg.toFixed(2)}° · az ${skyReadout.sunAzimuthDeg.toFixed(2)}°`,
      ],
      [
        "Moon",
        `alt ${skyReadout.moonAltitudeDeg.toFixed(2)}° · az ${skyReadout.moonAzimuthDeg.toFixed(2)}°`,
      ],
      [
        "Moon phase",
        `${skyReadout.moonPhaseDeg.toFixed(1)}° · ${(skyReadout.moonIlluminatedFraction * 100).toFixed(1)}% lit`,
      ],
      ["Catalog stars", String(skyReadout.visibleStarCount)],
      ["Opening target", openingTargetLabel ?? "—"],
    );
  }

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
