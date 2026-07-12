import { useMemo } from "react";

import { useAppStore } from "../app/app-store";
import { formatDistance } from "../camera/distance-format";
import {
  applySoftLandmarkAttraction,
  distanceToSlider,
  JOURNEY_LANDMARKS,
  sliderToDistance,
} from "../camera/scale-domains";

export function ScaleSlider() {
  const targetDistanceM = useAppStore((state) => state.targetDistanceM);
  const setTargetDistanceM = useAppStore((state) => state.setTargetDistanceM);
  const currentDistanceM = useAppStore((state) => state.telemetry.currentDistanceM);
  const normalizedTarget = distanceToSlider(targetDistanceM);

  const currentLandmark = useMemo(() => {
    return JOURNEY_LANDMARKS.reduce((closest, candidate) =>
      Math.abs(Math.log(candidate.distanceM) - Math.log(currentDistanceM)) <
      Math.abs(Math.log(closest.distanceM) - Math.log(currentDistanceM))
        ? candidate
        : closest,
    );
  }, [currentDistanceM]);

  const updateScale = (normalized: number, attract: boolean) => {
    const adjusted = attract ? applySoftLandmarkAttraction(normalized) : normalized;
    setTargetDistanceM(sliderToDistance(adjusted));
  };

  return (
    <section className="scale-control" aria-label="Journey scale">
      <div className="scale-readout" aria-live="polite">
        <span className="eyebrow">{currentLandmark.label}</span>
        <strong>{formatDistance(currentDistanceM)}</strong>
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
