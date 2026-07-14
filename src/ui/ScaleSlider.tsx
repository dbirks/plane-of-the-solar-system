import { useEffect, useMemo, useRef, useState } from "react";

import { useAppStore } from "../app/app-store";
import { formatDistance, formatDistanceParts } from "../camera/distance-format";
import {
  applySoftLandmarkAttraction,
  distanceToSlider,
  JOURNEY_LANDMARKS,
  nearestLandmark,
  sliderToDistance,
} from "../camera/scale-domains";

export function ScaleSlider() {
  const targetDistanceM = useAppStore((state) => state.targetDistanceM);
  const setTargetDistanceM = useAppStore((state) => state.setTargetDistanceM);
  const currentDistanceM = useAppStore((state) => state.telemetry.currentDistanceM);
  const normalizedTarget = distanceToSlider(targetDistanceM);

  // Landmark labels surface only while actively traveling (or hovering the
  // rail, via CSS) and fade back out shortly after arriving.
  const [railActive, setRailActive] = useState(true);
  const hideTimerRef = useRef<number | null>(null);
  useEffect(() => {
    setRailActive(true);
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setRailActive(false), 1_800);
    return () => {
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    };
  }, [targetDistanceM]);

  const currentLandmark = useMemo(() => nearestLandmark(currentDistanceM), [currentDistanceM]);

  const updateScale = (normalized: number, attract: boolean) => {
    const adjusted = attract ? applySoftLandmarkAttraction(normalized) : normalized;
    setTargetDistanceM(sliderToDistance(adjusted));
  };

  return (
    <section
      className={`scale-control${railActive ? " scale-control--active" : ""}`}
      aria-label="Journey scale"
    >
      <div className="scale-readout" aria-live="polite">
        <span className="eyebrow">{currentLandmark.label}</span>
        {/* The renderer refreshes the value span every frame by id; the
            label span holds still so the line doesn't vibrate. */}
        <strong className="scale-readout-line">
          <span id="scale-readout-label">{formatDistanceParts(currentDistanceM).label}</span>
          <span id="scale-readout-value">{formatDistanceParts(currentDistanceM).value}</span>
        </strong>
      </div>
      <div className="slider-assembly">
        <input
          className="vertical-slider"
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={normalizedTarget}
          aria-label="Distance from the ground"
          aria-valuetext={formatDistance(targetDistanceM)}
          onChange={(event) => updateScale(Number(event.currentTarget.value), false)}
          onPointerUp={(event) => updateScale(Number(event.currentTarget.value), true)}
          onKeyUp={(event) => updateScale(Number(event.currentTarget.value), true)}
        />
        <div className="landmark-track" aria-hidden="true">
          {JOURNEY_LANDMARKS.map((landmark) => (
            <span
              className="landmark-notch"
              key={landmark.id}
              style={{ bottom: `${landmark.sliderT * 100}%` }}
            />
          ))}
        </div>
        <div className="landmark-labels">
          {JOURNEY_LANDMARKS.map((landmark) => (
            <button
              key={landmark.id}
              type="button"
              style={{ bottom: `${landmark.sliderT * 100}%` }}
              onClick={() => setTargetDistanceM(landmark.distanceM)}
            >
              {landmark.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
